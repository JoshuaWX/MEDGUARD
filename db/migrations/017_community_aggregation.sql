-- Migration: 017_community_aggregation.sql
-- Community trend aggregation function
--
-- PUBLIC HEALTH REASONING:
-- - Aggregates anonymous check-in data into weekly state-level trends
-- - No user identifiers are stored in community_weekly_trends
-- - Enables community health awareness without individual exposure
-- - Trend direction calculated for week-over-week comparison

-- ============================================================================
-- AGGREGATE COMMUNITY TRENDS FUNCTION
-- Call periodically (e.g. daily cron, or after each check-in via trigger)
-- Upserts into community_weekly_trends for a given iso_week + state
-- ============================================================================
create or replace function aggregate_community_trends(
  p_iso_week text default null,
  p_state text default null
) returns void as $$
declare
  v_iso_week text;
  v_prev_week text;
  rec record;
begin
  -- Default to current ISO week if not provided
  v_iso_week := coalesce(p_iso_week, get_iso_week(current_date));

  -- Calculate previous week string for trend direction
  v_prev_week := get_iso_week((current_date - interval '7 days')::date);

  -- Aggregate check-ins grouped by (iso_week, state)
  for rec in
    select
      c.iso_week,
      c.state,
      count(*)::int                                        as total_checkins,
      count(*) filter (where c.has_fever)::int             as fever_count,
      count(*) filter (where c.has_headache)::int          as headache_count,
      count(*) filter (where c.has_fatigue)::int           as fatigue_count,
      count(*) filter (where c.has_digestive_issues)::int  as digestive_count,
      count(*) filter (where c.has_water_exposure)::int    as water_exposure_count,
      count(*) filter (where c.has_sick_contact)::int      as sick_contact_count,
      count(*) filter (where c.risk_level = 'low')::int        as low_risk_count,
      count(*) filter (where c.risk_level = 'moderate')::int   as moderate_risk_count,
      count(*) filter (where c.risk_level = 'elevated')::int   as elevated_risk_count
    from health_checkins c
    where c.iso_week = v_iso_week
      and c.state is not null
      and (p_state is null or c.state = p_state)
    group by c.iso_week, c.state
  loop
    -- Look up previous week total for trend direction
    declare
      v_prev_total int;
      v_direction text;
    begin
      select total_checkins into v_prev_total
        from community_weekly_trends
        where iso_week = v_prev_week
          and state = rec.state;

      if v_prev_total is null then
        v_direction := null;
      elsif rec.total_checkins > v_prev_total * 1.1 then
        v_direction := 'increasing';
      elsif rec.total_checkins < v_prev_total * 0.9 then
        v_direction := 'decreasing';
      else
        v_direction := 'stable';
      end if;

      -- Upsert into community_weekly_trends
      insert into community_weekly_trends (
        iso_week, state,
        fever_count, headache_count, fatigue_count,
        digestive_count, water_exposure_count, sick_contact_count,
        low_risk_count, moderate_risk_count, elevated_risk_count,
        total_checkins, prev_week_total, trend_direction,
        computed_at
      ) values (
        rec.iso_week, rec.state,
        rec.fever_count, rec.headache_count, rec.fatigue_count,
        rec.digestive_count, rec.water_exposure_count, rec.sick_contact_count,
        rec.low_risk_count, rec.moderate_risk_count, rec.elevated_risk_count,
        rec.total_checkins, v_prev_total, v_direction,
        now()
      )
      on conflict (iso_week, state) do update set
        fever_count           = excluded.fever_count,
        headache_count        = excluded.headache_count,
        fatigue_count         = excluded.fatigue_count,
        digestive_count       = excluded.digestive_count,
        water_exposure_count  = excluded.water_exposure_count,
        sick_contact_count    = excluded.sick_contact_count,
        low_risk_count        = excluded.low_risk_count,
        moderate_risk_count   = excluded.moderate_risk_count,
        elevated_risk_count   = excluded.elevated_risk_count,
        total_checkins        = excluded.total_checkins,
        prev_week_total       = excluded.prev_week_total,
        trend_direction       = excluded.trend_direction,
        computed_at           = now();
    end;
  end loop;
end;
$$ language plpgsql security definer
set search_path = public;

-- ============================================================================
-- TRIGGER: Auto-aggregate after each check-in submission
-- Re-aggregates the current week + state on every new check-in
-- ============================================================================
create or replace function trg_aggregate_after_checkin()
returns trigger as $$
begin
  -- Only aggregate if state is known
  if new.state is not null then
    perform aggregate_community_trends(new.iso_week, new.state);
  end if;
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

-- Drop existing trigger if present, then create
drop trigger if exists checkin_aggregate_trigger on health_checkins;

create trigger checkin_aggregate_trigger
  after insert on health_checkins
  for each row
  execute function trg_aggregate_after_checkin();

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on function aggregate_community_trends is
  'Aggregates anonymous health check-in data into weekly state-level community trends. '
  'Can be called ad-hoc or via the after-insert trigger on health_checkins.';

comment on function trg_aggregate_after_checkin is
  'Trigger function that re-aggregates community trends for the inserted check-in''s week and state.';
