-- Legacy schema baseline assembled mechanically from db/migrations/001...035.
--
-- This file is the reproducible starting point for a new MedGuard database.
-- The original numbered files remain in db/migrations as historical source material.

-- === Legacy source: 001_create_profiles.sql ===

-- The original first migration was empty, while production created profiles
-- manually before the later hardening migration existed. Bootstrap the table
-- here so the subsequent legacy alterations can run on a new project.
create table if not exists public.profiles (
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


-- === Legacy source: 002_add_avatar_url.sql ===
-- Add avatar_url to profiles for storing public image URL
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text;


-- === Legacy source: 003_storage_avatars_private.sql ===
-- Create a private Storage bucket named 'avatars' (id = 'avatars')
-- Safe to run multiple times
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Policies: users can manage only their own files under a folder named by their user id
-- Select/read
drop policy if exists "Users can read own avatars" on storage.objects;
create policy "Users can read own avatars"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Insert/upload
drop policy if exists "Users can upload own avatars" on storage.objects;
create policy "Users can upload own avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Update (overwrite)
drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Delete
drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );


-- === Legacy source: 004_add_avatar_path.sql ===
-- Add avatar_path column to profiles to store private Storage object path
alter table public.profiles
  add column if not exists avatar_path text;


-- === Legacy source: 005_add_avatar_url_if_missing.sql ===
-- Ensure avatar_url column exists on profiles for legacy compatibility
alter table public.profiles
  add column if not exists avatar_url text;


-- === Legacy source: 006_symptom_logs.sql ===
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


-- === Legacy source: 007_risk_snapshots.sql ===
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


-- === Legacy source: 008_user_context.sql ===
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


-- === Legacy source: 009_intel_cache.sql ===
-- Intel cache: server-side cache for outbreak/season intel per region
-- Only accessed by service role (no RLS needed for client)
create table if not exists intel_cache (
  id uuid primary key default gen_random_uuid(),
  region_key text not null,                -- normalized state name e.g. 'ogun', 'lagos'
  scope text not null default 'general',   -- 'general' | 'outbreak' | 'weather'
  payload jsonb not null,                  -- cached intel response
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (region_key, scope)
);

create index if not exists idx_intel_cache_region_scope
  on intel_cache (region_key, scope);

create index if not exists idx_intel_cache_expires
  on intel_cache (expires_at);

-- No RLS - only server/service role accesses this table


-- === Legacy source: 010_chat_conversations.sql ===
-- ============================================
-- 010_chat_conversations.sql
-- Tables for storing chat conversations per user
-- ============================================

-- Table to store chat sessions/conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table to store individual messages within a conversation
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
-- Users can only see their own conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON chat_conversations;
CREATE POLICY "Users can view own conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON chat_conversations;
CREATE POLICY "Users can insert own conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON chat_conversations;
CREATE POLICY "Users can update own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON chat_conversations;
CREATE POLICY "Users can delete own conversations" ON chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
-- Users can only see messages from their own conversations
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON chat_messages;
CREATE POLICY "Users can view messages from own conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON chat_messages;
CREATE POLICY "Users can insert messages to own conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON chat_messages;
CREATE POLICY "Users can delete messages from own conversations" ON chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when a message is added
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON chat_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_conversation_timestamp();

-- Function to auto-generate conversation title from first user message
CREATE OR REPLACE FUNCTION auto_title_conversation()
RETURNS TRIGGER AS $$
DECLARE
    first_msg TEXT;
    conv_title TEXT;
BEGIN
    -- Only process if this is a user message and conversation title is still default
    IF NEW.role = 'user' THEN
        SELECT title INTO conv_title FROM chat_conversations WHERE id = NEW.conversation_id;
        
        IF conv_title = 'New Chat' THEN
            -- Take first 50 chars of user's first message as title
            first_msg := LEFT(NEW.content, 50);
            IF LENGTH(NEW.content) > 50 THEN
                first_msg := first_msg || '...';
            END IF;
            
            UPDATE chat_conversations
            SET title = first_msg
            WHERE id = NEW.conversation_id AND title = 'New Chat';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set title from first message
DROP TRIGGER IF EXISTS trigger_auto_title_conversation ON chat_messages;
CREATE TRIGGER trigger_auto_title_conversation
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION auto_title_conversation();


-- === Legacy source: 011_profiles_location_rls.sql ===
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


-- === Legacy source: 012_ensure_profiles_table.sql ===
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


-- === Legacy source: 013_security_fixes.sql ===
-- Migration: Security Fixes from Supabase Advisor
-- Date: 2026-01-28
-- Fixes: RLS, policy performance, duplicate policies, mutable search_path

-- ============================================
-- 1. Enable RLS on intel_cache
-- ============================================
-- intel_cache is a server-side cache table with no user_id column.
-- It should only be accessed by service_role, so we enable RLS 
-- and add a policy that blocks all direct client access.
ALTER TABLE public.intel_cache ENABLE ROW LEVEL SECURITY;

-- Block all access from anon/authenticated roles (service_role bypasses RLS)
-- This ensures only backend/edge functions can access this table
DROP POLICY IF EXISTS "Service role only" ON public.intel_cache;
CREATE POLICY "Service role only"
ON public.intel_cache FOR ALL
USING (false);

-- ============================================
-- 2. Fix suboptimal RLS policies (wrap auth.uid() in subquery)
-- ============================================

-- profiles: Drop and recreate INSERT policy with optimized check
DROP POLICY IF EXISTS "Allow insert for authenticated user with own id" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK ((select auth.uid()) = id);

-- profiles: Fix UPDATE policy (drop all variations)
DROP POLICY IF EXISTS "Allow update for authenticated user" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- profiles: Fix DELETE policy
DROP POLICY IF EXISTS "Allow delete for authenticated user" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
USING ((select auth.uid()) = id);

-- symptom_logs: Fix all policies
DROP POLICY IF EXISTS "Users can view own symptom logs" ON public.symptom_logs;
CREATE POLICY "Users can view own symptom logs"
ON public.symptom_logs FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own symptom logs" ON public.symptom_logs;
CREATE POLICY "Users can insert own symptom logs"
ON public.symptom_logs FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own symptom logs" ON public.symptom_logs;
CREATE POLICY "Users can update own symptom logs"
ON public.symptom_logs FOR UPDATE
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own symptom logs" ON public.symptom_logs;
CREATE POLICY "Users can delete own symptom logs"
ON public.symptom_logs FOR DELETE
USING ((select auth.uid()) = user_id);

-- risk_snapshots: Fix all policies
DROP POLICY IF EXISTS "Users can view own risk snapshots" ON public.risk_snapshots;
CREATE POLICY "Users can view own risk snapshots"
ON public.risk_snapshots FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own risk snapshots" ON public.risk_snapshots;
CREATE POLICY "Users can insert own risk snapshots"
ON public.risk_snapshots FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- user_context: Fix all policies (user_id is the primary key)
DROP POLICY IF EXISTS "Users can view own context" ON public.user_context;
CREATE POLICY "Users can view own context"
ON public.user_context FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can upsert own context" ON public.user_context;
CREATE POLICY "Users can upsert own context"
ON public.user_context FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own context" ON public.user_context;
CREATE POLICY "Users can update own context"
ON public.user_context FOR UPDATE
USING ((select auth.uid()) = user_id);

-- chat_conversations: Fix all policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations"
ON public.chat_conversations FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.chat_conversations;
CREATE POLICY "Users can insert own conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update own conversations"
ON public.chat_conversations FOR UPDATE
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;
CREATE POLICY "Users can delete own conversations"
ON public.chat_conversations FOR DELETE
USING ((select auth.uid()) = user_id);

-- chat_messages: Fix all policies (uses subquery to check conversation ownership)
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages from own conversations"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND c.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON public.chat_messages;
CREATE POLICY "Users can insert messages to own conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND c.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON public.chat_messages;
CREATE POLICY "Users can delete messages from own conversations"
ON public.chat_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND c.user_id = (select auth.uid())
  )
);

-- ============================================
-- 3. Consolidate duplicate SELECT policies on profiles
-- ============================================
DROP POLICY IF EXISTS "Allow select for authenticated user" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING ((select auth.uid()) = id);

-- ============================================
-- 4. Fix mutable search_path in functions
-- ============================================
ALTER FUNCTION public.update_chat_conversation_timestamp() SET search_path = public;
ALTER FUNCTION public.auto_title_conversation() SET search_path = public;
ALTER FUNCTION public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) SET search_path = public;

-- ============================================
-- 5. Leaked Password Protection (SKIPPED)
-- ============================================
-- NOTE: This feature requires Supabase Pro plan.
-- If you upgrade in the future, enable it in:
-- Authentication → Providers → Email → Enable "Leaked password protection"
--
-- Alternative for Free plan: Implement client-side password strength validation
-- using libraries like zxcvbn to check password strength before submission.


-- === Legacy source: 014_fix_function_search_path.sql ===
-- Migration: Fix function search_path security issue
-- Description: Sets immutable search_path on all functions to prevent search_path hijacking attacks
-- See: https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY

-- Fix update_profiles_updated_at function
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- Fix handle_new_user function (security definer needs extra care)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, name, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Fix update_chat_conversation_timestamp function
CREATE OR REPLACE FUNCTION update_chat_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Fix auto_title_conversation function
CREATE OR REPLACE FUNCTION auto_title_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  first_msg TEXT;
  conv_title TEXT;
BEGIN
  -- Only process if this is a user message and conversation title is still default
  IF NEW.role = 'user' THEN
    SELECT title INTO conv_title FROM chat_conversations WHERE id = NEW.conversation_id;
    
    IF conv_title = 'New Chat' THEN
      -- Take first 50 chars of user's first message as title
      first_msg := LEFT(NEW.content, 50);
      IF LENGTH(NEW.content) > 50 THEN
        first_msg := first_msg || '...';
      END IF;
      
      UPDATE chat_conversations
      SET title = first_msg
      WHERE id = NEW.conversation_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix upsert_user_context function (security definer needs extra care)
CREATE OR REPLACE FUNCTION upsert_user_context(
  p_user_id uuid,
  p_state text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_season_label text DEFAULT NULL,
  p_care_mode text DEFAULT NULL,
  p_care_mode_meta jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_context (user_id, state, latitude, longitude, season_label, care_mode, care_mode_meta, updated_at)
  VALUES (
    p_user_id,
    p_state,
    p_latitude,
    p_longitude,
    p_season_label,
    COALESCE(p_care_mode, 'default'),
    COALESCE(p_care_mode_meta, '{}'::jsonb),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    state = COALESCE(excluded.state, user_context.state),
    latitude = COALESCE(excluded.latitude, user_context.latitude),
    longitude = COALESCE(excluded.longitude, user_context.longitude),
    season_label = COALESCE(excluded.season_label, user_context.season_label),
    care_mode = COALESCE(excluded.care_mode, user_context.care_mode),
    care_mode_meta = COALESCE(excluded.care_mode_meta, user_context.care_mode_meta),
    updated_at = now();
END;
$$;

-- Add comment explaining the security fix
COMMENT ON FUNCTION update_profiles_updated_at IS 'Trigger function to auto-update updated_at timestamp. Fixed: search_path set to prevent hijacking.';
COMMENT ON FUNCTION handle_new_user IS 'Trigger function to auto-create profile on new user signup. Fixed: search_path set to prevent hijacking.';
COMMENT ON FUNCTION update_chat_conversation_timestamp IS 'Trigger function to update conversation timestamp. Fixed: search_path set to prevent hijacking.';
COMMENT ON FUNCTION auto_title_conversation IS 'Trigger function to auto-generate conversation title. Fixed: search_path set to prevent hijacking.';
COMMENT ON FUNCTION upsert_user_context IS 'Helper function to upsert user context. Fixed: search_path set to prevent hijacking.';


-- === Legacy source: 015_health_checkins.sql ===
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


-- === Legacy source: 016_notification_preferences.sql ===
-- Migration: 016_notification_preferences.sql
-- Push notification preferences (DESIGN ONLY - NOT ENABLED)
-- 
-- PUBLIC HEALTH REASONING:
-- - Opt-in only, disabled by default
-- - Single daily reminder max
-- - Non-alarmist, supportive messaging
-- - Architecture ready for future activation without refactor

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- Stores user preferences for notifications (currently disabled)
-- ============================================================================
create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  
  -- Daily health check-in reminder
  -- Currently NOT enabled - this is architecture for future use
  checkin_reminder_enabled boolean not null default false,
  
  -- Time of day to send reminder (local time, 24-hour format)
  -- Only triggers if user hasn't checked in by this time
  checkin_reminder_time time not null default '09:00:00',
  
  -- Timezone for local time calculation
  timezone text not null default 'Africa/Lagos',
  
  -- Community trend alerts (opt-in)
  community_alerts_enabled boolean not null default false,
  
  -- Push notification token (for future use)
  push_token text,
  push_token_updated_at timestamptz,
  
  -- Last notification sent (to prevent spam)
  last_checkin_reminder_at timestamptz,
  
  -- Global notification pause
  notifications_paused boolean not null default false,
  notifications_paused_until timestamptz,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- NOTIFICATION LOG TABLE
-- Tracks sent notifications (for future use, debugging, and preventing spam)
-- ============================================================================
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Notification type
  notification_type text not null check (notification_type in (
    'checkin_reminder',
    'community_trend',
    'streak_milestone',
    'general'
  )),
  
  -- Content (for debugging)
  title text not null,
  body text not null,
  
  -- Delivery status
  status text not null default 'pending' check (status in (
    'pending',
    'sent',
    'failed',
    'skipped'
  )),
  
  -- Error details if failed
  error_message text,
  
  -- Timestamps
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_log_user 
  on notification_log (user_id, created_at desc);

create index if not exists idx_notification_log_status 
  on notification_log (status, scheduled_for)
  where status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table notification_preferences enable row level security;

create policy "Users can view own notification prefs"
  on notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can upsert own notification prefs"
  on notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification prefs"
  on notification_preferences for update
  using (auth.uid() = user_id);

alter table notification_log enable row level security;

create policy "Users can view own notifications"
  on notification_log for select
  using (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTION: Check if reminder should be sent
-- Returns true ONLY if:
-- 1. Feature is enabled (currently always false)
-- 2. User has opted in
-- 3. User hasn't checked in today
-- 4. Current time is past reminder time
-- 5. No reminder sent today
-- ============================================================================
create or replace function should_send_checkin_reminder(p_user_id uuid)
returns boolean as $$
declare
  v_enabled boolean;
  v_paused boolean;
  v_reminder_time time;
  v_timezone text;
  v_last_reminder timestamptz;
  v_has_checkin_today boolean;
  v_current_local_time time;
  v_feature_enabled constant boolean := false;  -- MASTER SWITCH: Currently disabled
begin
  -- Feature-level kill switch
  if not v_feature_enabled then
    return false;
  end if;

  -- Get user preferences
  select 
    checkin_reminder_enabled,
    notifications_paused,
    checkin_reminder_time,
    timezone,
    last_checkin_reminder_at
  into 
    v_enabled,
    v_paused,
    v_reminder_time,
    v_timezone,
    v_last_reminder
  from notification_preferences
  where user_id = p_user_id;
  
  -- No preferences = no reminder
  if not found or not v_enabled or v_paused then
    return false;
  end if;
  
  -- Check if already checked in today
  select exists(
    select 1 from health_checkins
    where user_id = p_user_id
    and checkin_date = current_date
  ) into v_has_checkin_today;
  
  if v_has_checkin_today then
    return false;
  end if;
  
  -- Check if reminder already sent today
  if v_last_reminder is not null 
     and v_last_reminder::date = current_date then
    return false;
  end if;
  
  -- Check if current time is past reminder time
  v_current_local_time := (now() at time zone v_timezone)::time;
  if v_current_local_time < v_reminder_time then
    return false;
  end if;
  
  return true;
end;
$$ language plpgsql security definer
set search_path = public;

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on table notification_preferences is 
  'User notification preferences. NOTIFICATIONS ARE CURRENTLY DISABLED. Architecture only.';

comment on column notification_preferences.checkin_reminder_enabled is 
  'Opt-in daily reminder. Disabled by default. Feature currently not active.';

comment on function should_send_checkin_reminder is 
  'Checks if a checkin reminder should be sent. Currently always returns false (feature disabled).';


-- === Legacy source: 017_community_aggregation.sql ===
-- Migration: 017_community_aggregation.sql
-- Community trend aggregation function
--
-- PUBLIC HEALTH REASONING:
-- - Aggregates anonymous check-in data into weekly state-level trends
-- - No user identifiers are stored in community_weekly_trends
-- - Enables community health awareness without individual exposure
-- - Trend direction calculated for week-over-week comparison

-- ============================================================================
-- AGGREGATE COMMUNITY TRENDS FUNCTION
-- Call periodically (e.g. daily cron, or after each check-in via trigger)
-- Upserts into community_weekly_trends for a given iso_week + state
-- ============================================================================
create or replace function aggregate_community_trends(
  p_iso_week text default null,
  p_state text default null
) returns void as $$
declare
  v_iso_week text;
  v_prev_week text;
  rec record;
begin
  -- Default to current ISO week if not provided
  v_iso_week := coalesce(p_iso_week, get_iso_week(current_date));

  -- Calculate previous week string for trend direction
  v_prev_week := get_iso_week((current_date - interval '7 days')::date);

  -- Aggregate check-ins grouped by (iso_week, state)
  for rec in
    select
      c.iso_week,
      c.state,
      count(*)::int                                        as total_checkins,
      count(*) filter (where c.has_fever)::int             as fever_count,
      count(*) filter (where c.has_headache)::int          as headache_count,
      count(*) filter (where c.has_fatigue)::int           as fatigue_count,
      count(*) filter (where c.has_digestive_issues)::int  as digestive_count,
      count(*) filter (where c.has_water_exposure)::int    as water_exposure_count,
      count(*) filter (where c.has_sick_contact)::int      as sick_contact_count,
      count(*) filter (where c.risk_level = 'low')::int        as low_risk_count,
      count(*) filter (where c.risk_level = 'moderate')::int   as moderate_risk_count,
      count(*) filter (where c.risk_level = 'elevated')::int   as elevated_risk_count
    from health_checkins c
    where c.iso_week = v_iso_week
      and c.state is not null
      and (p_state is null or c.state = p_state)
    group by c.iso_week, c.state
  loop
    -- Look up previous week total for trend direction
    declare
      v_prev_total int;
      v_direction text;
    begin
      select total_checkins into v_prev_total
        from community_weekly_trends
        where iso_week = v_prev_week
          and state = rec.state;

      if v_prev_total is null then
        v_direction := null;
      elsif rec.total_checkins > v_prev_total * 1.1 then
        v_direction := 'increasing';
      elsif rec.total_checkins < v_prev_total * 0.9 then
        v_direction := 'decreasing';
      else
        v_direction := 'stable';
      end if;

      -- Upsert into community_weekly_trends
      insert into community_weekly_trends (
        iso_week, state,
        fever_count, headache_count, fatigue_count,
        digestive_count, water_exposure_count, sick_contact_count,
        low_risk_count, moderate_risk_count, elevated_risk_count,
        total_checkins, prev_week_total, trend_direction,
        computed_at
      ) values (
        rec.iso_week, rec.state,
        rec.fever_count, rec.headache_count, rec.fatigue_count,
        rec.digestive_count, rec.water_exposure_count, rec.sick_contact_count,
        rec.low_risk_count, rec.moderate_risk_count, rec.elevated_risk_count,
        rec.total_checkins, v_prev_total, v_direction,
        now()
      )
      on conflict (iso_week, state) do update set
        fever_count           = excluded.fever_count,
        headache_count        = excluded.headache_count,
        fatigue_count         = excluded.fatigue_count,
        digestive_count       = excluded.digestive_count,
        water_exposure_count  = excluded.water_exposure_count,
        sick_contact_count    = excluded.sick_contact_count,
        low_risk_count        = excluded.low_risk_count,
        moderate_risk_count   = excluded.moderate_risk_count,
        elevated_risk_count   = excluded.elevated_risk_count,
        total_checkins        = excluded.total_checkins,
        prev_week_total       = excluded.prev_week_total,
        trend_direction       = excluded.trend_direction,
        computed_at           = now();
    end;
  end loop;
end;
$$ language plpgsql security definer
set search_path = public;

-- ============================================================================
-- TRIGGER: Auto-aggregate after each check-in submission
-- Re-aggregates the current week + state on every new check-in
-- ============================================================================
create or replace function trg_aggregate_after_checkin()
returns trigger as $$
begin
  -- Only aggregate if state is known
  if new.state is not null then
    perform aggregate_community_trends(new.iso_week, new.state);
  end if;
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

-- Drop existing trigger if present, then create
drop trigger if exists checkin_aggregate_trigger on health_checkins;

create trigger checkin_aggregate_trigger
  after insert on health_checkins
  for each row
  execute function trg_aggregate_after_checkin();

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on function aggregate_community_trends is
  'Aggregates anonymous health check-in data into weekly state-level community trends. '
  'Can be called ad-hoc or via the after-insert trigger on health_checkins.';

comment on function trg_aggregate_after_checkin is
  'Trigger function that re-aggregates community trends for the inserted check-in''s week and state.';


-- === Legacy source: 018_api_rate_limits.sql ===
-- Migration: 018_api_rate_limits.sql
-- Adds a lightweight, DB-backed rate limiting primitive for Edge Functions.

create table if not exists public.api_rate_limits (
  limiter_key text not null,
  window_seconds integer not null check (window_seconds > 0),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (limiter_key, window_seconds, window_start)
);

create index if not exists idx_api_rate_limits_expires_at
  on public.api_rate_limits (expires_at);

create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if coalesce(length(trim(p_key)), 0) = 0 then
    raise exception 'p_key is required';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be > 0';
  end if;

  if p_max_requests is null or p_max_requests <= 0 then
    raise exception 'p_max_requests must be > 0';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits (
    limiter_key,
    window_seconds,
    window_start,
    request_count,
    expires_at,
    updated_at
  ) values (
    p_key,
    p_window_seconds,
    v_window_start,
    1,
    v_reset_at,
    v_now
  )
  on conflict (limiter_key, window_seconds, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    expires_at = excluded.expires_at,
    updated_at = v_now
  returning request_count into v_count;

  return query
    select
      (v_count <= p_max_requests) as allowed,
      greatest(p_max_requests - v_count, 0) as remaining,
      v_reset_at as reset_at,
      v_count as current_count;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

alter table public.api_rate_limits enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'api_rate_limits'
      and policyname = 'service role full access api_rate_limits'
  ) then
    create policy "service role full access api_rate_limits"
      on public.api_rate_limits
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- Best-effort cleanup helper for cron/manual execution.
create or replace function public.cleanup_expired_api_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.api_rate_limits
  where expires_at < now() - interval '1 hour';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_api_rate_limits() from public;
grant execute on function public.cleanup_expired_api_rate_limits() to service_role;


-- === Legacy source: 019_mobile_scale_hardening.sql ===
-- Migration: Mobile production hardening and scale-readiness
-- Date: 2026-06-11
-- Purpose: tighten public RPC grants and prevent user-id spoofing in user-owned helper functions.

-- upsert_user_context is called through authenticated Edge/client context.
-- It should never allow a caller to write context for another user id.
create or replace function public.upsert_user_context(
  p_user_id uuid,
  p_state text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_season_label text default null,
  p_care_mode text default null,
  p_care_mode_meta jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'forbidden';
  end if;

  insert into public.user_context (
    user_id,
    state,
    latitude,
    longitude,
    season_label,
    care_mode,
    care_mode_meta,
    updated_at
  )
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
    state = coalesce(excluded.state, public.user_context.state),
    latitude = coalesce(excluded.latitude, public.user_context.latitude),
    longitude = coalesce(excluded.longitude, public.user_context.longitude),
    season_label = coalesce(excluded.season_label, public.user_context.season_label),
    care_mode = coalesce(excluded.care_mode, public.user_context.care_mode),
    care_mode_meta = coalesce(excluded.care_mode_meta, public.user_context.care_mode_meta),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) from public;
revoke all on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) from anon;
grant execute on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) to authenticated;
grant execute on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) to service_role;

-- update_health_streak mutates user-owned streak rows and must not bypass RLS for arbitrary ids.
create or replace function public.update_health_streak(p_user_id uuid, p_checkin_date date)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_last_date date;
  v_current int;
  v_longest int;
  v_new_streak int;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'forbidden';
  end if;

  select last_checkin_date, current_streak, longest_streak
  into v_last_date, v_current, v_longest
  from public.health_streaks
  where user_id = p_user_id;

  if not found then
    insert into public.health_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_checkin_date,
      updated_at
    )
    values (p_user_id, 1, 1, p_checkin_date, now());
    return;
  end if;

  if v_last_date = p_checkin_date - 1 then
    v_new_streak := v_current + 1;
  elsif v_last_date = p_checkin_date then
    return;
  else
    v_new_streak := 1;
  end if;

  update public.health_streaks
  set current_streak = v_new_streak,
      longest_streak = greatest(v_longest, v_new_streak),
      last_checkin_date = p_checkin_date,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.update_health_streak(uuid, date) from public;
revoke all on function public.update_health_streak(uuid, date) from anon;
grant execute on function public.update_health_streak(uuid, date) to authenticated;
grant execute on function public.update_health_streak(uuid, date) to service_role;

-- Pure helper functions can remain callable, but do not need definer privileges.
alter function public.calculate_checkin_risk_level(boolean, boolean, boolean, boolean, boolean, boolean)
  security invoker;
alter function public.get_iso_week(date)
  security invoker;


-- === Legacy source: 020_app_version_policy.sql ===
-- Migration: 020_app_version_policy.sql
-- Remote policy used by the mobile app to block unsupported builds.

create table if not exists public.app_version_policy (
  platform text primary key check (platform in ('android', 'ios')),
  min_supported_build integer not null default 1 check (min_supported_build > 0),
  latest_build integer not null default 1 check (latest_build > 0),
  force_update boolean not null default true,
  update_url text not null default '',
  message text not null default 'Please update MedGuard to continue receiving health alerts and safety guidance.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_version_policy (
  platform,
  min_supported_build,
  latest_build,
  force_update,
  update_url,
  message
)
values
  ('android', 1, 1, true, '', 'Please update MedGuard to continue receiving health alerts and safety guidance.'),
  ('ios', 1, 1, true, '', 'Please update MedGuard to continue receiving health alerts and safety guidance.')
on conflict (platform) do nothing;

alter table public.app_version_policy enable row level security;

drop policy if exists "service role full access app_version_policy" on public.app_version_policy;
create policy "service role full access app_version_policy"
  on public.app_version_policy
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.app_version_policy from anon, authenticated;
grant select, insert, update, delete on table public.app_version_policy to service_role;

create or replace function public.set_app_version_policy_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_version_policy_updated_at on public.app_version_policy;
create trigger trg_app_version_policy_updated_at
  before update on public.app_version_policy
  for each row execute function public.set_app_version_policy_updated_at();

revoke all on function public.set_app_version_policy_updated_at() from public;


-- === Legacy source: 021_symptom_trend_baseline.sql ===
-- Migration: 021_symptom_trend_baseline.sql
-- MedGuard Brain v1 (Phase 4): symptom trend baseline RPC.
--
-- PURPOSE:
--   Provide the Brain layer with current-week vs 4-week rolling-average
--   symptom activity for a state, classified as normal/rising/elevated.
--
-- SAFETY (Amendment #5):
--   This function returns AGGREGATED counts ONLY. It never returns raw,
--   per-user check-in rows or any user identifiers. It reads from the already
--   anonymous community_weekly_trends table (no user_id column exists there).
--
-- The "current week" is the most recent ISO week present for the state (or a
-- caller-provided week). The baseline is the average of up to the 4 ISO weeks
-- immediately preceding the current week.

create or replace function public.get_symptom_trend_baseline(
  p_state text,
  p_iso_week text default null
)
returns table (
  symptom_group text,
  current_week_count integer,
  rolling_avg_4w numeric,
  classification text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text;
  v_current_week text;
begin
  if coalesce(length(trim(p_state)), 0) = 0 then
    raise exception 'p_state is required';
  end if;

  v_state := lower(trim(p_state));

  -- Resolve the current ISO week: caller-provided, else latest available row.
  v_current_week := coalesce(
    nullif(trim(p_iso_week), ''),
    (
      select t.iso_week
      from public.community_weekly_trends t
      where lower(t.state) = v_state
      order by t.iso_week desc
      limit 1
    )
  );

  -- No data for this state => return no rows (Brain treats as no signal).
  if v_current_week is null then
    return;
  end if;

  return query
  with current_week as (
    select
      t.fever_count,
      t.headache_count,
      t.fatigue_count,
      t.digestive_count,
      t.elevated_risk_count
    from public.community_weekly_trends t
    where lower(t.state) = v_state
      and t.iso_week = v_current_week
    limit 1
  ),
  -- Up to 4 ISO weeks immediately preceding the current week, for this state.
  prior_weeks as (
    select
      t.fever_count,
      t.headache_count,
      t.fatigue_count,
      t.digestive_count,
      t.elevated_risk_count
    from public.community_weekly_trends t
    where lower(t.state) = v_state
      and t.iso_week < v_current_week
    order by t.iso_week desc
    limit 4
  ),
  groups as (
    select 'fever'     as symptom_group,
           coalesce((select fever_count     from current_week), 0) as cur,
           coalesce((select avg(fever_count)     from prior_weeks), 0) as avg4w
    union all
    select 'headache',
           coalesce((select headache_count  from current_week), 0),
           coalesce((select avg(headache_count)  from prior_weeks), 0)
    union all
    select 'fatigue',
           coalesce((select fatigue_count   from current_week), 0),
           coalesce((select avg(fatigue_count)   from prior_weeks), 0)
    union all
    select 'digestive',
           coalesce((select digestive_count from current_week), 0),
           coalesce((select avg(digestive_count) from prior_weeks), 0)
    union all
    select 'elevated_risk',
           coalesce((select elevated_risk_count from current_week), 0),
           coalesce((select avg(elevated_risk_count) from prior_weeks), 0)
  )
  select
    g.symptom_group,
    g.cur::integer as current_week_count,
    round(g.avg4w, 2) as rolling_avg_4w,
    case
      -- Need a meaningful baseline before classifying as elevated/rising.
      when g.avg4w < 1 and g.cur < 3 then 'normal'
      when g.cur >= greatest(g.avg4w * 2.0, 5) then 'elevated'
      when g.cur >= g.avg4w * 1.5 and g.cur > g.avg4w then 'rising'
      else 'normal'
    end as classification
  from groups g;
end;
$$;

comment on function public.get_symptom_trend_baseline(text, text) is
  'MedGuard Brain v1: returns AGGREGATED current-week vs 4-week rolling-average '
  'symptom activity for a state (normal/rising/elevated). No raw personal rows '
  'or user identifiers are returned. Reads anonymous community_weekly_trends.';

-- Permissions: callable by the Edge Function (service role) and authenticated
-- users. Not exposed to anon by default.
revoke all on function public.get_symptom_trend_baseline(text, text) from public;
revoke all on function public.get_symptom_trend_baseline(text, text) from anon;
grant execute on function public.get_symptom_trend_baseline(text, text) to authenticated;
grant execute on function public.get_symptom_trend_baseline(text, text) to service_role;


-- === Legacy source: 022_verified_reports.sql ===
-- Migration: 022_verified_reports.sql
-- MedGuard Brain v1 (Phase 5): admin-entered verified media/health reports.
--
-- PURPOSE:
--   Store carefully reviewed, attributable public-health reports that the Brain
--   layer can surface as a strong, high-confidence signal. Only the approved
--   `summary` is shown to users; raw unverified media text is never stored here
--   for user display.
--
-- ADMIN-ONLY WRITE (defined BEFORE RLS):
--   MedGuard does not (yet) have an in-app admin role, and we must not rewrite
--   auth. Consistent with public.app_version_policy (migration 020), writes to
--   this table are performed SERVER-SIDE ONLY using the Supabase service role
--   (admin tooling / dashboard / trusted Edge Function). The mobile clients
--   (anon, authenticated) get READ access to verified + active rows only and
--   have NO insert/update/delete rights. The `reviewed_by` column records the
--   human/admin who approved each report for auditability.

create table if not exists public.verified_reports (
  id uuid primary key default gen_random_uuid(),

  -- Location + signal classification.
  state text not null,
  signal_type text not null default 'verified_report'
    check (signal_type in (
      'symptom_trend', 'weather', 'aqi',
      'outbreak_alert', 'verified_report', 'historical_pattern'
    )),

  -- Approved, user-facing summary ONLY (no raw unverified media text).
  summary text not null check (length(trim(summary)) > 0),

  -- Provenance / credibility.
  source_url text,
  source_type text not null default 'official',
  credibility_level text not null default 'medium'
    check (credibility_level in ('low', 'medium', 'high')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  reviewed_by text,

  -- Time window for decay / expiry.
  occurred_at timestamptz not null default now(),
  expires_at timestamptz,

  -- Audit timestamps.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_verified_reports_state_status
  on public.verified_reports (state, verification_status);

create index if not exists idx_verified_reports_occurred_at
  on public.verified_reports (occurred_at desc);

-- ============================================================================
-- RLS: read verified+active rows for everyone; writes are service-role only.
-- ============================================================================
alter table public.verified_reports enable row level security;

-- Read policy: anon + authenticated can SELECT only verified, non-expired rows.
drop policy if exists "read verified active reports" on public.verified_reports;
create policy "read verified active reports"
  on public.verified_reports
  for select
  to anon, authenticated
  using (
    verification_status = 'verified'
    and (expires_at is null or expires_at > now())
  );

-- Admin write policy: service role has full access (server-side admin only).
drop policy if exists "service role full access verified_reports" on public.verified_reports;
create policy "service role full access verified_reports"
  on public.verified_reports
  for all
  to service_role
  using (true)
  with check (true);

-- Table grants: clients may read only; no write privileges. Service role full.
revoke all on table public.verified_reports from anon, authenticated;
grant select on table public.verified_reports to anon, authenticated;
grant select, insert, update, delete on table public.verified_reports to service_role;

-- ============================================================================
-- updated_at maintenance trigger.
-- ============================================================================
create or replace function public.set_verified_reports_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_verified_reports_updated_at on public.verified_reports;
create trigger trg_verified_reports_updated_at
  before update on public.verified_reports
  for each row execute function public.set_verified_reports_updated_at();

revoke all on function public.set_verified_reports_updated_at() from public;

comment on table public.verified_reports is
  'MedGuard Brain v1: admin-entered, reviewed public-health reports. Writes are '
  'service-role only (no in-app admin role). Clients read verified+active rows. '
  'Only approved summaries are stored for display; no raw unverified media text.';


-- === Legacy source: 023_symptom_trend_baseline_rpc_v2.sql ===
-- Migration: 023_symptom_trend_baseline_rpc_v2.sql
-- MedGuard Brain v1: full aggregate-only historical symptom trend baseline RPC.
--
-- SAFETY:
-- - Reads public.community_weekly_trends only.
-- - Returns state/week symptom aggregates only.
-- - Does not read or expose health_checkins, user IDs, emails, names, or raw
--   personal health records.
--
-- The function returns one row per symptom group for a state/current ISO week,
-- comparing current week counts with the previous four aggregate weeks.

drop function if exists public.get_symptom_trend_baseline(text, text);

create or replace function public.get_symptom_trend_baseline(
  p_state text,
  p_iso_week text default null
)
returns table (
  state text,
  symptom_group text,
  current_week_count integer,
  previous_4_week_average numeric,
  percentage_change numeric,
  classification text,
  confidence text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text;
  v_current_week text;
begin
  if coalesce(length(trim(p_state)), 0) = 0 then
    raise exception 'p_state is required';
  end if;

  v_state := lower(trim(p_state));

  v_current_week := coalesce(
    nullif(trim(p_iso_week), ''),
    (
      select t.iso_week
      from public.community_weekly_trends t
      where lower(t.state) = v_state
      order by t.iso_week desc
      limit 1
    )
  );

  if v_current_week is null then
    return;
  end if;

  return query
  with current_week as (
    select
      lower(t.state) as state_norm,
      t.total_checkins,
      t.fever_count,
      t.headache_count,
      t.fatigue_count,
      t.digestive_count,
      t.water_exposure_count,
      t.sick_contact_count,
      t.elevated_risk_count
    from public.community_weekly_trends t
    where lower(t.state) = v_state
      and t.iso_week = v_current_week
    limit 1
  ),
  prior_weeks as (
    select
      t.total_checkins,
      t.fever_count,
      t.headache_count,
      t.fatigue_count,
      t.digestive_count,
      t.water_exposure_count,
      t.sick_contact_count,
      t.elevated_risk_count
    from public.community_weekly_trends t
    where lower(t.state) = v_state
      and t.iso_week < v_current_week
    order by t.iso_week desc
    limit 4
  ),
  baseline as (
    select
      count(*)::integer as baseline_weeks,
      coalesce(avg(total_checkins), 0)::numeric as avg_total_checkins,
      coalesce(sum(total_checkins), 0)::integer as baseline_sample_total
    from prior_weeks
  ),
  groups as (
    select 'fever' as symptom_group,
      coalesce((select fever_count from current_week), 0)::integer as cur,
      coalesce((select avg(fever_count) from prior_weeks), 0)::numeric as avg4w
    union all
    select 'headache',
      coalesce((select headache_count from current_week), 0)::integer,
      coalesce((select avg(headache_count) from prior_weeks), 0)::numeric
    union all
    select 'fatigue',
      coalesce((select fatigue_count from current_week), 0)::integer,
      coalesce((select avg(fatigue_count) from prior_weeks), 0)::numeric
    union all
    select 'digestive',
      coalesce((select digestive_count from current_week), 0)::integer,
      coalesce((select avg(digestive_count) from prior_weeks), 0)::numeric
    union all
    select 'water_exposure',
      coalesce((select water_exposure_count from current_week), 0)::integer,
      coalesce((select avg(water_exposure_count) from prior_weeks), 0)::numeric
    union all
    select 'sick_contact',
      coalesce((select sick_contact_count from current_week), 0)::integer,
      coalesce((select avg(sick_contact_count) from prior_weeks), 0)::numeric
    union all
    select 'elevated_risk',
      coalesce((select elevated_risk_count from current_week), 0)::integer,
      coalesce((select avg(elevated_risk_count) from prior_weeks), 0)::numeric
  ),
  scored as (
    select
      coalesce((select state_norm from current_week), v_state) as state_out,
      g.symptom_group,
      g.cur,
      g.avg4w,
      case
        when g.avg4w > 0 then ((g.cur - g.avg4w) / g.avg4w) * 100
        when g.cur > 0 then 100
        else 0
      end as pct_change,
      coalesce((select total_checkins from current_week), 0) as current_sample_size,
      coalesce((select baseline_weeks from baseline), 0) as baseline_weeks,
      coalesce((select avg_total_checkins from baseline), 0) as avg_total_checkins,
      coalesce((select baseline_sample_total from baseline), 0) as baseline_sample_total
    from groups g
  )
  select
    s.state_out as state,
    s.symptom_group,
    s.cur as current_week_count,
    round(s.avg4w, 2) as previous_4_week_average,
    round(s.pct_change, 2) as percentage_change,
    case
      -- Sparse current or baseline data must not produce elevated/rising alerts.
      when s.current_sample_size < 5 or s.baseline_weeks < 2 or s.baseline_sample_total < 10 then 'normal'
      -- Very low symptom counts are too noisy for elevated claims.
      when s.cur < 3 and s.avg4w < 2 then 'normal'
      -- Elevated: enough sample size and sharply above baseline.
      when s.current_sample_size >= 10
        and s.baseline_sample_total >= 20
        and s.cur >= greatest(ceil(s.avg4w * 2.0)::integer, 5)
        then 'elevated'
      -- Rising: meaningfully above baseline with enough current signal.
      when s.cur >= greatest(ceil(s.avg4w * 1.5)::integer, 3)
        and s.cur > s.avg4w
        then 'rising'
      else 'normal'
    end as classification,
    case
      when s.current_sample_size < 5 or s.baseline_weeks < 2 or s.baseline_sample_total < 10 then 'low'
      when s.current_sample_size >= 20 and s.baseline_weeks >= 4 and s.baseline_sample_total >= 40 then 'high'
      else 'medium'
    end as confidence
  from scored s;
end;
$$;

comment on function public.get_symptom_trend_baseline(text, text) is
  'MedGuard Brain v1: returns aggregate-only state symptom trend baseline rows '
  '(current week vs previous four aggregate weeks) with normal/rising/elevated '
  'classification and low/medium/high confidence. Reads community_weekly_trends '
  'only and never exposes raw personal health data.';

revoke all on function public.get_symptom_trend_baseline(text, text) from public;
revoke all on function public.get_symptom_trend_baseline(text, text) from anon;
grant execute on function public.get_symptom_trend_baseline(text, text) to authenticated;
grant execute on function public.get_symptom_trend_baseline(text, text) to service_role;


-- === Legacy source: 024_auth_security_hardening.sql ===
-- Migration: 024_auth_security_hardening.sql
-- Restrict the Data API and privileged functions to the minimum roles needed.

-- Anonymous users should not have table privileges for private account and
-- health data. RLS remains enabled as a second layer of protection.
revoke all on table public.api_rate_limits from anon;
revoke all on table public.chat_conversations from anon;
revoke all on table public.chat_messages from anon;
revoke all on table public.community_weekly_trends from anon;
revoke all on table public.freetext_symptoms from anon;
revoke all on table public.health_checkins from anon;
revoke all on table public.health_streaks from anon;
revoke all on table public.intel_cache from anon;
revoke all on table public.notification_log from anon;
revoke all on table public.notification_preferences from anon;
revoke all on table public.profiles from anon;
revoke all on table public.risk_snapshots from anon;
revoke all on table public.symptom_logs from anon;
revoke all on table public.user_context from anon;

-- Rebuild authenticated table grants explicitly instead of inheriting the
-- broad defaults that previously exposed every operation in the Data API.
revoke all on table public.api_rate_limits from authenticated;
revoke all on table public.intel_cache from authenticated;
revoke all on table public.profiles from authenticated;
revoke all on table public.symptom_logs from authenticated;
revoke all on table public.risk_snapshots from authenticated;
revoke all on table public.user_context from authenticated;
revoke all on table public.chat_conversations from authenticated;
revoke all on table public.chat_messages from authenticated;
revoke all on table public.health_checkins from authenticated;
revoke all on table public.health_streaks from authenticated;
revoke all on table public.freetext_symptoms from authenticated;
revoke all on table public.community_weekly_trends from authenticated;
revoke all on table public.notification_preferences from authenticated;
revoke all on table public.notification_log from authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.symptom_logs to authenticated;
grant select, insert on table public.risk_snapshots to authenticated;
grant select, insert, update on table public.user_context to authenticated;
grant select, insert, update, delete on table public.chat_conversations to authenticated;
grant select, insert, delete on table public.chat_messages to authenticated;
grant select, insert, update on table public.health_checkins to authenticated;
grant select, insert, update on table public.health_streaks to authenticated;
grant select, insert on table public.freetext_symptoms to authenticated;
grant select on table public.community_weekly_trends to authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select on table public.notification_log to authenticated;

-- Verified, unexpired reports are intentionally public awareness data.
grant select on table public.verified_reports to anon, authenticated;

-- User-owned policies must apply only to authenticated users. UPDATE policies
-- include WITH CHECK so ownership cannot be reassigned during an update.
alter policy "Users can view own profile" on public.profiles
  to authenticated using ((select auth.uid()) = id);
alter policy "Users can insert own profile" on public.profiles
  to authenticated with check ((select auth.uid()) = id);
alter policy "Users can update own profile" on public.profiles
  to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
alter policy "Users can delete own profile" on public.profiles
  to authenticated using ((select auth.uid()) = id);

alter policy "Users can view own symptom logs" on public.symptom_logs
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can insert own symptom logs" on public.symptom_logs
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "Users can update own symptom logs" on public.symptom_logs
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users can delete own symptom logs" on public.symptom_logs
  to authenticated using ((select auth.uid()) = user_id);

alter policy "Users can view own risk snapshots" on public.risk_snapshots
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can insert own risk snapshots" on public.risk_snapshots
  to authenticated with check ((select auth.uid()) = user_id);

alter policy "Users can view own context" on public.user_context
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can upsert own context" on public.user_context
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "Users can update own context" on public.user_context
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can view own conversations" on public.chat_conversations
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can insert own conversations" on public.chat_conversations
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "Users can update own conversations" on public.chat_conversations
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users can delete own conversations" on public.chat_conversations
  to authenticated using ((select auth.uid()) = user_id);

alter policy "Users can view messages from own conversations" on public.chat_messages
  to authenticated using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );
alter policy "Users can insert messages to own conversations" on public.chat_messages
  to authenticated with check (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );
alter policy "Users can delete messages from own conversations" on public.chat_messages
  to authenticated using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

alter policy "Users can view own checkins" on public.health_checkins
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can insert own checkins" on public.health_checkins
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "Users can update own checkins" on public.health_checkins
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can view own streak" on public.health_streaks
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can upsert own streak" on public.health_streaks
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "Users can update own streak" on public.health_streaks
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can view own freetext" on public.freetext_symptoms
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can insert own freetext" on public.freetext_symptoms
  to authenticated with check ((select auth.uid()) = user_id);

alter policy "Users can view own notification prefs" on public.notification_preferences
  to authenticated using ((select auth.uid()) = user_id);
alter policy "Users can upsert own notification prefs" on public.notification_preferences
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "Users can update own notification prefs" on public.notification_preferences
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users can view own notifications" on public.notification_log
  to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can view community trends"
  on public.community_weekly_trends;
create policy "Authenticated users can view community trends"
  on public.community_weekly_trends for select
  to authenticated
  using (true);

drop policy if exists "service role full access api_rate_limits"
  on public.api_rate_limits;
create policy "service role full access api_rate_limits"
  on public.api_rate_limits for all
  to service_role
  using (true)
  with check (true);

-- SECURITY DEFINER functions are internal server/trigger surfaces, not public
-- client APIs. Trigger functions continue to execute through their triggers.
revoke all on function public.aggregate_community_trends(text, text) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.cleanup_expired_api_rate_limits() from public, anon, authenticated;
revoke all on function public.get_symptom_trend_baseline(text, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.should_send_checkin_reminder(uuid) from public, anon, authenticated;
revoke all on function public.trg_aggregate_after_checkin() from public, anon, authenticated;

grant execute on function public.aggregate_community_trends(text, text) to service_role;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.cleanup_expired_api_rate_limits() to service_role;
grant execute on function public.get_symptom_trend_baseline(text, text) to service_role;
grant execute on function public.should_send_checkin_reminder(uuid) to service_role;


-- === Legacy source: 025_profile_medical_info.sql ===
-- 025_profile_medical_info.sql
-- Adds user-managed medical history to profiles: chronic conditions, allergies,
-- and current medications. These are personal, user-owned fields used to make
-- the chatbot's guidance safer and more relevant (e.g. respecting allergies).
--
-- Privacy: profiles already has row-level security where a user can only read
-- and write their own row, so no new policies are required. These columns are
-- never exposed to other users or written to any shared cache.

alter table public.profiles
  add column if not exists conditions  text[] not null default '{}',
  add column if not exists allergies   text[] not null default '{}',
  add column if not exists medications text[] not null default '{}';


-- === Legacy source: 026_intel_refresh_cron.sql ===
-- 026_intel_refresh_cron.sql
-- Makes the area health signal genuinely "always on": a scheduled job warms the
-- intel_cache for the busiest states so `generatedAt` freshness is real, not faked.
--
-- OPTIONAL / has a cost: each refresh calls the (billable) Google Weather + Air
-- Quality APIs. Keep the state list short and the interval modest. If you'd rather
-- not run a cron, skip this file — the app still computes fresh data on demand
-- (15-min cache) and the report page shows the true "updated X ago" time.
--
-- PREREQUISITES (run/manage in the Supabase dashboard or SQL editor):
--   1. Enable extensions pg_cron and pg_net (Database → Extensions).
--   2. Store two Vault secrets (Project Settings → Vault), so no keys live here:
--        project_url  = https://cddfhyxlhtmrrtduwlqd.supabase.co
--        anon_key     = <your Supabase anon/publishable key>
--      The intel function has verify_jwt=true, so the anon key (a valid JWT) is
--      required on the call.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Warms a representative set of high-population states. Adjust the list to trade
-- freshness/coverage against Google API spend.
create or replace function public.refresh_intel_cache()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url   text;
  v_key   text;
  v_state text;
  v_states text[] := array['Lagos','Kano','Rivers','FCT','Oyo','Kaduna'];
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'anon_key';
  if v_url is null or v_key is null then
    raise notice 'refresh_intel_cache: missing Vault secrets project_url/anon_key; skipping';
    return;
  end if;

  foreach v_state in array v_states loop
    perform net.http_post(
      url     := v_url || '/functions/v1/intel',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object('state', v_state)
    );
  end loop;
end;
$$;

-- Re-create the schedule idempotently (unschedule prior run if present).
do $$
begin
  perform cron.unschedule('refresh-intel-cache');
exception when others then
  null;
end;
$$;

select cron.schedule('refresh-intel-cache', '0 * * * *', $$select public.refresh_intel_cache();$$);


-- === Legacy source: 027_body_metrics_steps_score_cycle.sql ===
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


-- === Legacy source: 028_notify_area_cron.sql ===
-- 028_notify_area_cron.sql
-- Schedules the notify-area push dispatcher (official outbreak alerts).
--
-- OPTIONAL. Push is only DELIVERED once Firebase Cloud Messaging (FCM) is
-- configured for the Expo project and users have opted into community alerts;
-- until then the dispatcher finds no push tokens and sends nothing.
--
-- PREREQUISITES (dashboard / SQL editor):
--   1. Enable extensions pg_cron and pg_net.
--   2. Vault secrets (Project Settings -> Vault):
--        project_url        = https://cddfhyxlhtmrrtduwlqd.supabase.co
--        notify_cron_secret = <random string; also set as the NOTIFY_CRON_SECRET
--                              function secret via `supabase secrets set`>

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.dispatch_area_notifications()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_cron_secret';
  if v_url is null then
    raise notice 'dispatch_area_notifications: missing Vault secret project_url; skipping';
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-area',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body    := '{}'::jsonb
  );
end;
$$;

do $$
begin
  perform cron.unschedule('dispatch-area-notifications');
exception when others then
  null;
end;
$$;

-- Every 30 minutes.
select cron.schedule('dispatch-area-notifications', '*/30 * * * *', $$select public.dispatch_area_notifications();$$);


-- === Legacy source: 029_risk_forecast.sql ===
-- Migration: 029_risk_forecast.sql
-- MedGuard predictive model: per-state disease RISK PROJECTIONS.
--
-- PURPOSE:
--   Store ML-generated, forward-looking risk projections (start with malaria)
--   that the Brain layer surfaces as a PROJECTION signal — never an outbreak
--   confirmation and never a diagnosis. Official outbreaks remain NCDC/WHO-only
--   via public.verified_reports; this table holds model output, attributed to a
--   model_version for transparency.
--
-- WRITE MODEL (consistent with verified_reports / app_version_policy):
--   Rows are written SERVER-SIDE ONLY using the Supabase service role (the
--   external ml/predict_and_write.py job). Mobile clients (anon, authenticated)
--   get READ access to active rows only and have NO write rights.

create table if not exists public.risk_forecast (
  id uuid primary key default gen_random_uuid(),

  -- Location + disease.
  state text not null,
  disease text not null default 'malaria',

  -- Forecast window: projection for the period starting forecast_period_start,
  -- looking forecast_horizon_days ahead of when it was generated.
  forecast_period_start date not null,
  forecast_horizon_days int not null default 28,

  -- Model output (framed as projection).
  projected_risk_level text not null
    check (projected_risk_level in ('low', 'moderate', 'elevated', 'high')),
  risk_score numeric,                       -- continuous model output (e.g. projected case load or 0..1)
  confidence numeric,                       -- 0..1 model confidence
  driver_factors text[] not null default '{}',  -- top contributing features, for the "why"
  summary text,                             -- safe, projection-framed user-facing text

  -- Provenance.
  model_version text not null default 'malaria_v1',
  generated_at timestamptz not null default now(),
  valid_until timestamptz not null,         -- clients/Brain ignore rows past this

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One current projection per state+disease+period (upsert target).
  unique (state, disease, forecast_period_start, model_version)
);

create index if not exists idx_risk_forecast_state_disease_generated
  on public.risk_forecast (state, disease, generated_at desc);

create index if not exists idx_risk_forecast_valid_until
  on public.risk_forecast (valid_until);

-- ============================================================================
-- RLS: read active rows for everyone; writes are service-role only.
-- ============================================================================
alter table public.risk_forecast enable row level security;

drop policy if exists "read active risk forecasts" on public.risk_forecast;
create policy "read active risk forecasts"
  on public.risk_forecast
  for select
  to anon, authenticated
  using (valid_until > now());

drop policy if exists "service role full access risk_forecast" on public.risk_forecast;
create policy "service role full access risk_forecast"
  on public.risk_forecast
  for all
  to service_role
  using (true)
  with check (true);

-- Table grants: clients read-only; service role full.
revoke all on table public.risk_forecast from anon, authenticated;
grant select on table public.risk_forecast to anon, authenticated;
grant select, insert, update, delete on table public.risk_forecast to service_role;

-- ============================================================================
-- updated_at maintenance trigger.
-- ============================================================================
create or replace function public.set_risk_forecast_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_risk_forecast_updated_at on public.risk_forecast;
create trigger trg_risk_forecast_updated_at
  before update on public.risk_forecast
  for each row execute function public.set_risk_forecast_updated_at();

revoke all on function public.set_risk_forecast_updated_at() from public;

comment on table public.risk_forecast is
  'MedGuard predictive model: per-state forward-looking disease RISK PROJECTIONS '
  '(malaria first). Written service-role only by the offline ml/ job; clients read '
  'active rows. Surfaced by the Brain as a projection — never an outbreak '
  'confirmation or diagnosis.';


-- === Legacy source: 030_ussd_sms.sql ===
-- Migration: 030_ussd_sms.sql
-- MedGuard last-mile reach: USSD + SMS outbreak alerts.
--
-- WHY:
--   The Nigerians most exposed to Lassa fever / cholera outbreaks are rural and
--   on feature phones — an app-only alert channel structurally excludes them.
--   These tables back a USSD menu (dial-in disease-risk lookup + free alert
--   subscription) and an SMS dispatcher that pushes attributed alerts when a
--   state's projected risk rises or an official NCDC/WHO report lands.
--
-- WRITE MODEL:
--   Written SERVER-SIDE ONLY by the `ussd` and `dispatch-sms-alerts` edge
--   functions using the Supabase service role. No mobile-client access.
--   Alert CONTENT still obeys the app's safety stance: model output is framed
--   as a projection (never an outbreak confirmation); only public.verified_reports
--   drive "official" wording, always attributed. Nothing here diagnoses.

-- ============================================================================
-- Subscribers: one active subscription per phone number (MSISDN) → a state.
-- ============================================================================
create table if not exists public.ussd_subscribers (
  id uuid primary key default gen_random_uuid(),
  msisdn text not null unique,               -- E.164-ish phone number from the USSD gateway
  state text not null,
  lga text,                                  -- optional finer targeting (future)
  language text not null default 'en',
  active boolean not null default true,      -- STOP opt-out flips this to false
  last_alerted_at timestamptz,               -- cooldown anchor for the dispatcher
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ussd_subscribers_state_active
  on public.ussd_subscribers (state, active);

-- ============================================================================
-- SMS outbox: every alert we send (or would send, in simulate mode) is logged
-- here. Doubles as the audit trail + the "messages that would go out" demo view.
-- ============================================================================
create table if not exists public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  msisdn text not null,
  state text,
  body text not null,
  reason text not null default 'forecast'     -- 'forecast' | 'verified_report'
    check (reason in ('forecast', 'verified_report')),
  ref_id text,                                -- risk_forecast.id or verified_reports.id
  status text not null default 'queued'       -- lifecycle / delivery status
    check (status in ('queued', 'sent', 'simulated', 'failed')),
  provider text,                              -- e.g. 'africastalking'
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_sms_outbox_msisdn_created
  on public.sms_outbox (msisdn, created_at desc);
create index if not exists idx_sms_outbox_status_created
  on public.sms_outbox (status, created_at desc);

-- ============================================================================
-- RLS: service-role only (edge functions). No anon/authenticated access — these
-- hold phone numbers (PII) and must never be readable by the mobile clients.
-- ============================================================================
alter table public.ussd_subscribers enable row level security;
alter table public.sms_outbox enable row level security;

drop policy if exists "service role ussd_subscribers" on public.ussd_subscribers;
create policy "service role ussd_subscribers"
  on public.ussd_subscribers for all to service_role using (true) with check (true);

drop policy if exists "service role sms_outbox" on public.sms_outbox;
create policy "service role sms_outbox"
  on public.sms_outbox for all to service_role using (true) with check (true);

revoke all on table public.ussd_subscribers from anon, authenticated;
revoke all on table public.sms_outbox from anon, authenticated;
grant select, insert, update, delete on table public.ussd_subscribers to service_role;
grant select, insert, update, delete on table public.sms_outbox to service_role;

-- updated_at maintenance for subscribers.
create or replace function public.set_ussd_subscribers_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ussd_subscribers_updated_at on public.ussd_subscribers;
create trigger trg_ussd_subscribers_updated_at
  before update on public.ussd_subscribers
  for each row execute function public.set_ussd_subscribers_updated_at();

revoke all on function public.set_ussd_subscribers_updated_at() from public;

comment on table public.ussd_subscribers is
  'MedGuard USSD alert subscribers (feature-phone last-mile reach). Service-role '
  'written by the ussd edge function; holds MSISDN PII, no client access.';
comment on table public.sms_outbox is
  'Log of outbound SMS alerts (status sent/simulated). Written by dispatch-sms-alerts.';


-- === Legacy source: 031_emergency_reports.sql ===
-- Migration: 031_emergency_reports.sql
-- MedGuard USSD option 4: citizen-reported health emergencies (feature-phone).
--
-- WHY:
--   A person in a rural LGA who has no app and no data should still be able to
--   raise their hand — "many people are sick here", "there's been a death",
--   "the water is unsafe" — by dialling a short code. Aggregated, these reports
--   let health authorities / partner hospitals spot a cluster in an area and
--   reach out. It is an EARLY-WARNING SIGNAL, never an outbreak confirmation and
--   never an emergency-dispatch (ambulance) service.
--
-- SAFETY / FRAMING (matches the app's locked stance):
--   * A citizen report is an unverified signal. It does NOT set outbreakConfirmed,
--     does NOT diagnose, and must never be surfaced to the public as "official".
--   * The USSD reply tells the reporter to call 112 for immediate danger, so no
--     one mistakes this for an ambulance.
--
-- WRITE MODEL:
--   Written SERVER-SIDE ONLY by the `ussd` edge function (service role). Holds
--   MSISDN (PII) + health info (sensitive) → no anon/authenticated access. A
--   future partner-hospital dashboard reads it via its own service-role backend.

create table if not exists public.emergency_reports (
  id uuid primary key default gen_random_uuid(),
  msisdn text not null,                         -- reporter's phone (for callback)
  state text not null,
  lga text,                                     -- self-reported town/LGA (free text)
  category text not null default 'other'        -- nature of the emergency
    check (category in ('mass_illness', 'death', 'unsafe_water', 'other')),
  raw_text text,                                -- full USSD input, for audit
  status text not null default 'new'            -- triage lifecycle
    check (status in ('new', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by text,                         -- partner/staff id who picked it up
  acknowledged_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cluster lookups: "what has been reported in this state/LGA recently?"
create index if not exists idx_emergency_reports_state_created
  on public.emergency_reports (state, created_at desc);
create index if not exists idx_emergency_reports_status_created
  on public.emergency_reports (status, created_at desc);

-- ============================================================================
-- RLS: service-role only. PII (phone) + sensitive health signal → no client access.
-- ============================================================================
alter table public.emergency_reports enable row level security;

drop policy if exists "service role emergency_reports" on public.emergency_reports;
create policy "service role emergency_reports"
  on public.emergency_reports for all to service_role using (true) with check (true);

revoke all on table public.emergency_reports from anon, authenticated;
grant select, insert, update, delete on table public.emergency_reports to service_role;

-- updated_at maintenance.
create or replace function public.set_emergency_reports_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_emergency_reports_updated_at on public.emergency_reports;
create trigger trg_emergency_reports_updated_at
  before update on public.emergency_reports
  for each row execute function public.set_emergency_reports_updated_at();

revoke all on function public.set_emergency_reports_updated_at() from public;

comment on table public.emergency_reports is
  'Citizen-reported health emergencies via USSD (last-mile early warning). '
  'Service-role written by the ussd edge function; MSISDN PII + sensitive, no client access. '
  'A signal for partner outreach — never an outbreak confirmation or ambulance dispatch.';


-- === Legacy source: 032_health_feed.sql ===
-- Migration: 032_health_feed.sql
-- MedGuard Health News & Alerts feed (auto-ingested) + USSD/SMS delivery of posts.
--
-- WHY:
--   MedGuard already relays official NCDC/WHO outbreak reports via public.verified_reports
--   (migration 022) — but those are entered by hand, and there is no general "news / blog /
--   daily prevention tips" surface. This table backs an AUTO-INGESTED feed: a scheduled job
--   pulls what NCDC/WHO/ReliefWeb publish and writes attributed posts here; the app reads them
--   as a Health News feed, and USSD subscribers can receive the FULL TEXT by SMS (feature phones
--   can't open links).
--
-- WRITE MODEL / SAFETY (matches the app's locked stance):
--   Written SERVER-SIDE ONLY (service role) by the ingestion job. Official posts are stored
--   ATTRIBUTED (source + source_url + published date) using the publisher's own wording — never
--   paraphrased into new claims, and MedGuard never self-declares an outbreak. Prevention tips are
--   educational and non-diagnostic. Clients get READ access to published, non-expired rows only.

-- ============================================================================
-- health_posts: the feed. `body` is the full post text (this is what gets SMS'd).
-- ============================================================================
create table if not exists public.health_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'official_update'
    check (category in ('official_update', 'outbreak_news', 'prevention_tip', 'announcement')),
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),   -- full text (SMS + detail view)
  summary text,                                         -- short blurb for feed cards
  disease text,                                         -- optional tag: lassa|malaria|cholera|...
  state text,                                           -- optional; null = national
  source text not null default 'MedGuard',              -- e.g. NCDC, WHO, ReliefWeb, MedGuard
  source_url text,
  image_url text,
  published_at timestamptz not null default now(),
  expires_at timestamptz,                               -- null = never expires
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  external_id text unique,                              -- dedupe key for ingested items
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_posts_category_published
  on public.health_posts (category, published_at desc);
create index if not exists idx_health_posts_published
  on public.health_posts (published_at desc);

-- ============================================================================
-- RLS: read published + non-expired for everyone; writes are service-role only
-- (mirrors public.verified_reports, migration 022).
-- ============================================================================
alter table public.health_posts enable row level security;

drop policy if exists "read published health posts" on public.health_posts;
create policy "read published health posts"
  on public.health_posts
  for select
  to anon, authenticated
  using (status = 'published' and (expires_at is null or expires_at > now()));

drop policy if exists "service role full access health_posts" on public.health_posts;
create policy "service role full access health_posts"
  on public.health_posts
  for all
  to service_role
  using (true) with check (true);

revoke all on table public.health_posts from anon, authenticated;
grant select on table public.health_posts to anon, authenticated;
grant select, insert, update, delete on table public.health_posts to service_role;

-- updated_at maintenance.
create or replace function public.set_health_posts_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_health_posts_updated_at on public.health_posts;
create trigger trg_health_posts_updated_at
  before update on public.health_posts
  for each row execute function public.set_health_posts_updated_at();

revoke all on function public.set_health_posts_updated_at() from public;

comment on table public.health_posts is
  'MedGuard Health News feed: auto-ingested official (NCDC/WHO/ReliefWeb) updates + curated '
  'prevention tips. Service-role written; attributed relays, never self-declared. `body` = full '
  'text used for the detail view and full-text SMS. Clients read published, non-expired rows.';

-- ============================================================================
-- Subscribers: opt-in to news, plus a weekly-tip-digest cooldown anchor.
-- (public.ussd_subscribers created in migration 030.)
-- ============================================================================
alter table public.ussd_subscribers
  add column if not exists news_opt_in boolean not null default true;
alter table public.ussd_subscribers
  add column if not exists last_tip_digest_at timestamptz;

-- ============================================================================
-- sms_outbox: allow the two new dispatch reasons (created in migration 030).
-- ============================================================================
alter table public.sms_outbox drop constraint if exists sms_outbox_reason_check;
alter table public.sms_outbox add constraint sms_outbox_reason_check
  check (reason in ('forecast', 'verified_report', 'health_post', 'tip_digest'));


-- === Legacy source: 033_push_dispatch.sql ===
-- 033_push_dispatch.sql
-- Extends notification_log to support two new server-push types and per-item
-- dedupe, so the push dispatcher can send each health-news post / risk-tier
-- change to a given user at most once.
--
-- Safe to run once. Manual apply (like all MedGuard migrations).

-- 1. Allow the new notification types.
alter table public.notification_log
  drop constraint if exists notification_log_notification_type_check;

alter table public.notification_log
  add constraint notification_log_notification_type_check
  check (notification_type in (
    'checkin_reminder',
    'community_trend',
    'streak_milestone',
    'health_post',   -- new official health-news post pushed to the user
    'risk_change',   -- the user's state risk tier rose in the weekly forecast
    'general'
  ));

-- 2. Per-item dedupe key: which post / which forecast period this row is for.
--    NULL for types that dedupe by cooldown (e.g. community_trend).
alter table public.notification_log
  add column if not exists ref_id text;

-- Fast "have we already pushed <ref_id> to <user>?" lookups.
create index if not exists idx_notification_log_dedupe
  on public.notification_log (user_id, notification_type, ref_id);


-- === Legacy source: 034_secure_automation_and_ussd.sql ===
-- 034_secure_automation_and_ussd.sql
--
-- Security hardening for privileged pg_cron jobs. These functions must remain
-- callable by their postgres owner for cron, but must never be callable as a
-- PostgREST RPC by PUBLIC, anon, authenticated, or service_role.

begin;

create or replace function public.refresh_intel_cache()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url   text;
  v_key   text;
  v_state text;
  v_states text[] := array['Lagos','Kano','Rivers','FCT','Oyo','Kaduna'];
begin
  select secrets.decrypted_secret
    into v_url
    from vault.decrypted_secrets as secrets
   where secrets.name = 'project_url';
  select secrets.decrypted_secret
    into v_key
    from vault.decrypted_secrets as secrets
   where secrets.name = 'anon_key';

  if v_url is null or v_key is null then
    raise exception 'refresh_intel_cache requires project_url and anon_key Vault secrets';
  end if;

  foreach v_state in array v_states loop
    perform net.http_post(
      url     := v_url || '/functions/v1/intel',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object('state', v_state)
    );
  end loop;
end;
$$;

create or replace function public.dispatch_area_notifications()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select secrets.decrypted_secret
    into v_url
    from vault.decrypted_secrets as secrets
   where secrets.name = 'project_url';
  select secrets.decrypted_secret
    into v_secret
    from vault.decrypted_secrets as secrets
   where secrets.name = 'notify_cron_secret';

  if v_url is null or v_secret is null or length(v_secret) < 32 then
    raise exception 'dispatch_area_notifications requires project_url and a 32+ character notify_cron_secret Vault secret';
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/notify-area',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function public.refresh_intel_cache() from public, anon, authenticated, service_role;
revoke all on function public.dispatch_area_notifications() from public, anon, authenticated, service_role;

-- The postgres owner retains its implicit privileges; this makes the intended
-- scheduler dependency explicit without reopening either RPC endpoint.
grant execute on function public.refresh_intel_cache() to postgres;
grant execute on function public.dispatch_area_notifications() to postgres;

comment on function public.refresh_intel_cache() is
  'Internal pg_cron job only. EXECUTE is intentionally revoked from PUBLIC and API roles.';
comment on function public.dispatch_area_notifications() is
  'Internal pg_cron job only. EXECUTE is intentionally revoked from PUBLIC and API roles.';

commit;


-- === Legacy source: 035_intel_refresh_timeout.sql ===
-- 035_intel_refresh_timeout.sql
--
-- The Intel Edge Function performs several upstream data lookups. pg_net was
-- cancelling the hourly warm-cache requests after five seconds, so give each
-- asynchronous callback an explicit bounded 30-second deadline.

begin;

create or replace function public.refresh_intel_cache()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_url   text;
  v_key   text;
  v_state text;
  v_states text[] := array['Lagos','Kano','Rivers','FCT','Oyo','Kaduna'];
begin
  select secrets.decrypted_secret
    into v_url
    from vault.decrypted_secrets as secrets
   where secrets.name = 'project_url';
  select secrets.decrypted_secret
    into v_key
    from vault.decrypted_secrets as secrets
   where secrets.name = 'anon_key';

  if v_url is null or v_key is null then
    raise exception 'refresh_intel_cache requires project_url and anon_key Vault secrets';
  end if;

  foreach v_state in array v_states loop
    perform net.http_post(
      url     := v_url || '/functions/v1/intel',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object('state', v_state),
      timeout_milliseconds := 30000
    );
  end loop;
end;
$$;

revoke all on function public.refresh_intel_cache() from public, anon, authenticated, service_role;
grant execute on function public.refresh_intel_cache() to postgres;

comment on function public.refresh_intel_cache() is
  'Internal pg_cron job only. 30-second pg_net deadline; EXECUTE is revoked from PUBLIC and API roles.';

commit;
