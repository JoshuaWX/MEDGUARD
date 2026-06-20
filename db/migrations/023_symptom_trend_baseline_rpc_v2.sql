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
