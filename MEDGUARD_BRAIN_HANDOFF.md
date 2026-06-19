# MedGuard Brain v1 — Handoff Note (read this first)

> You are continuing work on MedGuard after the user switched Codex from the
> Virtuals proxy to OpenAI. The previous chat is LOST. This note tells you what
> exists, what is done, what is left, and the known risks. Read it fully before
> acting. Do not redo completed phases.

Workspace: C:\dev-folder\MEDGUARD
Active app: mobile-expo/ (Expo SDK 54, RN, TS). Backend: supabase/functions/.
Schema: db/migrations/. Legacy/ignore: root src/, server/, Vite, Flask chatbot,
root *.html mockups.

## What the project is
MedGuard Brain v1 = a hybrid, deterministic public-health "signal fusion + risk
forecasting" layer that EVOLVES the existing `intel` Edge Function. It is NOT a
trained ML model and NOT a chatbot. It answers: "what health-risk signals are
rising in this area, why, how confident are we, and what safe action to take?"
Safety stance is absolute: awareness only, NEVER diagnosis, NEVER outbreak
confirmation, no prescriptions, no panic language.

## The plan = 6 phases, gated by user review. ALL 6 ARE IMPLEMENTED.
The user reviewed and approved each phase one at a time. Work was done strictly
phase-by-phase. Current status: Phase 1–6 complete and locally validated.
Nothing has been committed (all changes are uncommitted in the working tree).
Nothing has been deployed. Migrations 021/022 have NOT been run on a real DB.

## How to verify current state fast
- Backend tests (Deno): `deno test --allow-read supabase/functions/`
  EXPECT: 54 passed / 0 failed.
- Backend type-check: `deno check --config supabase/functions/deno.json supabase/functions/intel/index.ts`
- Mobile type-check: `cd mobile-expo; npx tsc --noEmit` EXPECT: 0 errors.
- `git status` will show modified intel/index.ts, mobile hooks/screens, and many
  untracked brain modules + migrations 021/022.
Note: `deno` lives at C:\Users\Admin\AppData\Roaming\npm\deno.ps1. The function
files use bare `std/` specifiers, so always pass `--config supabase/functions/deno.json`
for `deno check`. Tests download std deps on first run (allow time).

## What each phase delivered (done)
PHASE 1 — Instrument intel, no behavior change.
  - Added safe structured logger `logIntel(event, fields)` in
    supabase/functions/intel/index.ts (24 log sites: fetch_weather/aqi/outbreaks/
    who *_ok/_error/_unavailable, cache_hit/miss, rate_limit_allowed/blocked,
    request_received, response_built/failed, brain_built/error, personal_brain_*).
  - SAFETY: never logs JWTs/keys/emails/raw health/coords (only coarse flags).
  - Froze response shape: supabase/functions/intel/__tests__/
    intel-response-shape.test.ts + .snapshot.json.

PHASE 2 — Wrap-first Brain modules (pure, no fetch moved, intel untouched then).
  Created supabase/functions/_shared/brain/ (all PURE, no IO):
  types.ts, safetyGuardrails.ts, analyzeWeather.ts, analyzeAqi.ts,
  analyzeOutbreakAlerts.ts, analyzeCheckins.ts (personal), analyzeSymptomTrends.ts,
  analyzeVerifiedReports.ts (verified-only + >14d decay), calculateRiskScore.ts
  (Low/Moderate/Elevated; thresholds: score>=8 Elevated, >=3.5 Moderate),
  calculateConfidence.ts (Low/Medium/High), generateSafeExplanation.ts,
  collectSignals.ts, buildBrain.ts, personalAccess.ts (verifies JWT).

PHASE 3 — Emit Brain into intel + controlled LLM summary.
  - llmExplainer.ts: small dedicated OpenRouter->Gemini->Groq helper (same env
    names as chat: OPENROUTER_API_KEY/OPENROUTER_MODEL/GOOGLE_GEMINI_KEY/GROQ_API_KEY).
    NO RAG, NO chat history. Structured signals in -> summary string out, 6s
    timeout, never throws. recommendedActions stay deterministic; only summary
    may be LLM-phrased, and only if it passes safetyGuardrails (else deterministic
    fallback).
  - generateSafeExplanationAsync + buildBrainAsync added (sync versions kept).
  - intelAdapter.ts maps intel-computed values -> BrainBuildInput.
  - intel/index.ts now: builds AREA `brain` from already-fetched values and puts
    it in the response AND the shared cache. Computes `personalBrain` via
    attachPersonalBrain() ONLY when a verified authUserId exists, reading recent
    health_checkins through the RLS user client, attached to the RESPONSE ONLY
    and NEVER written to intel_cache (verified by a test).
  - LLM is behind env flag BRAIN_LLM_SUMMARY (default OFF => fully deterministic).
  - Snapshot updated (reviewed) to include additive `brain`.

PHASE 4 — Historical baseline via SQL RPC (aggregates only).
  - db/migrations/021_symptom_trend_baseline.sql: get_symptom_trend_baseline(
    p_state, p_iso_week) returns current-week vs 4-week rolling avg per symptom
    group (normal/rising/elevated). Reads ANONYMOUS community_weekly_trends only,
    never health_checkins, no user_id. security definer, revoked from anon,
    granted to authenticated + service_role.
  - trendBaseline.ts loader (best-effort, []-on-error); wired into intel area brain.

PHASE 5 — Verified media reports (admin-entered, decay).
  - db/migrations/022_verified_reports.sql: table with id, state, signal_type,
    summary, source_url, source_type, credibility_level, verification_status,
    reviewed_by, occurred_at, expires_at, created_at, updated_at. RLS: anon/
    authenticated READ verified+non-expired only; writes are SERVICE-ROLE ONLY
    (admin-only write = server-side service key, consistent with migration 020;
    we did NOT add an in-app admin role, must not rewrite auth). updated_at trigger.
  - verifiedReportsLoader.ts wired into intel area brain. Only approved `summary`
    is surfaced; never raw unverified text. >14d/expired => weak/excluded.

PHASE 6 — Surface Brain in app + notification DESIGN only (no auto-push).
  - mobile-expo/src/services/brain.ts: read-only client types.
  - mobile-expo/src/components/BrainCard.tsx: non-alarmist card (risk+confidence,
    summary, actions, "awareness only" disclaimer; `compact` variant). Exported
    from components/index.ts.
  - useIntel.ts (IntelV2) + useAlerts.ts now expose optional brain/personalBrain.
  - HomeScreen, AlertsScreen, MapScreen each render BrainCard (only when present;
    Map uses compact). No UI/nav/auth redesign.
  - mobile-expo/src/services/brainNotifications.ts: evaluateNotificationTrigger()
    is PURE DECISION LOGIC ONLY (no scheduling/sending). Rules: opted-in +
    Elevated + Medium/High confidence + official/verified signal + outside 24h
    cooldown + non-panic + safe invariants.

## The 8 binding safety amendments the user required (all honored — keep honoring)
1. Personal data (health_checkins/user_context/profile) only when a valid user
   JWT is verified inside the function. No JWT => area brain only.
2/7. Personal brain NEVER in the shared intel_cache. Area brain may be cached.
3. Wrap-first: don't do risky rewrites; intel fetch logic was NOT moved.
4. LLM is a small controlled explanation layer only — NOT the chat/RAG pipeline;
   summary phrasing only; deterministic fallback; never authors actions/risk.
5. verified_reports has all required fields + decay; aggregates-only RPC.
6. NO automatic push yet — notification logic is design-only.
8. diagnosis:false and outbreakConfirmed:false always forced.

## What is LEFT / not done (the deferred cleanup — user said fix AFTER all phases)
ALL PHASES ARE DONE. The remaining work is the consolidated risk/cleanup pass the
user deferred. Do these next (ask the user to confirm scope first):

1. BUNDLE DRIFT (highest priority before any dashboard deploy):
   - supabase/functions/_bundled/intel.txt is STALE. It (a) is missing the entire
     rate-limit block (enforceRateLimit/429 + authUserId logic) that exists in the
     real supabase/functions/intel/index.ts, and (b) does NOT inline any of the new
     _shared/brain/* modules or the Phase 1 logging.
   - There is also a stray supabase/functions/intel/index.bundled.deploy.txt.
   - Supabase dashboard deploys can't use relative imports, so intel ships as a
     single inlined file. Before deploying Phase 1–6, regenerate intel.txt by
     inlining: cors.ts, env.ts, supabase.ts, rate-limit.ts, risk-engine.ts, ALL
     _shared/brain/*.ts, then intel/index.ts. No bundler script exists yet
     (bundles are hand-maintained) — consider writing one.
   - See supabase/functions/_bundled/README.md for the deploy model.

2. RUN MIGRATIONS on the real Supabase project (no local psql/Supabase CLI here):
   apply 021_symptom_trend_baseline.sql and 022_verified_reports.sql. They were
   validated statically + by unit tests only, never executed against Postgres.

3. LLM PATH never exercised live: BRAIN_LLM_SUMMARY is OFF by default. If enabling,
   set provider keys as Supabase secrets and test latency/fallback. Tune the 6s
   timeout if needed.

4. NO mobile test runner exists. A Deno test for brainNotifications was removed
   because the RN tree uses extensionless imports (fine for Metro/tsc, rejected by
   deno strict). brainNotifications.ts/brain.ts are pure — if you want them tested,
   either add a proper RN test setup (jest) or relocate pure logic so deno can
   import with extensions. Don't bolt deno onto the RN tree.

5. personalBrain is typed + returned to screens but the cards currently render the
   AREA brain. Surfacing personalBrain in the UI is a future enhancement (no
   backend work needed).

6. Nothing is committed. If the user wants, create a branch (prefix codex/) and
   commit per-phase or as one Brain v1 changeset. Do NOT commit without asking.

## Key files to read when you resume (in order)
- This note.
- C:\Users\Admin\.codex\medguard-virtuals-handoff.md (older context).
- supabase/functions/intel/index.ts (see logIntel, attachPersonalBrain, area brain
  build, cache-vs-personal separation, BRAIN_LLM_SUMMARY).
- supabase/functions/_shared/brain/buildBrain.ts + collectSignals.ts (orchestration).
- supabase/functions/_shared/brain/safetyGuardrails.ts (the safety core).
- supabase/functions/_shared/brain/types.ts (contract).
- db/migrations/021_*.sql and 022_*.sql.
- mobile-expo/src/components/BrainCard.tsx + services/brain.ts + services/brainNotifications.ts.
- Tests: supabase/functions/_shared/brain/__tests__/ and intel/__tests__/.

## Output contract (the `brain` object shape)
brain = { scope:'area'|'personal', riskLevel:'Low'|'Moderate'|'Elevated',
  confidence:'Low'|'Medium'|'High', area, timeWindow, signals:[{type,severity,
  summary,evidence,source?,sourceId?}], summary, recommendedActions:[],
  diagnosis:false, outbreakConfirmed:false, meta:{schemaVersion:'brain_v1',
  signalsUsed, dataFreshness, generatedBy:'deterministic'|'llm-assisted'} }
personalBrain = same shape, scope:'personal', only on authenticated responses,
never cached.

## Hard constraints (do not violate)
No Clerk, no n8n, no new backend, no Vite/Node/localhost deps, don't rewrite auth/
nav/UI/animations, don't remove RLS, don't expose private keys in the Expo client,
no LLM diagnosis, no confirmed-outbreak claims. Preserve ALL existing intel
response keys (brain is purely additive).

## Ship-readiness update — 2026-06-16
The bundle drift cleanup has now been done locally:
- Added `scripts/build-intel-bundle.mjs` and package script `npm run supabase:bundle:intel`.
- Regenerated `supabase/functions/_bundled/intel.txt` from the real modular `intel/index.ts`.
- Verified regenerated bundle contains `logIntel`, `enforceRateLimit`, Brain modules, `BRAIN_LLM_SUMMARY`, area `brain`, and authenticated-only `personalBrain`.
- Removed stale tracked traps: `supabase/functions/intel/index.bundled.txt` and `supabase/functions/intel/index.bundled.deploy.txt`.
- Updated `supabase/functions/_bundled/README.md`; `intel` JWT now matches `supabase/config.toml` (`verify_jwt = true`).

Validation after cleanup:
- `deno test --allow-read supabase/functions/` => 54 passed / 0 failed.
- `deno check --config supabase/functions/deno.json supabase/functions/intel/index.ts` => passed.
- `npm run mobile:typecheck` => passed.
- `git diff --check` => passed, with only CRLF warnings.

Remote Supabase apply/deploy is still blocked in this shell:
- `SUPABASE_DB_PASSWORD` is unset, so `npx supabase db push --linked --dry-run` returns 401.
- `SUPABASE_ACCESS_TOKEN` / `SUPABASE_AUTH_TOKEN` are unset or unavailable, so `npx supabase functions list/deploy --project-ref cddfhyxlhtmrrtduwlqd` returns 401.

When credentials are available, run:
1. `$env:SUPABASE_DB_PASSWORD = '<remote-db-password>'`
2. `$env:SUPABASE_ACCESS_TOKEN = '<supabase-access-token>'`
3. `npx supabase db push --linked --dry-run`
4. `npx supabase db push --linked`
5. `npx supabase functions deploy intel --project-ref cddfhyxlhtmrrtduwlqd --use-api`
6. Call the deployed `intel` function as guest and signed-in user to verify `brain`, `personalBrain`, rate limiting, and safe wording.

Remote apply/deploy completed after `.env` was updated:
- `db push --linked --dry-run` is NOT used for this repo because canonical SQL lives in `db/migrations/`, not `supabase/migrations/`; the linked project has remote migration history not represented locally.
- Applied `db/migrations/021_symptom_trend_baseline.sql` with `npx supabase db query --linked --file ...`.
- Applied `db/migrations/022_verified_reports.sql` with `npx supabase db query --linked --file ...`.
- Verified `get_symptom_trend_baseline(text,text)` exists.
- Verified `public.verified_reports` exists, RLS is enabled, anon/authenticated have SELECT only, service_role has write privileges.
- Deployed `intel` with `npx supabase functions deploy intel --project-ref cddfhyxlhtmrrtduwlqd --use-api`.
- Live anon-key smoke test passed: deployed `intel` returned `brain`, preserved `riskAssessment`, forced `diagnosis:false` and `outbreakConfirmed:false`, and did not return `personalBrain` for anon access.
- Signed-in `personalBrain` live test still needs a real user access token/session from the app.
