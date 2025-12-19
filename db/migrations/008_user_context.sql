-- User context: location + season + care mode preferences
-- This extends profiles with health-specific context that may change frequently
create table if not exists user_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text,                              -- Nigeria state e.g. 'Ogun', 'Lagos'
  latitude double precision,
  longitude double precision,
  season_label text,                       -- computed: 'rainy' | 'dry' | 'harmattan'
  care_mode text not null default 'default', -- 'default' | 'pregnancy' | 'child'
  care_mode_meta jsonb default '{}'::jsonb,  -- e.g. { "trimester": 2, "child_age_months": 8 }
  updated_at timestamptz not null default now()
);

-- RLS
alter table user_context enable row level security;

create policy "Users can view own context"
  on user_context for select
  using (auth.uid() = user_id);

create policy "Users can upsert own context"
  on user_context for insert
  with check (auth.uid() = user_id);

create policy "Users can update own context"
  on user_context for update
  using (auth.uid() = user_id);

-- Helper function to upsert user_context
create or replace function upsert_user_context(
  p_user_id uuid,
  p_state text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_season_label text default null,
  p_care_mode text default null,
  p_care_mode_meta jsonb default null
) returns void as $$
begin
  insert into user_context (user_id, state, latitude, longitude, season_label, care_mode, care_mode_meta, updated_at)
  values (
    p_user_id,
    p_state,
    p_latitude,
    p_longitude,
    p_season_label,
    coalesce(p_care_mode, 'default'),
    coalesce(p_care_mode_meta, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update set
    state = coalesce(excluded.state, user_context.state),
    latitude = coalesce(excluded.latitude, user_context.latitude),
    longitude = coalesce(excluded.longitude, user_context.longitude),
    season_label = coalesce(excluded.season_label, user_context.season_label),
    care_mode = coalesce(excluded.care_mode, user_context.care_mode),
    care_mode_meta = coalesce(excluded.care_mode_meta, user_context.care_mode_meta),
    updated_at = now();
end;
$$ language plpgsql security definer;
