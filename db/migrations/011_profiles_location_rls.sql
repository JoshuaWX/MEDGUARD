-- Migration: 011_profiles_location_rls.sql
-- Ensures Row Level Security policies exist for profiles table
-- Prevents users from spoofing other users' location data

-- Enable RLS on profiles table (idempotent - safe to run even if already enabled)
alter table if exists profiles enable row level security;

-- Drop existing policies if they exist (to recreate cleanly)
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

-- Policy: Users can only SELECT their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- Policy: Users can only INSERT their own profile (id must match auth.uid())
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Policy: Users can only UPDATE their own profile
-- This prevents spoofed location updates for other users
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Add location columns if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'profiles' and column_name = 'latitude') then
    alter table profiles add column latitude double precision;
  end if;
  
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'profiles' and column_name = 'longitude') then
    alter table profiles add column longitude double precision;
  end if;
  
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'profiles' and column_name = 'state') then
    alter table profiles add column state text;
  end if;
  
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'profiles' and column_name = 'lga') then
    alter table profiles add column lga text;
  end if;
end $$;

-- Add check constraint to ensure latitude/longitude are valid when provided
-- Nigeria coordinates: Lat 4-14, Lon 2-15 (with some margin)
alter table profiles drop constraint if exists check_valid_coordinates;
alter table profiles add constraint check_valid_coordinates
  check (
    (latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180)
  );

-- Index for location queries (if not exists)
create index if not exists idx_profiles_location on profiles (state, lga);
create index if not exists idx_profiles_coordinates on profiles (latitude, longitude) 
  where latitude is not null and longitude is not null;

-- Comment on security
comment on policy "Users can update own profile" on profiles is 
  'RLS policy preventing location spoofing: users can only update their own profile data including location';
