# MedGuard

MedGuard is a Nigeria-first mobile health-awareness prototype. It helps people see locally relevant health signals, read attributable official updates, keep lightweight personal check-ins, and find nearby care. It is an awareness tool—not a diagnosis, emergency service, or substitute for a clinician.

## Product status

The production path is the Expo mobile app and Supabase backend. The project is still a prototype and uses conservative, clearly labelled risk estimates and official-source attribution.

## Repository map

| Path | Purpose |
| --- | --- |
| `mobile-expo/` | Expo/React Native Android and iOS application |
| `supabase/migrations/` | Canonical, timestamped production migration ledger |
| `supabase/functions/` | Authenticated Edge Functions, notification jobs, intel and news ingestion |
| `ml/` | Weekly state-level risk forecast pipelines |
| `docs/` | Setup, security, and legacy-prototype notes |

`db/migrations/` is historical source material only. Do not replay it or add new migrations there.

## Architecture

```text
Expo app ── Authenticated Supabase client ── Supabase Auth/Postgres/Storage
   │                                      └─ pg_cron → protected Edge Functions
   └─ notification/deep-link routes            └─ official feeds + forecast jobs
```

Personal records are protected by grants and row-level security. The app receives personal data only for the signed-in user; area signals and official news are separately scoped and labelled.

## Local setup

Prerequisites: Node.js 20+, Expo tooling, Docker (for local Supabase), and the Supabase CLI.

```bash
npm ci
cd mobile-expo && npm ci
npx expo start
```

Create `mobile-expo/.env` from `.env.example` with Expo-safe public values only:

```ini
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Never put service-role, AI-provider, database, or notification secrets in the mobile app or Git.

## Verification

```bash
npm run verify
supabase start
supabase db reset
supabase test db
```

`npm run verify` runs the mobile TypeScript check, runtime contracts, and notification Edge tests. Use a native Expo build—not Expo Go—for Health Connect, background location, and remote push validation.

## Supabase workflow

The canonical workflow is:

```bash
supabase migration new <description>
supabase db reset
supabase test db
supabase functions deploy <function-name>
```

Review the migration and linked project state before production deployment. Do not use `supabase db push` while migration history is being reconciled.

## Safety and privacy

- Risk language is a projection or estimate and never confirms an outbreak.
- Official news keeps its source URL, publisher, and publication time.
- Location sharing, notifications, background location, and step access are opt-in and user-scoped.
- Personal-health tables use RLS; free-text symptoms and notes are not included in dashboard caches.

Read [SECURITY.md](SECURITY.md) before contributing. MedGuard is proprietary; see [LICENSE.md](LICENSE.md).

## Roadmap

Next work focuses on measured native-device validation, production observability, source freshness, and a careful transition from prototype to a supported service.
