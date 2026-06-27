-- 026_intel_refresh_cron.sql
-- Makes the area health signal genuinely "always on": a scheduled job warms the
-- intel_cache for the busiest states so `generatedAt` freshness is real, not faked.
--
-- OPTIONAL / has a cost: each refresh calls the (billable) Google Weather + Air
-- Quality APIs. Keep the state list short and the interval modest. If you'd rather
-- not run a cron, skip this file — the app still computes fresh data on demand
-- (15-min cache) and the report page shows the true "updated X ago" time.
--
-- PREREQUISITES (run/manage in the Supabase dashboard or SQL editor):
--   1. Enable extensions pg_cron and pg_net (Database → Extensions).
--   2. Store two Vault secrets (Project Settings → Vault), so no keys live here:
--        project_url  = https://cddfhyxlhtmrrtduwlqd.supabase.co
--        anon_key     = <your Supabase anon/publishable key>
--      The intel function has verify_jwt=true, so the anon key (a valid JWT) is
--      required on the call.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Warms a representative set of high-population states. Adjust the list to trade
-- freshness/coverage against Google API spend.
create or replace function public.refresh_intel_cache()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url   text;
  v_key   text;
  v_state text;
  v_states text[] := array['Lagos','Kano','Rivers','FCT','Oyo','Kaduna'];
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'anon_key';
  if v_url is null or v_key is null then
    raise notice 'refresh_intel_cache: missing Vault secrets project_url/anon_key; skipping';
    return;
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

-- Re-create the schedule idempotently (unschedule prior run if present).
do $$
begin
  perform cron.unschedule('refresh-intel-cache');
exception when others then
  null;
end;
$$;

select cron.schedule('refresh-intel-cache', '0 * * * *', $$select public.refresh_intel_cache();$$);
