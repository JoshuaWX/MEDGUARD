-- Add avatar_url to profiles for storing public image URL
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text;
