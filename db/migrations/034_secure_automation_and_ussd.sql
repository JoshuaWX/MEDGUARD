-- 034_secure_automation_and_ussd.sql
--
-- Security hardening for privileged pg_cron jobs. These functions must remain
-- callable by their postgres owner for cron, but must never be callable as a
-- PostgREST RPC by PUBLIC, anon, authenticated, or service_role.

begin;

create or replace function public.refresh_intel_cache()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url   text;
  v_key   text;
  v_state text;
  v_states text[] := array['Lagos','Kano','Rivers','FCT','Oyo','Kaduna'];
begin
  select secrets.decrypted_secret
    into v_url
    from vault.decrypted_secrets as secrets
   where secrets.name = 'project_url';
  select secrets.decrypted_secret
    into v_key
    from vault.decrypted_secrets as secrets
   where secrets.name = 'anon_key';

  if v_url is null or v_key is null then
    raise exception 'refresh_intel_cache requires project_url and anon_key Vault secrets';
  end if;

  foreach v_state in array v_states loop
    perform net.http_post(
      url     := v_url || '/functions/v1/intel',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object('state', v_state)
    );
  end loop;
end;
$$;

create or replace function public.dispatch_area_notifications()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select secrets.decrypted_secret
    into v_url
    from vault.decrypted_secrets as secrets
   where secrets.name = 'project_url';
  select secrets.decrypted_secret
    into v_secret
    from vault.decrypted_secrets as secrets
   where secrets.name = 'notify_cron_secret';

  if v_url is null or v_secret is null or length(v_secret) < 32 then
    raise exception 'dispatch_area_notifications requires project_url and a 32+ character notify_cron_secret Vault secret';
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-area',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function public.refresh_intel_cache() from public, anon, authenticated, service_role;
revoke all on function public.dispatch_area_notifications() from public, anon, authenticated, service_role;

-- The postgres owner retains its implicit privileges; this makes the intended
-- scheduler dependency explicit without reopening either RPC endpoint.
grant execute on function public.refresh_intel_cache() to postgres;
grant execute on function public.dispatch_area_notifications() to postgres;

comment on function public.refresh_intel_cache() is
  'Internal pg_cron job only. EXECUTE is intentionally revoked from PUBLIC and API roles.';
comment on function public.dispatch_area_notifications() is
  'Internal pg_cron job only. EXECUTE is intentionally revoked from PUBLIC and API roles.';

commit;
