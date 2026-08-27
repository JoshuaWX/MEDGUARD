begin;
select plan(19);

-- Private health tables have no anonymous Data API privileges. This is a
-- permission-layer test; RLS policy tests below provide the second layer.
select is(has_table_privilege('anon', 'public.profiles', 'select'), false, 'anon cannot select profiles');
select is(has_table_privilege('anon', 'public.symptom_logs', 'select'), false, 'anon cannot select symptom logs');
select is(has_table_privilege('anon', 'public.risk_snapshots', 'select'), false, 'anon cannot select risk snapshots');
select is(has_table_privilege('anon', 'public.health_checkins', 'select'), false, 'anon cannot select check-ins');
select is(has_table_privilege('anon', 'public.health_streaks', 'select'), false, 'anon cannot select streaks');
select is(has_table_privilege('anon', 'public.health_score_daily', 'select'), false, 'anon cannot select health scores');
select is(has_table_privilege('anon', 'public.user_daily_activity', 'select'), false, 'anon cannot select daily activity');
select is(has_table_privilege('anon', 'public.freetext_symptoms', 'select'), false, 'anon cannot select free-text symptoms');
select is(has_table_privilege('anon', 'public.user_context', 'select'), false, 'anon cannot select user context');
select is(has_table_privilege('anon', 'public.user_cycle_logs', 'select'), false, 'anon cannot select cycle logs');
select is(has_table_privilege('anon', 'public.user_cycle_settings', 'select'), false, 'anon cannot select cycle settings');

select is(has_function_privilege('anon', 'public.get_personal_health_dashboard(integer)', 'execute'), false, 'anon cannot execute the dashboard RPC');
select is(has_function_privilege('authenticated', 'public.get_personal_health_dashboard(integer)', 'execute'), true, 'authenticated users can execute the dashboard RPC');

-- Create two realistic auth users and distinct private rows. The transaction is
-- rolled back, so the local test never leaves fixture accounts behind.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'health-a@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'health-b@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.health_checkins (
  user_id, checkin_date, iso_week, risk_level, answers
) values
  ('11111111-1111-4111-8111-111111111111', current_date, '2026-W35', 'low', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', current_date, '2026-W35', 'elevated', '{}'::jsonb);

insert into public.health_score_daily (user_id, score_date, score, breakdown)
values
  ('11111111-1111-4111-8111-111111111111', current_date, 81, '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', current_date, 42, '{}'::jsonb);

insert into public.user_daily_activity (user_id, activity_date, step_count)
values
  ('11111111-1111-4111-8111-111111111111', current_date, 8000),
  ('22222222-2222-4222-8222-222222222222', current_date, 1200);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select results_eq(
  'select user_id from public.health_checkins order by user_id',
  $$values ('11111111-1111-4111-8111-111111111111'::uuid)$$,
  'user A can only read their own check-in'
);
select results_eq(
  'select score from public.health_score_daily order by score',
  'values (81)',
  'user A can only read their own health score'
);
select results_eq(
  'select step_count from public.user_daily_activity order by step_count',
  'values (8000)',
  'user A can only read their own activity'
);
select is(
  (select (public.get_personal_health_dashboard(7) -> 'today_checkin' ->> 'risk_level')),
  'low',
  'dashboard RPC derives user A from auth.uid'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select results_eq(
  'select user_id from public.health_checkins order by user_id',
  $$values ('22222222-2222-4222-8222-222222222222'::uuid)$$,
  'user B cannot read user A check-in'
);
select is(
  (select (public.get_personal_health_dashboard(7) -> 'today_checkin' ->> 'risk_level')),
  'elevated',
  'dashboard RPC returns only user B rows'
);

select * from finish();
rollback;
