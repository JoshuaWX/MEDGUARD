-- Migration: 020_app_version_policy.sql
-- Remote policy used by the mobile app to block unsupported builds.

create table if not exists public.app_version_policy (
  platform text primary key check (platform in ('android', 'ios')),
  min_supported_build integer not null default 1 check (min_supported_build > 0),
  latest_build integer not null default 1 check (latest_build > 0),
  force_update boolean not null default true,
  update_url text not null default '',
  message text not null default 'Please update MedGuard to continue receiving health alerts and safety guidance.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_version_policy (
  platform,
  min_supported_build,
  latest_build,
  force_update,
  update_url,
  message
)
values
  ('android', 1, 1, true, '', 'Please update MedGuard to continue receiving health alerts and safety guidance.'),
  ('ios', 1, 1, true, '', 'Please update MedGuard to continue receiving health alerts and safety guidance.')
on conflict (platform) do nothing;

alter table public.app_version_policy enable row level security;

drop policy if exists "service role full access app_version_policy" on public.app_version_policy;
create policy "service role full access app_version_policy"
  on public.app_version_policy
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.app_version_policy from anon, authenticated;
grant select, insert, update, delete on table public.app_version_policy to service_role;

create or replace function public.set_app_version_policy_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_version_policy_updated_at on public.app_version_policy;
create trigger trg_app_version_policy_updated_at
  before update on public.app_version_policy
  for each row execute function public.set_app_version_policy_updated_at();

revoke all on function public.set_app_version_policy_updated_at() from public;
