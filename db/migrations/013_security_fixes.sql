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
