-- Migration: 018_api_rate_limits.sql
-- Adds a lightweight, DB-backed rate limiting primitive for Edge Functions.

create table if not exists public.api_rate_limits (
  limiter_key text not null,
  window_seconds integer not null check (window_seconds > 0),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (limiter_key, window_seconds, window_start)
);

create index if not exists idx_api_rate_limits_expires_at
  on public.api_rate_limits (expires_at);

create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if coalesce(length(trim(p_key)), 0) = 0 then
    raise exception 'p_key is required';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be > 0';
  end if;

  if p_max_requests is null or p_max_requests <= 0 then
    raise exception 'p_max_requests must be > 0';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits (
    limiter_key,
    window_seconds,
    window_start,
    request_count,
    expires_at,
    updated_at
  ) values (
    p_key,
    p_window_seconds,
    v_window_start,
    1,
    v_reset_at,
    v_now
  )
  on conflict (limiter_key, window_seconds, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    expires_at = excluded.expires_at,
    updated_at = v_now
  returning request_count into v_count;

  return query
    select
      (v_count <= p_max_requests) as allowed,
      greatest(p_max_requests - v_count, 0) as remaining,
      v_reset_at as reset_at,
      v_count as current_count;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

alter table public.api_rate_limits enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'api_rate_limits'
      and policyname = 'service role full access api_rate_limits'
  ) then
    create policy "service role full access api_rate_limits"
      on public.api_rate_limits
      for all
      using ((select auth.role()) = 'service_role')
      with check ((select auth.role()) = 'service_role');
  end if;
end $$;

-- Best-effort cleanup helper for cron/manual execution.
create or replace function public.cleanup_expired_api_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.api_rate_limits
  where expires_at < now() - interval '1 hour';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_api_rate_limits() from public;
grant execute on function public.cleanup_expired_api_rate_limits() to service_role;
