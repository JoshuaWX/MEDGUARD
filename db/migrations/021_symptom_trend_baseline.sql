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
