-- MedGuard Brain v1: aggregate symptom trend baseline RPC smoke checks.
--
-- Paste into Supabase SQL Editor after applying migration 023.
-- This script inserts temporary aggregate-only rows, validates the RPC, then
-- rolls everything back so no test data remains.

begin;

insert into public.community_weekly_trends (
  iso_week,
  state,
  fever_count,
  total_checkins
) values
  ('2026-W01', '__trend_normal__', 5, 30),
  ('2026-W02', '__trend_normal__', 5, 30),
  ('2026-W03', '__trend_normal__', 5, 30),
  ('2026-W04', '__trend_normal__', 5, 30),
  ('2026-W05', '__trend_normal__', 6, 30),

  ('2026-W01', '__trend_rising__', 5, 30),
  ('2026-W02', '__trend_rising__', 5, 30),
  ('2026-W03', '__trend_rising__', 5, 30),
  ('2026-W04', '__trend_rising__', 5, 30),
  ('2026-W05', '__trend_rising__', 8, 30),

  ('2026-W01', '__trend_elevated__', 4, 30),
  ('2026-W02', '__trend_elevated__', 4, 30),
  ('2026-W03', '__trend_elevated__', 4, 30),
  ('2026-W04', '__trend_elevated__', 4, 30),
  ('2026-W05', '__trend_elevated__', 10, 30),

  ('2026-W04', '__trend_sparse__', 1, 4),
  ('2026-W05', '__trend_sparse__', 4, 4)
on conflict (iso_week, state) do update set
  fever_count = excluded.fever_count,
  total_checkins = excluded.total_checkins,
  computed_at = now();

do $$
begin
  if not exists (
    select 1
    from public.get_symptom_trend_baseline('__trend_normal__', '2026-W05')
    where symptom_group = 'fever'
      and current_week_count = 6
      and previous_4_week_average = 5
      and classification = 'normal'
      and confidence = 'high'
  ) then
    raise exception 'normal trend check failed';
  end if;

  if not exists (
    select 1
    from public.get_symptom_trend_baseline('__trend_rising__', '2026-W05')
    where symptom_group = 'fever'
      and current_week_count = 8
      and previous_4_week_average = 5
      and percentage_change = 60
      and classification = 'rising'
      and confidence = 'high'
  ) then
    raise exception 'rising trend check failed';
  end if;

  if not exists (
    select 1
    from public.get_symptom_trend_baseline('__trend_elevated__', '2026-W05')
    where symptom_group = 'fever'
      and current_week_count = 10
      and previous_4_week_average = 4
      and percentage_change = 150
      and classification = 'elevated'
      and confidence = 'high'
  ) then
    raise exception 'elevated trend check failed';
  end if;

  if not exists (
    select 1
    from public.get_symptom_trend_baseline('__trend_sparse__', '2026-W05')
    where symptom_group = 'fever'
      and classification = 'normal'
      and confidence = 'low'
  ) then
    raise exception 'sparse/low-confidence check failed';
  end if;
end $$;

rollback;
