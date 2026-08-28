begin;
select plan(9);

select is(has_table_privilege('anon', 'public.notification_dispatch_runs', 'select'), false, 'anon cannot read dispatch audits');
select is(has_table_privilege('authenticated', 'public.notification_dispatch_runs', 'select'), false, 'authenticated users cannot read dispatch audits');
select is(has_table_privilege('service_role', 'public.notification_dispatch_runs', 'select'), true, 'service role can read dispatch audits');

select results_eq(
  $$select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.notification_dispatch_runs'::regclass$$,
  $$values (true, true)$$,
  'dispatch audits enable and force RLS'
);

select is(has_function_privilege('anon', 'public.dispatch_area_notifications()', 'execute'), false, 'anon cannot invoke area dispatch');
select is(has_function_privilege('authenticated', 'public.dispatch_area_notifications()', 'execute'), false, 'authenticated cannot invoke area dispatch');
select is(has_function_privilege('service_role', 'public.dispatch_area_notifications()', 'execute'), false, 'service role cannot invoke the cron-owned dispatcher');

select ok(
  pg_get_functiondef('public.dispatch_area_notifications()'::regprocedure) like '%timeout_milliseconds := 30000%',
  'area dispatcher uses the reviewed 30-second pg_net timeout'
);

select results_eq(
  $$select schedule from cron.job where jobname = 'ingest-official-health-news' and active$$,
  $$values ('17 * * * *'::text)$$,
  'official Health News ingestion runs hourly'
);

select * from finish();
rollback;
