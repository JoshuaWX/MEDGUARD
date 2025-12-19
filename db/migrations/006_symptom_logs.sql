-- Symptom logs: raw user-reported symptoms (manual entry or from risk assessment)
create table if not exists symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symptom_key text not null,              -- normalized key e.g. 'headache', 'fever'
  symptom_label text,                     -- optional display label
  severity int check (severity between 1 and 5),
  notes text,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual', -- 'manual' | 'risk_assessment' | 'chat'
  state text,                             -- user's state at time of logging
  care_mode text,                         -- 'default' | 'pregnancy' | 'child'
  created_at timestamptz not null default now()
);

create index if not exists idx_symptom_logs_user_occurred
  on symptom_logs (user_id, occurred_at desc);

-- RLS: users can only access their own logs
alter table symptom_logs enable row level security;

create policy "Users can view own symptom logs"
  on symptom_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own symptom logs"
  on symptom_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own symptom logs"
  on symptom_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own symptom logs"
  on symptom_logs for delete
  using (auth.uid() = user_id);
