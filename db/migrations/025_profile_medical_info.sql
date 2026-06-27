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
