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
