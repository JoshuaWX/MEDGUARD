-- Migration: 012_ensure_profiles_table.sql
-- Ensures the profiles table exists with all required columns
-- This is a comprehensive migration that creates the table if missing

-- Create the profiles table if it doesn't exist
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  full_name text,
  state text,
  lga text,
  gender text,
  age integer,
  latitude double precision,
  longitude double precision,
  use_location boolean default true,
  avatar_url text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Drop existing policies to recreate them (idempotent)
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

-- Policy: Users can only SELECT their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- Policy: Users can only INSERT their own profile
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Policy: Users can only UPDATE their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Add any missing columns (for existing tables)
do $$
begin
  -- Add name column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'name') then
    alter table profiles add column name text;
  end if;
  
  -- Add full_name column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'full_name') then
    alter table profiles add column full_name text;
  end if;
  
  -- Add email column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'email') then
    alter table profiles add column email text;
  end if;
  
  -- Add gender column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'gender') then
    alter table profiles add column gender text;
  end if;
  
  -- Add age column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'age') then
    alter table profiles add column age integer;
  end if;
  
  -- Add state column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'state') then
    alter table profiles add column state text;
  end if;
  
  -- Add lga column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'lga') then
    alter table profiles add column lga text;
  end if;
  
  -- Add latitude column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'latitude') then
    alter table profiles add column latitude double precision;
  end if;
  
  -- Add longitude column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'longitude') then
    alter table profiles add column longitude double precision;
  end if;
  
  -- Add use_location column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'use_location') then
    alter table profiles add column use_location boolean default true;
  end if;
  
  -- Add avatar_url column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'avatar_url') then
    alter table profiles add column avatar_url text;
  end if;
  
  -- Add avatar_path column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'avatar_path') then
    alter table profiles add column avatar_path text;
  end if;
  
  -- Add created_at column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'created_at') then
    alter table profiles add column created_at timestamptz not null default now();
  end if;
  
  -- Add updated_at column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'updated_at') then
    alter table profiles add column updated_at timestamptz not null default now();
  end if;
end $$;

-- Create index for faster lookups
create index if not exists idx_profiles_email on profiles (email);

-- Create trigger to auto-update updated_at
create or replace function update_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row
  execute function update_profiles_updated_at();

-- Optional: Create a trigger to auto-create profile on new user signup
-- This ensures a profile always exists for authenticated users
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop and recreate the trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
