-- Personal-health access hardening and compact dashboard read model.
--
-- Apply only after the migration-history baseline has passed `supabase db reset`.
-- This migration intentionally does not change community aggregates: those data
-- sets remain anonymous and are handled by their own policies.

-- Every private health table must require both a table grant and a matching RLS
-- policy. Rebuild the policies instead of trying to amend legacy PUBLIC policies.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'profiles',
    'symptom_logs',
    'risk_snapshots',
    'health_checkins',
    'health_streaks',
    'health_score_daily',
    'user_daily_activity',
    'freetext_symptoms',
    'user_context',
    'user_cycle_logs',
    'user_cycle_settings',
    -- These legacy tables are not used by the current app. They remain fully
    -- locked until a future migration gives them a reviewed owner-only design.
    'body_metrics',
    'cycle_entries'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);

    for policy_name in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end;
$$;

-- App-used profile data. DELETE is deliberately absent: account deletion is a
-- separate, audited flow rather than a broad Data API permission.
grant select, insert, update on table public.profiles to authenticated;
create policy personal_profiles_select on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy personal_profiles_insert on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy personal_profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update, delete on table public.symptom_logs to authenticated;
create policy personal_symptom_logs_select on public.symptom_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_symptom_logs_insert on public.symptom_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_symptom_logs_update on public.symptom_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy personal_symptom_logs_delete on public.symptom_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert on table public.risk_snapshots to authenticated;
create policy personal_risk_snapshots_select on public.risk_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_risk_snapshots_insert on public.risk_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.health_checkins to authenticated;
create policy personal_health_checkins_select on public.health_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_health_checkins_insert on public.health_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_health_checkins_update on public.health_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.health_streaks to authenticated;
create policy personal_health_streaks_select on public.health_streaks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_health_streaks_insert on public.health_streaks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_health_streaks_update on public.health_streaks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.health_score_daily to authenticated;
create policy personal_health_scores_select on public.health_score_daily
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_health_scores_insert on public.health_score_daily
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_health_scores_update on public.health_score_daily
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.user_daily_activity to authenticated;
create policy personal_daily_activity_select on public.user_daily_activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_daily_activity_insert on public.user_daily_activity
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_daily_activity_update on public.user_daily_activity
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Free-text symptoms are stored for the owner only and are intentionally not
-- returned by the dashboard RPC or device cache.
grant select, insert on table public.freetext_symptoms to authenticated;
create policy personal_freetext_symptoms_select on public.freetext_symptoms
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_freetext_symptoms_insert on public.freetext_symptoms
  for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.user_context to authenticated;
create policy personal_user_context_select on public.user_context
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_user_context_insert on public.user_context
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_user_context_update on public.user_context
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.user_cycle_logs to authenticated;
create policy personal_cycle_logs_select on public.user_cycle_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_cycle_logs_insert on public.user_cycle_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_cycle_logs_update on public.user_cycle_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy personal_cycle_logs_delete on public.user_cycle_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on table public.user_cycle_settings to authenticated;
create policy personal_cycle_settings_select on public.user_cycle_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_cycle_settings_insert on public.user_cycle_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_cycle_settings_update on public.user_cycle_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Privileged legacy helper functions accepted an arbitrary user id. Only Edge
-- Functions using the service role need them; mobile clients must not call
-- these SECURITY DEFINER functions directly.
revoke all on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb)
  to service_role;
revoke all on function public.update_health_streak(uuid, date)
  from public, anon, authenticated;
grant execute on function public.update_health_streak(uuid, date) to service_role;

-- Compact, caller-owned dashboard. SECURITY INVOKER is intentional: it keeps
-- the function subject to the owner's RLS policies and never accepts a user id.
create or replace function public.get_personal_health_dashboard(recent_days integer default 7)
returns jsonb
language sql
security invoker
set search_path = public, auth
stable
as $$
  with caller as (
    select (select auth.uid()) as user_id,
           greatest(1, least(coalesce(recent_days, 7), 30)) as days
  ),
  profile_summary as (
    select jsonb_build_object(
      'name', p.name,
      'state', p.state,
      'height_cm', p.height_cm,
      'weight_kg', p.weight_kg,
      'cycle_tracking_enabled', p.cycle_tracking_enabled
    ) as value
    from public.profiles p join caller c on p.id = c.user_id
  ),
  today_checkin as (
    select to_jsonb(h) - 'user_id' - 'answers' as value
    from public.health_checkins h join caller c on h.user_id = c.user_id
    where h.checkin_date = current_date
    limit 1
  ),
  recent_checkins as (
    select coalesce(jsonb_agg(to_jsonb(h) - 'user_id' - 'answers' order by h.checkin_date desc), '[]'::jsonb) as value
    from (
      select h.*
      from public.health_checkins h join caller c on h.user_id = c.user_id
      order by h.checkin_date desc
      limit (select days from caller)
    ) h
  ),
  streak as (
    select jsonb_build_object(
      'current_streak', s.current_streak,
      'longest_streak', s.longest_streak,
      'last_checkin_date', s.last_checkin_date
    ) as value
    from public.health_streaks s join caller c on s.user_id = c.user_id
  ),
  score_trend as (
    select coalesce(jsonb_agg(jsonb_build_object('date', q.score_date, 'score', q.score) order by q.score_date), '[]'::jsonb) as value
    from (
      select s.score_date, s.score
      from public.health_score_daily s join caller c on s.user_id = c.user_id
      order by s.score_date desc
      limit (select days from caller)
    ) q
  ),
  activity_trend as (
    select coalesce(jsonb_agg(jsonb_build_object('date', q.activity_date, 'steps', q.step_count) order by q.activity_date), '[]'::jsonb) as value
    from (
      select a.activity_date, a.step_count
      from public.user_daily_activity a join caller c on a.user_id = c.user_id
      order by a.activity_date desc
      limit (select days from caller)
    ) q
  )
  select jsonb_build_object(
    'profile', coalesce((select value from profile_summary), '{}'::jsonb),
    'today_checkin', (select value from today_checkin),
    'streak', coalesce((select value from streak), jsonb_build_object('current_streak', 0, 'longest_streak', 0, 'last_checkin_date', null)),
    'recent_checkins', (select value from recent_checkins),
    'score_trend', (select value from score_trend),
    'activity_trend', (select value from activity_trend)
  )
  where (select user_id from caller) is not null;
$$;

revoke all on function public.get_personal_health_dashboard(integer) from public, anon;
grant execute on function public.get_personal_health_dashboard(integer) to authenticated;

comment on function public.get_personal_health_dashboard(integer) is
  'Caller-owned compact personal dashboard. Excludes free text, cycle entries, detailed conditions, allergies, medications, and avatar URLs.';
