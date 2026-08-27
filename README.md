# MedGuard

MedGuard is a **mobile-first health companion** built for **real Android/iOS devices**.

It combines:

- **Expo / React Native mobile app** (primary client)
- **Supabase backend** (Auth, Postgres, Storage)
- **Supabase Edge Functions** for server-side health “intel”, location verification, avatar URL signing, and AI chat (RAG)

The repo also contains earlier **static HTML prototypes** used to design the UI. Those are reference artifacts; the production experience lives in `mobile-expo/`.

---

## What MedGuard does (product overview)

MedGuard helps a user:

1. **Create an account** and complete onboarding.
2. **Get health intel** relevant to their location in Nigeria (season, weather-driven risks, outbreak headlines).
3. **Chat with an AI health assistant** (MedGuard Chat) that can use a medical knowledge base via vector search (RAG).
4. **Track and use location** to improve relevance (with explicit permission prompts).
5. **Manage profile and avatar** securely using Supabase Storage.

MedGuard is not a replacement for a doctor. The chatbot provides general guidance and safety triage, not diagnosis.

---

## Repository map (what’s in this repo)

### Mobile app (production)

- `mobile-expo/` — Expo SDK 54 app (React Native)
	- `mobile-expo/src/screens/` — UI screens (Welcome, Sign In, Sign Up, Home, Chatbot, Profile, etc.)
	- `mobile-expo/src/hooks/` — Auth + location state management
	- `mobile-expo/src/services/` — Supabase client + Edge Function invoker
	- `mobile-expo/app.json` / `mobile-expo/app.config.js` — Expo config; tracked config is secret-free and dynamic values come from Expo public env vars

### Supabase backend (production)

- `supabase/functions/` — Supabase Edge Functions (Deno)
	- `chat/` — AI chat + RAG retrieval + conversation persistence
	- `intel/` — location-based seasonal/outbreak intel + caching
	- `verify-location/` — reverse-geocode + (optionally) upsert user_context
	- `avatar-sign/` — create signed URLs for private avatar objects
	- `_shared/` — shared env, CORS helpers, Supabase client factories

### Database migrations

- `supabase/migrations/` — the Supabase CLI migration ledger for all new schema changes.
- `db/migrations/` — legacy historical SQL source material; do not add new files here or replay it against production.

### Legacy / reference artifacts

- `*.html` — original UI prototypes (web-only)
- `server/` — older Node proxy + server-side RAG experiments (legacy; not used by the mobile app)
- `End-to-end-Medical-Chatbot-Generative-AI/` — Flask-based research baseline and earlier chatbot prototype (legacy/reference)

If you’re working on the production app, focus on `mobile-expo/`, `supabase/functions/`, and `supabase/migrations/`.

---

## Architecture (how it works)

### High-level data flow

**Mobile (Expo)** → **Supabase Auth** → **Supabase Postgres/Storage**

For “server-side logic” (AI, intel, signing URLs), the mobile app calls **Supabase Edge Functions**.

This keeps:

- AI keys (OpenRouter, Pinecone, Hugging Face) **off the client**
- sensitive operations (signing URLs) **server-side**

### Core Supabase resources

MedGuard uses:

- **Auth**: email + password (confirmation can be enabled in the Supabase dashboard)
- **Postgres tables**:
	- `profiles` — user profile fields (name, email, avatar, optional location fields)
	- `user_context` — frequently changing health context (state, lat/lon, care_mode)
	- `chat_conversations` / `chat_messages` — per-user chat history
	- `intel_cache` — cached intel (server-side)
- **Storage**:
	- `avatars` bucket (intended private) for profile pictures

Row Level Security (RLS) is used to prevent users from reading/updating other users’ data.

---

## Features already included

### Supabase Edge Functions

1) **Intel** (`supabase/functions/intel`)

- Returns Nigeria-first seasonal + weather-driven health intel
- Pulls weather from **Open-Meteo** (no key)
- Pulls outbreak signals from **disease.sh** and WHO RSS feeds
- Computes “risk” items (e.g., malaria risk during rainy season)

2) **Chat (RAG)** (`supabase/functions/chat`)

- AI health assistant prompt tuned for MedGuard
- Intent classification (symptoms, meds, emergency guidance, etc.)
- Retrieval via **Pinecone** using **384-dim embeddings** (MiniLM L6 v2)
- Embeddings path supports HuggingFace Inference API with retry + normalization
- Persists chat history in `chat_conversations` and `chat_messages`

3) **Verify Location** (`supabase/functions/verify-location`)

- Reverse geocodes lat/lon via Nominatim
- If called with an auth header, can upsert `user_context` (best-effort)

4) **Avatar Signed URL** (`supabase/functions/avatar-sign`)

- Accepts `{ path, expiresIn }`
- Validates path is scoped to the requesting user (`${userId}/...`)
- Returns signed URL for private avatar object

### Mobile app

- Polished onboarding screens (Welcome → Sign Up → Sign In)
- Profile creation and onboarding continuation
- Location provider context (permission request, refresh, reverse-geocoding, sync to profile)
- Chatbot UI with conversation list (rename, delete confirmation, auto-title)
- Home screen intel card and “Enable Location” CTA if permission not granted

---

## Roadmap (things we want to improve/add)

### Authentication and onboarding

- Branded confirmation emails (welcome email + CTA)
- Deep-link confirmation redirects to `medguard://...` for real devices
- Stronger auth error mapping (network vs invalid credentials vs email not confirmed)
- Forgot password flow + reset deep links

### Safety + medical quality

- Better red-flag triage (emergency detection and escalation)
- Localized Nigeria guidance (hotlines, trusted sources)
- Stronger guardrails against hallucinations

### Data + intel

- More disease sources (NCDC, local datasets)
- Better caching + offline support for intel
- Region-specific outbreak intelligence

### Engineering

- Automated tests (unit + smoke tests)
- CI checks + linting
- Security scanning (Snyk) as part of PR checks
- Observability: structured logs for Edge Functions and error reporting on mobile

---

## Getting started (new contributor)

### Prerequisites

- Node.js (LTS)
- Expo tooling (via `npx expo`)
- A Supabase project (cloud)
- Supabase CLI installed (recommended) for functions deployment
- Android Studio / Xcode if you need native builds

### 1) Mobile app setup (Expo)

1. Install dependencies:

```bash
cd mobile-expo
npm install
```

2. Create `mobile-expo/.env` with **only** Expo-safe public variables:

```ini
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Do not put service-role keys, AI provider keys, Pinecone keys, or local backend IP URLs in `mobile-expo/.env`.

3. Run on device/simulator:

```bash
npx expo start
```

For iOS permission strings / deep linking changes, you may need a **native build**:

```bash
npx expo run:android
# or
npx expo run:ios
```

### 2) Database schema setup

The canonical SQL migrations are in `db/migrations/`.

Recommended workflow:

1. In the Supabase Dashboard → SQL Editor, apply migrations in order.
2. Verify tables exist: `profiles`, `user_context`, `chat_conversations`, `chat_messages`, `intel_cache`.
3. Ensure RLS policies are enabled.

Note: some migrations are idempotent and safe to re-run.

### 3) Edge Functions setup (Supabase)

Edge Functions live in `supabase/functions/`.

Typical workflow:

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Deploy individual functions
supabase functions deploy chat
supabase functions deploy intel
supabase functions deploy verify-location
supabase functions deploy avatar-sign
supabase functions deploy nearby-facilities
```

Function settings are source-controlled in `supabase/config.toml`. Require JWTs by default; functions with a documented machine-to-machine or guest access model explicitly opt out and validate that access themselves.

#### Required Edge secrets

Set secrets (names may vary depending on function code; check `supabase/functions/_shared/env.ts` and each function):

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` (optional)
- `OPENROUTER_MODEL` (optional)
- `GOOGLE_GEMINI_KEY` (optional fallback)
- `GEMINI_MODEL` (currently `gemini-2.5-flash`)
- `GROQ_API_KEY` (optional fallback)
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_HOST` (host only, not `https://...`)
- `HF_API_KEY` (required for MiniLM-compatible RAG query embeddings)
- `SUPABASE_SERVICE_ROLE_KEY` (required for admin-only actions in some functions)

Example:

```bash
supabase secrets set OPENROUTER_API_KEY=...
supabase secrets set HF_API_KEY=...
supabase secrets set PINECONE_API_KEY=...
supabase secrets set PINECONE_HOST=... # no https://
```

---

## Deep links (medguard://)

The Expo scheme is configured as:

- `medguard://`

We use deep links to support future auth flows like email confirmation redirect and password reset. For iOS/Android, deep-link config is applied during native builds.

---

## Common tasks (how to work in this codebase)

### Add a new Edge Function

1. Create folder `supabase/functions/<name>/index.ts`
2. Reuse shared CORS + Supabase helpers from `_shared/`
3. Deploy with `supabase functions deploy <name>`
4. Update the mobile caller in `mobile-expo/src/services/edge.ts` (or equivalent)

### Update the database

1. Create a timestamped migration with `supabase migration new <description>`
2. Test it locally and commit the file under `supabase/migrations/`
3. Verify `supabase migration list --linked` is aligned, then deploy through the Supabase CLI
4. Update any TypeScript types/queries if required

### Debug “it works on web but not on device”

MedGuard is device-first. If something relies on localhost / browser-only APIs, move it to:

- Supabase Edge Functions (server logic)
- or Expo-compatible native modules

---

## Security notes

- Never commit secrets (service role keys, API keys).
- Rotate any secret that has been copied into a mobile env, terminal output, screenshot, or chat transcript.
- Keep avatar objects private and only expose via signed URLs.
- Keep RLS enabled for all user-owned tables.
- Prefer Edge Functions for anything requiring sensitive keys.

---

## Legacy artifacts (reference only)

The root HTML screens (`welcome.html`, `home.html`, etc.) and the older Node/Python chatbot folders exist for historical context and UI reference. They are not required for production mobile development.

---

## License

No license file is currently included. If you plan to open-source this repository, add a license and verify third-party asset usage.
