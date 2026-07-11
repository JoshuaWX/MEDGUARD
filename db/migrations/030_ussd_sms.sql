-- Migration: 030_ussd_sms.sql
-- MedGuard last-mile reach: USSD + SMS outbreak alerts.
--
-- WHY:
--   The Nigerians most exposed to Lassa fever / cholera outbreaks are rural and
--   on feature phones — an app-only alert channel structurally excludes them.
--   These tables back a USSD menu (dial-in disease-risk lookup + free alert
--   subscription) and an SMS dispatcher that pushes attributed alerts when a
--   state's projected risk rises or an official NCDC/WHO report lands.
--
-- WRITE MODEL:
--   Written SERVER-SIDE ONLY by the `ussd` and `dispatch-sms-alerts` edge
--   functions using the Supabase service role. No mobile-client access.
--   Alert CONTENT still obeys the app's safety stance: model output is framed
--   as a projection (never an outbreak confirmation); only public.verified_reports
--   drive "official" wording, always attributed. Nothing here diagnoses.

-- ============================================================================
-- Subscribers: one active subscription per phone number (MSISDN) → a state.
-- ============================================================================
create table if not exists public.ussd_subscribers (
  id uuid primary key default gen_random_uuid(),
  msisdn text not null unique,               -- E.164-ish phone number from the USSD gateway
  state text not null,
  lga text,                                  -- optional finer targeting (future)
  language text not null default 'en',
  active boolean not null default true,      -- STOP opt-out flips this to false
  last_alerted_at timestamptz,               -- cooldown anchor for the dispatcher
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ussd_subscribers_state_active
  on public.ussd_subscribers (state, active);

-- ============================================================================
-- SMS outbox: every alert we send (or would send, in simulate mode) is logged
-- here. Doubles as the audit trail + the "messages that would go out" demo view.
-- ============================================================================
create table if not exists public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  msisdn text not null,
  state text,
  body text not null,
  reason text not null default 'forecast'     -- 'forecast' | 'verified_report'
    check (reason in ('forecast', 'verified_report')),
  ref_id text,                                -- risk_forecast.id or verified_reports.id
  status text not null default 'queued'       -- lifecycle / delivery status
    check (status in ('queued', 'sent', 'simulated', 'failed')),
  provider text,                              -- e.g. 'africastalking'
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_sms_outbox_msisdn_created
  on public.sms_outbox (msisdn, created_at desc);
create index if not exists idx_sms_outbox_status_created
  on public.sms_outbox (status, created_at desc);

-- ============================================================================
-- RLS: service-role only (edge functions). No anon/authenticated access — these
-- hold phone numbers (PII) and must never be readable by the mobile clients.
-- ============================================================================
alter table public.ussd_subscribers enable row level security;
alter table public.sms_outbox enable row level security;

drop policy if exists "service role ussd_subscribers" on public.ussd_subscribers;
create policy "service role ussd_subscribers"
  on public.ussd_subscribers for all to service_role using (true) with check (true);

drop policy if exists "service role sms_outbox" on public.sms_outbox;
create policy "service role sms_outbox"
  on public.sms_outbox for all to service_role using (true) with check (true);

revoke all on table public.ussd_subscribers from anon, authenticated;
revoke all on table public.sms_outbox from anon, authenticated;
grant select, insert, update, delete on table public.ussd_subscribers to service_role;
grant select, insert, update, delete on table public.sms_outbox to service_role;

-- updated_at maintenance for subscribers.
create or replace function public.set_ussd_subscribers_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ussd_subscribers_updated_at on public.ussd_subscribers;
create trigger trg_ussd_subscribers_updated_at
  before update on public.ussd_subscribers
  for each row execute function public.set_ussd_subscribers_updated_at();

revoke all on function public.set_ussd_subscribers_updated_at() from public;

comment on table public.ussd_subscribers is
  'MedGuard USSD alert subscribers (feature-phone last-mile reach). Service-role '
  'written by the ussd edge function; holds MSISDN PII, no client access.';
comment on table public.sms_outbox is
  'Log of outbound SMS alerts (status sent/simulated). Written by dispatch-sms-alerts.';
