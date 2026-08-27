begin;
select plan(14);

select is(has_function_privilege('anon', 'public.record_verified_location(text,double precision,double precision,double precision,timestamp with time zone)', 'execute'), false, 'anon cannot record a verified location');
select is(has_function_privilege('authenticated', 'public.record_verified_location(text,double precision,double precision,double precision,timestamp with time zone)', 'execute'), true, 'authenticated can record a verified location');
select is(has_table_privilege('authenticated', 'public.user_context', 'update'), false, 'clients cannot write the location mirror directly');
select is(has_function_privilege('anon', 'public.sync_profile_location_to_context()', 'execute'), false, 'anon cannot invoke the trigger helper');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'location-a@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'location-b@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, state, manual_state, use_location, latitude, longitude)
values
  ('33333333-3333-4333-8333-333333333333', 'Lagos', 'Oyo', true, 6.5244, 3.3792),
  ('44444444-4444-4444-8444-444444444444', 'Kano', 'Kano', true, 12.0022, 8.5920)
on conflict (id) do update set state = excluded.state, manual_state = excluded.manual_state, use_location = excluded.use_location, latitude = excluded.latitude, longitude = excluded.longitude;

select is((select state from public.user_context where user_id = '33333333-3333-4333-8333-333333333333'), 'Lagos', 'profile insert is mirrored into user_context');
select is((select latitude from public.user_context where user_id = '33333333-3333-4333-8333-333333333333'), 6.5244::double precision, 'profile coordinates are mirrored into user_context');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select is((select (public.record_verified_location('Ogun', 7.1475, 3.3619, 25, now()) ->> 'state')), 'Ogun', 'owner can persist a server-verified GPS state');
select results_eq('select state, latitude, longitude from public.profiles where id = ''33333333-3333-4333-8333-333333333333''', $$values ('Ogun'::text, 7.1475::double precision, 3.3619::double precision)$$, 'verified state and coordinates are written to the owner profile');
select results_eq('select state, latitude, longitude from public.user_context where user_id = ''33333333-3333-4333-8333-333333333333''', $$values ('Ogun'::text, 7.1475::double precision, 3.3619::double precision)$$, 'verified profile location is mirrored atomically');
select is((select (public.set_location_preferences(false, false) ->> 'state')), 'Oyo', 'sharing opt-out restores the manual fallback state');
select is((select latitude is null and longitude is null from public.profiles where id = '33333333-3333-4333-8333-333333333333'), true, 'sharing opt-out clears coordinates');
select is((select state from public.user_context where user_id = '33333333-3333-4333-8333-333333333333'), 'Oyo', 'fallback state is mirrored to user_context after opt-out');
select is((select (public.record_verified_location('Lagos', 6.5, 3.4, 30, now()) ->> 'state')), 'Oyo', 'GPS writes cannot reactivate a sharing opt-out');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select results_eq('select id from public.profiles order by id', $$values ('44444444-4444-4444-8444-444444444444'::uuid)$$, 'a second user cannot read the first user profile');

select * from finish();
rollback;
