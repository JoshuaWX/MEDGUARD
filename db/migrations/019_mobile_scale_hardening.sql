-- Migration: Mobile production hardening and scale-readiness
-- Date: 2026-06-11
-- Purpose: tighten public RPC grants and prevent user-id spoofing in user-owned helper functions.

-- upsert_user_context is called through authenticated Edge/client context.
-- It should never allow a caller to write context for another user id.
create or replace function public.upsert_user_context(
  p_user_id uuid,
  p_state text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_season_label text default null,
  p_care_mode text default null,
  p_care_mode_meta jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'forbidden';
  end if;

  insert into public.user_context (
    user_id,
    state,
    latitude,
    longitude,
    season_label,
    care_mode,
    care_mode_meta,
    updated_at
  )
  values (
    p_user_id,
    p_state,
    p_latitude,
    p_longitude,
    p_season_label,
    coalesce(p_care_mode, 'default'),
    coalesce(p_care_mode_meta, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update set
    state = coalesce(excluded.state, public.user_context.state),
    latitude = coalesce(excluded.latitude, public.user_context.latitude),
    longitude = coalesce(excluded.longitude, public.user_context.longitude),
    season_label = coalesce(excluded.season_label, public.user_context.season_label),
    care_mode = coalesce(excluded.care_mode, public.user_context.care_mode),
    care_mode_meta = coalesce(excluded.care_mode_meta, public.user_context.care_mode_meta),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) from public;
revoke all on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) from anon;
grant execute on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) to authenticated;
grant execute on function public.upsert_user_context(uuid, text, double precision, double precision, text, text, jsonb) to service_role;

-- update_health_streak mutates user-owned streak rows and must not bypass RLS for arbitrary ids.
create or replace function public.update_health_streak(p_user_id uuid, p_checkin_date date)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_last_date date;
  v_current int;
  v_longest int;
  v_new_streak int;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'forbidden';
  end if;

  select last_checkin_date, current_streak, longest_streak
  into v_last_date, v_current, v_longest
  from public.health_streaks
  where user_id = p_user_id;

  if not found then
    insert into public.health_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_checkin_date,
      updated_at
    )
    values (p_user_id, 1, 1, p_checkin_date, now());
    return;
  end if;

  if v_last_date = p_checkin_date - 1 then
    v_new_streak := v_current + 1;
  elsif v_last_date = p_checkin_date then
    return;
  else
    v_new_streak := 1;
  end if;

  update public.health_streaks
  set current_streak = v_new_streak,
      longest_streak = greatest(v_longest, v_new_streak),
      last_checkin_date = p_checkin_date,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.update_health_streak(uuid, date) from public;
revoke all on function public.update_health_streak(uuid, date) from anon;
grant execute on function public.update_health_streak(uuid, date) to authenticated;
grant execute on function public.update_health_streak(uuid, date) to service_role;

-- Pure helper functions can remain callable, but do not need definer privileges.
alter function public.calculate_checkin_risk_level(boolean, boolean, boolean, boolean, boolean, boolean)
  security invoker;
alter function public.get_iso_week(date)
  security invoker;
