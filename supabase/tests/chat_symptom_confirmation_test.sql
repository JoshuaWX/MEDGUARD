begin;
select plan(7);

select is(has_table_privilege('anon', 'public.chat_symptom_confirmations', 'select'), false, 'anon cannot read chat symptom confirmations');
select is(has_table_privilege('anon', 'public.chat_symptom_confirmations', 'insert'), false, 'anon cannot insert chat symptom confirmations');
select is(has_table_privilege('authenticated', 'public.chat_symptom_confirmations', 'insert'), true, 'authenticated callers may submit an owner-scoped confirmation');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'chat-a@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'chat-b@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.chat_conversations (id, user_id, title)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'Private chat');
insert into public.chat_symptom_confirmations (user_id, conversation_id, idempotency_key, symptom_keys)
values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', array['fever']);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select results_eq('select user_id from public.chat_symptom_confirmations', $$values ('33333333-3333-4333-8333-333333333333'::uuid)$$, 'user A can read their own confirmation');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select is((select count(*) from public.chat_symptom_confirmations), 0::bigint, 'user B cannot read user A confirmation');
select throws_ok(
  $$insert into public.chat_symptom_confirmations (user_id, conversation_id, idempotency_key, symptom_keys) values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', array['fever'])$$,
  '42501',
  'new row violates row-level security policy for table "chat_symptom_confirmations"',
  'user B cannot create a confirmation for user A'
);
select throws_ok(
  $$insert into public.chat_symptom_confirmations (user_id, conversation_id, idempotency_key, symptom_keys) values ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['fever'])$$,
  '42501',
  'new row violates row-level security policy for table "chat_symptom_confirmations"',
  'user B cannot attach their confirmation to user A conversation'
);

select * from finish();
rollback;
