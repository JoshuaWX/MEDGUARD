-- Migration: 029_risk_forecast.sql
-- MedGuard predictive model: per-state disease RISK PROJECTIONS.
--
-- PURPOSE:
--   Store ML-generated, forward-looking risk projections (start with malaria)
--   that the Brain layer surfaces as a PROJECTION signal — never an outbreak
--   confirmation and never a diagnosis. Official outbreaks remain NCDC/WHO-only
--   via public.verified_reports; this table holds model output, attributed to a
--   model_version for transparency.
--
-- WRITE MODEL (consistent with verified_reports / app_version_policy):
--   Rows are written SERVER-SIDE ONLY using the Supabase service role (the
--   external ml/predict_and_write.py job). Mobile clients (anon, authenticated)
--   get READ access to active rows only and have NO write rights.

create table if not exists public.risk_forecast (
  id uuid primary key default gen_random_uuid(),

  -- Location + disease.
  state text not null,
  disease text not null default 'malaria',

  -- Forecast window: projection for the period starting forecast_period_start,
  -- looking forecast_horizon_days ahead of when it was generated.
  forecast_period_start date not null,
  forecast_horizon_days int not null default 28,

  -- Model output (framed as projection).
  projected_risk_level text not null
    check (projected_risk_level in ('low', 'moderate', 'elevated', 'high')),
  risk_score numeric,                       -- continuous model output (e.g. projected case load or 0..1)
  confidence numeric,                       -- 0..1 model confidence
  driver_factors text[] not null default '{}',  -- top contributing features, for the "why"
  summary text,                             -- safe, projection-framed user-facing text

  -- Provenance.
  model_version text not null default 'malaria_v1',
  generated_at timestamptz not null default now(),
  valid_until timestamptz not null,         -- clients/Brain ignore rows past this

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One current projection per state+disease+period (upsert target).
  unique (state, disease, forecast_period_start, model_version)
);

create index if not exists idx_risk_forecast_state_disease_generated
  on public.risk_forecast (state, disease, generated_at desc);

create index if not exists idx_risk_forecast_valid_until
  on public.risk_forecast (valid_until);

-- ============================================================================
-- RLS: read active rows for everyone; writes are service-role only.
-- ============================================================================
alter table public.risk_forecast enable row level security;

drop policy if exists "read active risk forecasts" on public.risk_forecast;
create policy "read active risk forecasts"
  on public.risk_forecast
  for select
  to anon, authenticated
  using (valid_until > now());

drop policy if exists "service role full access risk_forecast" on public.risk_forecast;
create policy "service role full access risk_forecast"
  on public.risk_forecast
  for all
  to service_role
  using (true)
  with check (true);

-- Table grants: clients read-only; service role full.
revoke all on table public.risk_forecast from anon, authenticated;
grant select on table public.risk_forecast to anon, authenticated;
grant select, insert, update, delete on table public.risk_forecast to service_role;

-- ============================================================================
-- updated_at maintenance trigger.
-- ============================================================================
create or replace function public.set_risk_forecast_updated_at()
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

drop trigger if exists trg_risk_forecast_updated_at on public.risk_forecast;
create trigger trg_risk_forecast_updated_at
  before update on public.risk_forecast
  for each row execute function public.set_risk_forecast_updated_at();

revoke all on function public.set_risk_forecast_updated_at() from public;

comment on table public.risk_forecast is
  'MedGuard predictive model: per-state forward-looking disease RISK PROJECTIONS '
  '(malaria first). Written service-role only by the offline ml/ job; clients read '
  'active rows. Surfaced by the Brain as a projection — never an outbreak '
  'confirmation or diagnosis.';
