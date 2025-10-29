-- Ensure avatar_url column exists on profiles for legacy compatibility
alter table public.profiles
  add column if not exists avatar_url text;
