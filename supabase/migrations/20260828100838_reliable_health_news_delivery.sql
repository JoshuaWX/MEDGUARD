-- Reliable Health News delivery with aggregate-only dispatch observability.
begin;

create table if not exists public.notification_dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (length(job) between 3 and 80),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  posts_considered integer not null default 0 check (posts_considered >= 0),
  eligible_recipients integer not null default 0 check (eligible_recipients >= 0),
  deduplicated_recipients integer not null default 0 check (deduplicated_recipients >= 0),
  capped_recipients integer not null default 0 check (capped_recipients >= 0),
  queued integer not null default 0 check (queued >= 0),
  accepted integer not null default 0 check (accepted >= 0),
  failed integer not null default 0 check (failed >= 0)
);

create index if not exists idx_notification_dispatch_runs_started
  on public.notification_dispatch_runs (started_at desc);

alter table public.notification_dispatch_runs enable row level security;
alter table public.notification_dispatch_runs force row level security;
revoke all on table public.notification_dispatch_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_dispatch_runs to service_role;

comment on table public.notification_dispatch_runs is
  'Service-only aggregate delivery diagnostics. Contains no tokens, coordinates, notification bodies, or health data.';

-- The existing 30-minute fallback dispatcher was still using pg_net's short
-- default timeout. Keep its schedule and privileges, but allow the Edge
-- Function enough time to resolve recipients and receive Expo tickets.
create or replace function public.dispatch_area_notifications()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url text;
  v_secret text;
begin
  select secrets.decrypted_secret into v_url
    from vault.decrypted_secrets as secrets where secrets.name = 'project_url';
  select secrets.decrypted_secret into v_secret
    from vault.decrypted_secrets as secrets where secrets.name = 'notify_cron_secret';

  if v_url is null or v_secret is null or length(v_secret) < 32 then
    raise exception 'dispatch_area_notifications requires project_url and a 32+ character notify_cron_secret Vault secret';
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/notify-area',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.dispatch_area_notifications() from public, anon, authenticated, service_role;
grant execute on function public.dispatch_area_notifications() to postgres;

-- Check official sources hourly. Newly inserted posts are delivered in that
-- same Edge Function run; notify-area remains a 30-minute fallback for manual
-- publications and transient delivery failures.
do $$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'ingest-official-health-news' loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'ingest-official-health-news',
  '17 * * * *',
  $$select public.ingest_official_health_news();$$
);

commit;
