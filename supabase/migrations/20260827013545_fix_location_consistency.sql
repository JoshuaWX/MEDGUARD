-- Canonical alert-location model.
-- profiles.state is the active alert state. manual_state is the state used
-- whenever the user has disabled GPS-based location sharing.

alter table public.profiles
  add column if not exists use_location boolean,
  add column if not exists manual_state text,
  add column if not exists background_location_enabled boolean not null default false,
  add column if not exists location_observed_at timestamptz,
  add column if not exists location_accuracy_meters double precision;

update public.profiles
set manual_state = state
where manual_state is null and state is not null;

update public.profiles
set use_location = true
where use_location is null;

alter table public.profiles
  alter column use_location set default true,
  alter column use_location set not null;

alter table public.profiles
  drop constraint if exists profiles_background_location_requires_sharing;
alter table public.profiles
  add constraint profiles_background_location_requires_sharing
  check (not background_location_enabled or use_location);

-- user_context retains care-mode fields but mirrors the authoritative area and
-- coordinates from profiles. The trigger also protects legacy profile writes
-- from leaving the two tables inconsistent.
create or replace function public.sync_profile_location_to_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_context (user_id, state, latitude, longitude, updated_at)
  values (new.id, new.state, new.latitude, new.longitude, now())
  on conflict (user_id) do update set
    state = excluded.state,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.sync_profile_location_to_context() from public, anon, authenticated;

-- user_context is a mirror, not a client-owned location write surface. Care
-- data continues to be preserved by the trigger's targeted UPSERT.
revoke insert, update on table public.user_context from authenticated;
drop policy if exists personal_user_context_insert on public.user_context;
drop policy if exists personal_user_context_update on public.user_context;

drop trigger if exists trg_sync_profile_location_to_context on public.profiles;
create trigger trg_sync_profile_location_to_context
  after insert or update of state, latitude, longitude on public.profiles
  for each row execute function public.sync_profile_location_to_context();

-- Bring legacy rows into alignment immediately without changing care settings.
insert into public.user_context (user_id, state, latitude, longitude, updated_at)
select p.id, p.state, p.latitude, p.longitude, now()
from public.profiles p
on conflict (user_id) do update set
  state = excluded.state,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- Only authenticated owners may change their own manual fallback state.
create or replace function public.set_manual_alert_state(p_manual_state text)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_state text := nullif(btrim(p_manual_state), '');
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if v_state is null or char_length(v_state) > 80 then
    raise exception 'A valid home state is required';
  end if;

  update public.profiles
  set manual_state = v_state,
      state = case when use_location then state else v_state end,
      updated_at = now()
  where id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return jsonb_build_object(
    'state', v_profile.state,
    'manual_state', v_profile.manual_state,
    'use_location', v_profile.use_location,
    'background_location_enabled', v_profile.background_location_enabled
  );
end;
$$;

-- Disabling sharing immediately removes precise coordinates and returns alerts
-- to the manual fallback state. Background tracking can never stay on alone.
create or replace function public.set_location_preferences(
  p_use_location boolean,
  p_background_location_enabled boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_use_location is null then
    raise exception 'Location sharing preference is required';
  end if;
  if coalesce(p_background_location_enabled, false) and not p_use_location then
    raise exception 'Background location requires location sharing';
  end if;

  update public.profiles
  set use_location = p_use_location,
      background_location_enabled = coalesce(p_background_location_enabled, false) and p_use_location,
      state = case when p_use_location then state else coalesce(manual_state, state) end,
      latitude = case when p_use_location then latitude else null end,
      longitude = case when p_use_location then longitude else null end,
      location_accuracy_meters = case when p_use_location then location_accuracy_meters else null end,
      location_observed_at = case when p_use_location then location_observed_at else null end,
      updated_at = now()
  where id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return jsonb_build_object(
    'state', v_profile.state,
    'manual_state', v_profile.manual_state,
    'use_location', v_profile.use_location,
    'background_location_enabled', v_profile.background_location_enabled
  );
end;
$$;

-- The Edge Function supplies the server-geocoded Nigerian state. An observation
-- timestamp prevents an old asynchronous GPS result from overwriting a newer one.
create or replace function public.record_verified_location(
  p_state text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_observed_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_state text := nullif(btrim(p_state), '');
  v_observed_at timestamptz := coalesce(p_observed_at, now());
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if v_state is null or char_length(v_state) > 80 then
    raise exception 'A valid verified state is required';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'Invalid latitude or longitude';
  end if;
  if p_accuracy_meters is not null and (p_accuracy_meters < 0 or p_accuracy_meters > 100000) then
    raise exception 'Invalid location accuracy';
  end if;

  update public.profiles
  set state = v_state,
      latitude = p_latitude,
      longitude = p_longitude,
      location_accuracy_meters = p_accuracy_meters,
      location_observed_at = v_observed_at,
      updated_at = now()
  where id = v_user_id
    and use_location = true
    and (location_observed_at is null or location_observed_at <= v_observed_at)
  returning * into v_profile;

  if not found then
    select * into v_profile from public.profiles where id = v_user_id;
  end if;
  if not found then
    raise exception 'Profile not found';
  end if;

  return jsonb_build_object(
    'state', v_profile.state,
    'manual_state', v_profile.manual_state,
    'use_location', v_profile.use_location,
    'background_location_enabled', v_profile.background_location_enabled,
    'location_observed_at', v_profile.location_observed_at
  );
end;
$$;

revoke all on function public.set_manual_alert_state(text) from public, anon;
revoke all on function public.set_location_preferences(boolean, boolean) from public, anon;
revoke all on function public.record_verified_location(text, double precision, double precision, double precision, timestamptz) from public, anon;
grant execute on function public.set_manual_alert_state(text) to authenticated;
grant execute on function public.set_location_preferences(boolean, boolean) to authenticated;
grant execute on function public.record_verified_location(text, double precision, double precision, double precision, timestamptz) to authenticated;

comment on column public.profiles.state is 'Effective alert area. GPS-derived while use_location is enabled; manual_state otherwise.';
comment on column public.profiles.manual_state is 'User-selected fallback alert area used when GPS location sharing is disabled or unavailable.';
