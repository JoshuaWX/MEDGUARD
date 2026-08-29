-- An explicit user confirmation is required before a chat suggestion becomes
-- a personal-health record. The idempotency key prevents repeat taps/retries.
create table if not exists public.chat_symptom_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  idempotency_key uuid not null,
  symptom_keys text[] not null check (cardinality(symptom_keys) between 1 and 6),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.chat_symptom_confirmations enable row level security;
alter table public.chat_symptom_confirmations force row level security;
revoke all on table public.chat_symptom_confirmations from public, anon;
grant select, insert on table public.chat_symptom_confirmations to authenticated;

create policy chat_symptom_confirmations_select_own
  on public.chat_symptom_confirmations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy chat_symptom_confirmations_insert_own
  on public.chat_symptom_confirmations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chat_conversations conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

create index if not exists idx_chat_symptom_confirmations_user_created
  on public.chat_symptom_confirmations (user_id, created_at desc);
