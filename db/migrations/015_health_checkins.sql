-- Migration: 015_health_checkins.sql
-- Daily health check-ins for self-assessment and streak tracking
-- 
-- PUBLIC HEALTH REASONING:
-- - Enables early awareness of health patterns without diagnosis
-- - Supports habit-building through streak gamification
-- - Collects anonymous aggregate data for community health trends
-- - NO disease labels, NO ML predictions, purely rule-based risk levels

-- ============================================================================
-- DAILY HEALTH CHECK-INS TABLE
-- Stores individual user check-ins with yes/no answers
-- ============================================================================
create table if not exists health_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Check-in date (one per day per user)
  checkin_date date not null default current_date,
  
  -- ISO week for aggregation (YYYY-Wxx format)
  iso_week text not null,
  
  -- User's state at time of check-in (for aggregate trends)
  state text,
  
  -- Yes/No answers to health questions
  -- TRUE = Yes, FALSE = No, NULL = Not answered
  has_fever boolean not null default false,
  has_headache boolean not null default false,
  has_fatigue boolean not null default false,
  has_digestive_issues boolean not null default false,         -- diarrhea or vomiting
  has_water_exposure boolean not null default false,          -- exposure to stagnant water
  has_sick_contact boolean not null default false,            -- contact with someone sick
  
  -- Calculated risk level (rule-based, no ML)
  -- Values: 'low', 'moderate', 'elevated'
  risk_level text not null check (risk_level in ('low', 'moderate', 'elevated')),
  
  -- Raw answers as JSONB for flexibility
  answers jsonb not null default '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  
  -- Ensure one check-in per user per day
  unique (user_id, checkin_date)
);

-- Indexes for efficient queries
create index if not exists idx_checkins_user_date 
  on health_checkins (user_id, checkin_date desc);

create index if not exists idx_checkins_week_state 
  on health_checkins (iso_week, state);

create index if not exists idx_checkins_date 
  on health_checkins (checkin_date);

-- ============================================================================
-- USER HEALTH STREAKS TABLE
-- Tracks consecutive daily check-in streaks per user
-- ============================================================================
create table if not exists health_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  
  -- Current streak count (resets if a day is missed)
  current_streak int not null default 0,
  
  -- Longest streak ever achieved
  longest_streak int not null default 0,
  
  -- Last check-in date (to calculate streak continuity)
  last_checkin_date date,
  
  -- Timestamps
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- WEEKLY COMMUNITY TRENDS TABLE (AGGREGATED, ANONYMOUS)
-- State-level aggregated data for community health awareness
-- NO user identifiers stored - fully anonymous
-- ============================================================================
create table if not exists community_weekly_trends (
  id uuid primary key default gen_random_uuid(),
  
  -- Aggregation dimensions
  iso_week text not null,                 -- YYYY-Wxx format
  state text not null,                    -- Nigeria state
  
  -- Symptom counts (from check-ins only)
  fever_count int not null default 0,
  headache_count int not null default 0,
  fatigue_count int not null default 0,
  digestive_count int not null default 0,
  water_exposure_count int not null default 0,
  sick_contact_count int not null default 0,
  
  -- Risk level distribution
  low_risk_count int not null default 0,
  moderate_risk_count int not null default 0,
  elevated_risk_count int not null default 0,
  
  -- Total check-ins for this week/state
  total_checkins int not null default 0,
  
  -- Previous week comparison (calculated during aggregation)
  prev_week_total int,
  trend_direction text check (trend_direction in ('increasing', 'stable', 'decreasing')),
  
  -- Computed at
  computed_at timestamptz not null default now(),
  
  -- Unique per week per state
  unique (iso_week, state)
);

create index if not exists idx_trends_week 
  on community_weekly_trends (iso_week desc);

create index if not exists idx_trends_state_week 
  on community_weekly_trends (state, iso_week desc);

-- ============================================================================
-- FREE-TEXT SYMPTOMS TABLE (FUTURE-PROOFING)
-- Stores optional "other symptoms" for internal review only
-- NOT used in risk calculation, NOT analyzed
-- ============================================================================
create table if not exists freetext_symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Reference to check-in (optional)
  checkin_id uuid references health_checkins(id) on delete set null,
  
  -- Free text entered by user
  symptom_text text not null,
  
  -- ISO week and state for context
  iso_week text not null,
  state text,
  
  -- Internal review flag
  reviewed boolean not null default false,
  review_notes text,
  
  -- Timestamps
  created_at timestamptz not null default now()
);

create index if not exists idx_freetext_review 
  on freetext_symptoms (reviewed, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Users can only access their own data
-- ============================================================================

-- Health Check-ins RLS
alter table health_checkins enable row level security;

create policy "Users can view own checkins"
  on health_checkins for select
  using (auth.uid() = user_id);

create policy "Users can insert own checkins"
  on health_checkins for insert
  with check (auth.uid() = user_id);

create policy "Users can update own checkins"
  on health_checkins for update
  using (auth.uid() = user_id);

-- Health Streaks RLS
alter table health_streaks enable row level security;

create policy "Users can view own streak"
  on health_streaks for select
  using (auth.uid() = user_id);

create policy "Users can upsert own streak"
  on health_streaks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own streak"
  on health_streaks for update
  using (auth.uid() = user_id);

-- Community Trends - Read-only for all authenticated users
-- This is anonymous aggregate data, safe to share
alter table community_weekly_trends enable row level security;

create policy "Authenticated users can view community trends"
  on community_weekly_trends for select
  using (auth.role() = 'authenticated');

-- Free-text symptoms RLS
alter table freetext_symptoms enable row level security;

create policy "Users can view own freetext"
  on freetext_symptoms for select
  using (auth.uid() = user_id);

create policy "Users can insert own freetext"
  on freetext_symptoms for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate risk level based on answers (rule-based, transparent)
-- PUBLIC HEALTH NOTE: This is NOT a diagnosis. It's awareness-based only.
create or replace function calculate_checkin_risk_level(
  p_fever boolean,
  p_headache boolean,
  p_fatigue boolean,
  p_digestive boolean,
  p_water_exposure boolean,
  p_sick_contact boolean
) returns text as $$
declare
  symptom_count int := 0;
  exposure_count int := 0;
begin
  -- Count symptoms
  if p_fever then symptom_count := symptom_count + 2; end if;  -- Fever weighted higher
  if p_headache then symptom_count := symptom_count + 1; end if;
  if p_fatigue then symptom_count := symptom_count + 1; end if;
  if p_digestive then symptom_count := symptom_count + 2; end if;  -- Digestive weighted higher
  
  -- Count exposure factors
  if p_water_exposure then exposure_count := exposure_count + 1; end if;
  if p_sick_contact then exposure_count := exposure_count + 1; end if;
  
  -- Rule-based risk determination
  -- Elevated: Multiple symptoms + exposure, or fever + digestive
  if (symptom_count >= 4 and exposure_count >= 1) or (p_fever and p_digestive) then
    return 'elevated';
  -- Moderate: Some symptoms or exposure risk
  elsif symptom_count >= 2 or (symptom_count >= 1 and exposure_count >= 1) then
    return 'moderate';
  -- Low: Minimal or no symptoms
  else
    return 'low';
  end if;
end;
$$ language plpgsql immutable security definer
set search_path = public;

-- Get current ISO week string
create or replace function get_iso_week(p_date date default current_date)
returns text as $$
begin
  return to_char(p_date, 'IYYY') || '-W' || lpad(to_char(p_date, 'IW'), 2, '0');
end;
$$ language plpgsql immutable security definer
set search_path = public;

-- Update streak after check-in
create or replace function update_health_streak(p_user_id uuid, p_checkin_date date)
returns void as $$
declare
  v_last_date date;
  v_current int;
  v_longest int;
  v_new_streak int;
begin
  -- Get current streak data
  select last_checkin_date, current_streak, longest_streak
  into v_last_date, v_current, v_longest
  from health_streaks
  where user_id = p_user_id;
  
  if not found then
    -- First ever check-in
    insert into health_streaks (user_id, current_streak, longest_streak, last_checkin_date, updated_at)
    values (p_user_id, 1, 1, p_checkin_date, now());
    return;
  end if;
  
  -- Calculate new streak
  if v_last_date = p_checkin_date - 1 then
    -- Consecutive day - increment streak
    v_new_streak := v_current + 1;
  elsif v_last_date = p_checkin_date then
    -- Same day - no change
    return;
  else
    -- Missed day(s) - reset streak
    v_new_streak := 1;
  end if;
  
  -- Update streak
  update health_streaks
  set current_streak = v_new_streak,
      longest_streak = greatest(v_longest, v_new_streak),
      last_checkin_date = p_checkin_date,
      updated_at = now()
  where user_id = p_user_id;
end;
$$ language plpgsql security definer
set search_path = public;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
comment on table health_checkins is 
  'Daily health self-assessments. One per user per day. Risk levels are awareness-based, NOT diagnostic.';

comment on table health_streaks is 
  'Tracks consecutive daily check-in streaks for habit-building gamification.';

comment on table community_weekly_trends is 
  'Anonymous, aggregated weekly health trends by state. Contains NO user identifiers.';

comment on table freetext_symptoms is 
  'Optional free-text symptom descriptions for future checkbox improvements. NOT used in risk calculation.';

comment on function calculate_checkin_risk_level is 
  'Rule-based risk level calculation. Returns low/moderate/elevated. NOT a diagnosis.';
