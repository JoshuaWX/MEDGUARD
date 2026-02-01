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
