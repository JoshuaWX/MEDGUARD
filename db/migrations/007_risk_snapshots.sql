-- Risk snapshots: computed risk assessment results
create table if not exists risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessed_at timestamptz not null default now(),
  selected_symptoms text[] not null,       -- array of symptom keys assessed
  score int not null check (score between 0 and 100),
  level text not null,                     -- 'low' | 'moderate' | 'high' | 'critical'
  drivers jsonb not null default '[]'::jsonb, -- factors that contributed to score
  results jsonb not null default '{}'::jsonb, -- full assessment output
  state text,                              -- user's state at assessment time
  care_mode text,                          -- active care mode
  engine_version text not null default 'v1'
);

create index if not exists idx_risk_snapshots_user_assessed
  on risk_snapshots (user_id, assessed_at desc);

-- RLS
alter table risk_snapshots enable row level security;

create policy "Users can view own risk snapshots"
  on risk_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own risk snapshots"
  on risk_snapshots for insert
  with check (auth.uid() = user_id);
