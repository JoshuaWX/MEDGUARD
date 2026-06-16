-- Migration: 022_verified_reports.sql
-- MedGuard Brain v1 (Phase 5): admin-entered verified media/health reports.
--
-- PURPOSE:
--   Store carefully reviewed, attributable public-health reports that the Brain
--   layer can surface as a strong, high-confidence signal. Only the approved
--   `summary` is shown to users; raw unverified media text is never stored here
--   for user display.
--
-- ADMIN-ONLY WRITE (defined BEFORE RLS):
--   MedGuard does not (yet) have an in-app admin role, and we must not rewrite
--   auth. Consistent with public.app_version_policy (migration 020), writes to
--   this table are performed SERVER-SIDE ONLY using the Supabase service role
--   (admin tooling / dashboard / trusted Edge Function). The mobile clients
--   (anon, authenticated) get READ access to verified + active rows only and
--   have NO insert/update/delete rights. The `reviewed_by` column records the
--   human/admin who approved each report for auditability.

create table if not exists public.verified_reports (
  id uuid primary key default gen_random_uuid(),

  -- Location + signal classification.
  state text not null,
  signal_type text not null default 'verified_report'
    check (signal_type in (
      'symptom_trend', 'weather', 'aqi',
      'outbreak_alert', 'verified_report', 'historical_pattern'
    )),

  -- Approved, user-facing summary ONLY (no raw unverified media text).
  summary text not null check (length(trim(summary)) > 0),

  -- Provenance / credibility.
  source_url text,
  source_type text not null default 'official',
  credibility_level text not null default 'medium'
    check (credibility_level in ('low', 'medium', 'high')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  reviewed_by text,

  -- Time window for decay / expiry.
  occurred_at timestamptz not null default now(),
  expires_at timestamptz,

  -- Audit timestamps.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_verified_reports_state_status
  on public.verified_reports (state, verification_status);

create index if not exists idx_verified_reports_occurred_at
  on public.verified_reports (occurred_at desc);

-- ============================================================================
-- RLS: read verified+active rows for everyone; writes are service-role only.
-- ============================================================================
alter table public.verified_reports enable row level security;

-- Read policy: anon + authenticated can SELECT only verified, non-expired rows.
drop policy if exists "read verified active reports" on public.verified_reports;
create policy "read verified active reports"
  on public.verified_reports
  for select
  to anon, authenticated
  using (
    verification_status = 'verified'
    and (expires_at is null or expires_at > now())
  );

-- Admin write policy: service role has full access (server-side admin only).
drop policy if exists "service role full access verified_reports" on public.verified_reports;
create policy "service role full access verified_reports"
  on public.verified_reports
  for all
  to service_role
  using (true)
  with check (true);

-- Table grants: clients may read only; no write privileges. Service role full.
revoke all on table public.verified_reports from anon, authenticated;
grant select on table public.verified_reports to anon, authenticated;
grant select, insert, update, delete on table public.verified_reports to service_role;

-- ============================================================================
-- updated_at maintenance trigger.
-- ============================================================================
create or replace function public.set_verified_reports_updated_at()
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

drop trigger if exists trg_verified_reports_updated_at on public.verified_reports;
create trigger trg_verified_reports_updated_at
  before update on public.verified_reports
  for each row execute function public.set_verified_reports_updated_at();

revoke all on function public.set_verified_reports_updated_at() from public;

comment on table public.verified_reports is
  'MedGuard Brain v1: admin-entered, reviewed public-health reports. Writes are '
  'service-role only (no in-app admin role). Clients read verified+active rows. '
  'Only approved summaries are stored for display; no raw unverified media text.';
