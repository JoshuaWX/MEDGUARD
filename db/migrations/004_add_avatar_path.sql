-- Add avatar_path column to profiles to store private Storage object path
alter table public.profiles
  add column if not exists avatar_path text;
