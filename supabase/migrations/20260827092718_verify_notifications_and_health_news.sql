-- Production notification delivery and Health News freshness.
-- Device tokens are server-managed: neither anonymous nor authenticated Data
-- API callers can read, create, or reassign a device token directly.

begin;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null check (length(expo_push_token) between 20 and 255),
  platform text not null default 'unknown' check (platform in ('android', 'ios', 'unknown')),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expo_push_token)
);

create index if not exists idx_push_devices_active_user
  on public.push_devices (user_id, last_seen_at desc)
  where disabled_at is null;

alter table public.push_devices enable row level security;
alter table public.push_devices force row level security;
revoke all on table public.push_devices from public, anon, authenticated;
grant select, insert, update, delete on table public.push_devices to service_role;

-- One-time compatibility move. The old preferences column is retained only so
-- older installed clients do not crash; dispatchers no longer read it.
insert into public.push_devices (user_id, expo_push_token, platform, last_seen_at)
select distinct on (np.push_token)
  np.user_id,
  np.push_token,
  'unknown',
  coalesce(np.push_token_updated_at, np.updated_at, now())
from public.notification_preferences np
where np.push_token is not null
  and length(np.push_token) between 20 and 255
  and (np.push_token like 'ExponentPushToken%' or np.push_token like 'ExpoPushToken%')
order by np.push_token, coalesce(np.push_token_updated_at, np.updated_at, now()) desc
on conflict (expo_push_token) do update
  set user_id = excluded.user_id,
      last_seen_at = greatest(public.push_devices.last_seen_at, excluded.last_seen_at),
      disabled_at = null,
      updated_at = now();

alter table public.notification_log
  add column if not exists push_device_id uuid references public.push_devices(id) on delete set null,
  add column if not exists expo_ticket_id text,
  add column if not exists receipt_checked_at timestamptz;

alter table public.notification_log
  drop constraint if exists notification_log_status_check;
alter table public.notification_log
  add constraint notification_log_status_check
  check (status in ('pending', 'accepted', 'receipt_ok', 'failed', 'invalid_device', 'skipped', 'sent'));

create unique index if not exists idx_notification_log_ticket
  on public.notification_log (expo_ticket_id)
  where expo_ticket_id is not null;
create index if not exists idx_notification_log_receipts_pending
  on public.notification_log (created_at)
  where status = 'accepted' and expo_ticket_id is not null;

create table if not exists public.health_feed_status (
  source text primary key,
  last_attempt_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text,
  items_added integer not null default 0 check (items_added >= 0),
  updated_at timestamptz not null default now()
);

alter table public.health_feed_status enable row level security;
alter table public.health_feed_status force row level security;
revoke all on table public.health_feed_status from public, anon, authenticated;
grant select on table public.health_feed_status to anon, authenticated;
grant select, insert, update, delete on table public.health_feed_status to service_role;
drop policy if exists "read health feed freshness" on public.health_feed_status;
create policy "read health feed freshness"
  on public.health_feed_status for select to anon, authenticated using (true);

create unique index if not exists idx_health_posts_source_url
  on public.health_posts (source, source_url)
  where source_url is not null;

-- Internal function used only by pg_cron. It is intentionally not a public RPC.
create or replace function public.invoke_medguard_notification_job(p_function_name text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_function_name not in ('dispatch-risk-changes', 'process-push-receipts', 'ingest-health-news') then
    raise exception 'unsupported MedGuard notification job';
  end if;

  select secrets.decrypted_secret into v_url
    from vault.decrypted_secrets as secrets where secrets.name = 'project_url';
  select secrets.decrypted_secret into v_secret
    from vault.decrypted_secrets as secrets where secrets.name = 'notify_cron_secret';
  if v_url is null or v_secret is null or length(v_secret) < 32 then
    raise exception 'notification job requires project_url and a 32+ character notify_cron_secret Vault secret';
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

create or replace function public.dispatch_risk_change_notifications()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.invoke_medguard_notification_job('dispatch-risk-changes');
end;
$$;

create or replace function public.process_push_notification_receipts()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.invoke_medguard_notification_job('process-push-receipts');
end;
$$;

create or replace function public.ingest_official_health_news()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.invoke_medguard_notification_job('ingest-health-news');
end;
$$;

revoke all on function public.invoke_medguard_notification_job(text) from public, anon, authenticated, service_role;
revoke all on function public.dispatch_risk_change_notifications() from public, anon, authenticated, service_role;
revoke all on function public.process_push_notification_receipts() from public, anon, authenticated, service_role;
revoke all on function public.ingest_official_health_news() from public, anon, authenticated, service_role;
grant execute on function public.invoke_medguard_notification_job(text) to postgres;
grant execute on function public.dispatch_risk_change_notifications() to postgres;
grant execute on function public.process_push_notification_receipts() to postgres;
grant execute on function public.ingest_official_health_news() to postgres;

do $$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname in (
    'dispatch-risk-change-notifications', 'process-push-notification-receipts', 'ingest-official-health-news'
  ) loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule('dispatch-risk-change-notifications', '7 * * * *',
  $$select public.dispatch_risk_change_notifications();$$);
select cron.schedule('process-push-notification-receipts', '*/15 * * * *',
  $$select public.process_push_notification_receipts();$$);
select cron.schedule('ingest-official-health-news', '17 */6 * * *',
  $$select public.ingest_official_health_news();$$);

comment on table public.push_devices is
  'Server-managed Expo device registrations. A token belongs to exactly one current account.';
comment on table public.health_feed_status is
  'Safe public freshness metadata for the official Health News ingestion sources.';

commit;
