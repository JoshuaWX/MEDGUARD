-- Migration: 031_emergency_reports.sql
-- MedGuard USSD option 4: citizen-reported health emergencies (feature-phone).
--
-- WHY:
--   A person in a rural LGA who has no app and no data should still be able to
--   raise their hand — "many people are sick here", "there's been a death",
--   "the water is unsafe" — by dialling a short code. Aggregated, these reports
--   let health authorities / partner hospitals spot a cluster in an area and
--   reach out. It is an EARLY-WARNING SIGNAL, never an outbreak confirmation and
--   never an emergency-dispatch (ambulance) service.
--
-- SAFETY / FRAMING (matches the app's locked stance):
--   * A citizen report is an unverified signal. It does NOT set outbreakConfirmed,
--     does NOT diagnose, and must never be surfaced to the public as "official".
--   * The USSD reply tells the reporter to call 112 for immediate danger, so no
--     one mistakes this for an ambulance.
--
-- WRITE MODEL:
--   Written SERVER-SIDE ONLY by the `ussd` edge function (service role). Holds
--   MSISDN (PII) + health info (sensitive) → no anon/authenticated access. A
--   future partner-hospital dashboard reads it via its own service-role backend.

create table if not exists public.emergency_reports (
  id uuid primary key default gen_random_uuid(),
  msisdn text not null,                         -- reporter's phone (for callback)
  state text not null,
  lga text,                                     -- self-reported town/LGA (free text)
  category text not null default 'other'        -- nature of the emergency
    check (category in ('mass_illness', 'death', 'unsafe_water', 'other')),
  raw_text text,                                -- full USSD input, for audit
  status text not null default 'new'            -- triage lifecycle
    check (status in ('new', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by text,                         -- partner/staff id who picked it up
  acknowledged_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cluster lookups: "what has been reported in this state/LGA recently?"
create index if not exists idx_emergency_reports_state_created
  on public.emergency_reports (state, created_at desc);
create index if not exists idx_emergency_reports_status_created
  on public.emergency_reports (status, created_at desc);

-- ============================================================================
-- RLS: service-role only. PII (phone) + sensitive health signal → no client access.
-- ============================================================================
alter table public.emergency_reports enable row level security;

drop policy if exists "service role emergency_reports" on public.emergency_reports;
create policy "service role emergency_reports"
  on public.emergency_reports for all to service_role using (true) with check (true);

revoke all on table public.emergency_reports from anon, authenticated;
grant select, insert, update, delete on table public.emergency_reports to service_role;

-- updated_at maintenance.
create or replace function public.set_emergency_reports_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_emergency_reports_updated_at on public.emergency_reports;
create trigger trg_emergency_reports_updated_at
  before update on public.emergency_reports
  for each row execute function public.set_emergency_reports_updated_at();

revoke all on function public.set_emergency_reports_updated_at() from public;

comment on table public.emergency_reports is
  'Citizen-reported health emergencies via USSD (last-mile early warning). '
  'Service-role written by the ussd edge function; MSISDN PII + sensitive, no client access. '
  'A signal for partner outreach — never an outbreak confirmation or ambulance dispatch.';
