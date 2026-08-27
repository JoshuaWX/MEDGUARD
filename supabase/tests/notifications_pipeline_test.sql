begin;
select plan(12);

select is(has_table_privilege('anon', 'public.push_devices', 'select'), false, 'anon cannot read device registrations');
select is(has_table_privilege('authenticated', 'public.push_devices', 'select'), false, 'clients cannot read device registrations');
select is(has_table_privilege('authenticated', 'public.push_devices', 'insert'), false, 'clients cannot register a device directly');
select is(has_table_privilege('anon', 'public.health_feed_status', 'select'), true, 'public can read safe feed freshness only');
select is(has_function_privilege('anon', 'public.dispatch_risk_change_notifications()', 'execute'), false, 'anon cannot run risk dispatch');
select is(has_function_privilege('authenticated', 'public.process_push_notification_receipts()', 'execute'), false, 'clients cannot run receipt processor');
select is(has_function_privilege('postgres', 'public.ingest_official_health_news()', 'execute'), true, 'cron owner can run official ingestion');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'push-a@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'push-b@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, state, manual_state) values
  ('55555555-5555-4555-8555-555555555555', 'Lagos', 'Lagos'),
  ('66666666-6666-4666-8666-666666666666', 'Kano', 'Kano')
on conflict (id) do update set state = excluded.state, manual_state = excluded.manual_state;
insert into public.notification_preferences (user_id, community_alerts_enabled) values
  ('55555555-5555-4555-8555-555555555555', true),
  ('66666666-6666-4666-8666-666666666666', true)
on conflict (user_id) do update set community_alerts_enabled = excluded.community_alerts_enabled;
insert into public.push_devices (user_id, expo_push_token, platform) values
  ('55555555-5555-4555-8555-555555555555', 'ExponentPushToken[medguard-notification-device-1]', 'android');

select is((select user_id from public.push_devices where expo_push_token = 'ExponentPushToken[medguard-notification-device-1]'), '55555555-5555-4555-8555-555555555555'::uuid, 'a token starts owned by its current user');

insert into public.push_devices (user_id, expo_push_token, platform) values
  ('66666666-6666-4666-8666-666666666666', 'ExponentPushToken[medguard-notification-device-1]', 'ios')
on conflict (expo_push_token) do update set user_id = excluded.user_id, disabled_at = null, updated_at = now();
select is((select user_id from public.push_devices where expo_push_token = 'ExponentPushToken[medguard-notification-device-1]'), '66666666-6666-4666-8666-666666666666'::uuid, 'account switch reassigns one physical token instead of duplicating it');
select is((select count(*) from public.push_devices where expo_push_token = 'ExponentPushToken[medguard-notification-device-1]'), 1::bigint, 'one token has exactly one device row');

select is((select count(*) from cron.job where jobname in ('dispatch-risk-change-notifications', 'process-push-notification-receipts', 'ingest-official-health-news')), 3::bigint, 'risk, receipt, and official-news schedules are installed');
select is((select count(*) from cron.job where jobname = 'dispatch-health-posts'), 0::bigint, 'paid Health News SMS remains unscheduled');

select * from finish();
rollback;
