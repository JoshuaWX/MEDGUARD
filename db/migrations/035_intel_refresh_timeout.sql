-- 035_intel_refresh_timeout.sql
--
-- The Intel Edge Function performs several upstream data lookups. pg_net was
-- cancelling the hourly warm-cache requests after five seconds, so give each
-- asynchronous callback an explicit bounded 30-second deadline.

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
      body    := jsonb_build_object('state', v_state),
      timeout_milliseconds := 30000
    );
  end loop;
end;
$$;

revoke all on function public.refresh_intel_cache() from public, anon, authenticated, service_role;
grant execute on function public.refresh_intel_cache() to postgres;

comment on function public.refresh_intel_cache() is
  'Internal pg_cron job only. 30-second pg_net deadline; EXECUTE is revoked from PUBLIC and API roles.';

commit;
