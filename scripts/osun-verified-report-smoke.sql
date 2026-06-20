-- MedGuard Brain v1 smoke test helper: Osun verified report
--
-- Run manually in the Supabase SQL editor or with:
--   npx supabase db query --linked --file scripts/osun-verified-report-smoke.sql
--
-- Purpose:
-- - Inserts or refreshes one admin-controlled Osun verified report.
-- - Clears only Osun v2 intel cache rows so the next intel call rebuilds Brain.
-- - Leaves public writes disabled; this is an admin/service-role workflow only.

begin;

delete from public.verified_reports
where source_url = 'medguard://smoke/osun-brain-v1'
  or (
    lower(state) = 'osun'
    and reviewed_by = 'medguard-admin-smoke'
  );

insert into public.verified_reports (
  state,
  signal_type,
  summary,
  source_url,
  source_type,
  credibility_level,
  verification_status,
  occurred_at,
  expires_at,
  reviewed_by
)
values (
  'osun',
  'verified_report',
  'Smoke-test verified health signal for Osun. Use for Brain validation only; remove or let it expire before public demo data review.',
  'medguard://smoke/osun-brain-v1',
  'manual_review',
  'medium',
  'verified',
  now(),
  now() + interval '7 days',
  'medguard-admin-smoke'
);

delete from public.intel_cache
where scope = 'v2'
  and (
    region_key = 'osun'
    or region_key like 'osun\_%' escape '\'
  );

commit;

-- Suggested validation after running:
-- 1. Call the deployed intel Edge Function with {"state":"Osun"}.
-- 2. Confirm response.brain exists and remains non-diagnostic:
--    brain.diagnosis = false, brain.outbreakConfirmed = false.
-- 3. Confirm response.brain.meta.signalsUsed increases and includes the verified report signal.
