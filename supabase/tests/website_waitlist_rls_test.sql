begin;
select plan(8);

select has_table('public', 'prototype_waitlist', 'prototype waitlist table exists');
select is(has_table_privilege('anon', 'public.prototype_waitlist', 'select'), false, 'anon cannot read waitlist entries');
select is(has_table_privilege('anon', 'public.prototype_waitlist', 'insert'), false, 'anon cannot insert waitlist entries');
select is(has_table_privilege('authenticated', 'public.prototype_waitlist', 'select'), false, 'authenticated cannot read waitlist entries');
select is(has_table_privilege('authenticated', 'public.prototype_waitlist', 'insert'), false, 'authenticated cannot insert waitlist entries');
select is(has_table_privilege('service_role', 'public.prototype_waitlist', 'insert'), true, 'service role can insert through the Edge Function');
select is((select relrowsecurity from pg_class where oid = 'public.prototype_waitlist'::regclass), true, 'RLS is enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.prototype_waitlist'::regclass), true, 'RLS is forced');

select * from finish();
rollback;
