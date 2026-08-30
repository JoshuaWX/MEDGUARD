begin;
select plan(8);

select has_table('public', 'website_inquiries', 'website inquiries table exists');
select is(has_table_privilege('anon', 'public.website_inquiries', 'select'), false, 'anon cannot read inquiries');
select is(has_table_privilege('anon', 'public.website_inquiries', 'insert'), false, 'anon cannot insert inquiries');
select is(has_table_privilege('authenticated', 'public.website_inquiries', 'select'), false, 'authenticated cannot read inquiries');
select is(has_table_privilege('authenticated', 'public.website_inquiries', 'insert'), false, 'authenticated cannot insert inquiries');
select is(has_table_privilege('service_role', 'public.website_inquiries', 'insert'), true, 'service role can insert through the Edge Function');
select is((select relrowsecurity from pg_class where oid = 'public.website_inquiries'::regclass), true, 'RLS is enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.website_inquiries'::regclass), true, 'RLS is forced');

select * from finish();
rollback;
