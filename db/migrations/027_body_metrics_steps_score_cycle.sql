-- 027_body_metrics_steps_score_cycle.sql
-- Phase B data layer: body metrics (BMI), daily activity (steps), a persisted
-- wellness score (so it can trend), and an opt-in menstrual cycle tracker.
--
-- Privacy: every table is per-user and RLS-restricted to the owner. Cycle data
-- is especially sensitive and is only ever exposed in the user's OWN personal
-- snapshot — never in any shared/area cache.

-- 1. Body metrics on the profile (latest known height/weight → BMI).
alter table public.profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists cycle_tracking_enabled boolean not null default false;

-- 2. Daily activity (step counter). One row per user per day.
create table if not exists public.user_daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  step_count integer not null default 0,
  source text not null default 'pedometer',  -- 'pedometer' | 'manual'
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, activity_date)
);
create index if not exists idx_activity_user_date on public.user_daily_activity (user_id, activity_date desc);

alter table public.user_daily_activity enable row level security;
create policy "activity owner select" on public.user_daily_activity for select using (auth.uid() = user_id);
create policy "activity owner insert" on public.user_daily_activity for insert with check (auth.uid() = user_id);
create policy "activity owner update" on public.user_daily_activity for update using (auth.uid() = user_id);

-- 3. Persisted daily wellness score (0-100) with a transparent breakdown.
create table if not exists public.health_score_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score_date date not null,
  score integer not null,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, score_date)
);
create index if not exists idx_score_user_date on public.health_score_daily (user_id, score_date desc);

alter table public.health_score_daily enable row level security;
create policy "score owner select" on public.health_score_daily for select using (auth.uid() = user_id);
create policy "score owner insert" on public.health_score_daily for insert with check (auth.uid() = user_id);
create policy "score owner update" on public.health_score_daily for update using (auth.uid() = user_id);

-- 4. Menstrual cycle logs (one row per recorded period).
create table if not exists public.user_cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  flow_intensity text,                 -- 'light' | 'normal' | 'heavy'
  symptoms text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, start_date)
);
create index if not exists idx_cycle_user_start on public.user_cycle_logs (user_id, start_date desc);

alter table public.user_cycle_logs enable row level security;
create policy "cycle owner select" on public.user_cycle_logs for select using (auth.uid() = user_id);
create policy "cycle owner insert" on public.user_cycle_logs for insert with check (auth.uid() = user_id);
create policy "cycle owner update" on public.user_cycle_logs for update using (auth.uid() = user_id);
create policy "cycle owner delete" on public.user_cycle_logs for delete using (auth.uid() = user_id);

-- 5. Cycle settings (typical lengths + reminder opt-in), one row per user.
create table if not exists public.user_cycle_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avg_cycle_length integer not null default 28,
  avg_period_length integer not null default 5,
  reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_cycle_settings enable row level security;
create policy "cyclecfg owner select" on public.user_cycle_settings for select using (auth.uid() = user_id);
create policy "cyclecfg owner insert" on public.user_cycle_settings for insert with check (auth.uid() = user_id);
create policy "cyclecfg owner update" on public.user_cycle_settings for update using (auth.uid() = user_id);
