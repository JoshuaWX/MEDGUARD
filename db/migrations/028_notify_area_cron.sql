-- 028_notify_area_cron.sql
-- Schedules the notify-area push dispatcher (official outbreak alerts).
--
-- OPTIONAL. Push is only DELIVERED once Firebase Cloud Messaging (FCM) is
-- configured for the Expo project and users have opted into community alerts;
-- until then the dispatcher finds no push tokens and sends nothing.
--
-- PREREQUISITES (dashboard / SQL editor):
--   1. Enable extensions pg_cron and pg_net.
--   2. Vault secrets (Project Settings -> Vault):
--        project_url        = https://cddfhyxlhtmrrtduwlqd.supabase.co
--        notify_cron_secret = <random string; also set as the NOTIFY_CRON_SECRET
--                              function secret via `supabase secrets set`>

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.dispatch_area_notifications()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_cron_secret';
  if v_url is null then
    raise notice 'dispatch_area_notifications: missing Vault secret project_url; skipping';
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-area',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body    := '{}'::jsonb
  );
end;
$$;

do $$
begin
  perform cron.unschedule('dispatch-area-notifications');
exception when others then
  null;
end;
$$;

-- Every 30 minutes.
select cron.schedule('dispatch-area-notifications', '*/30 * * * *', $$select public.dispatch_area_notifications();$$);
