# Bundled Edge Functions

These files are dashboard fallback artifacts for Supabase Edge Functions. Prefer deploying the modular source with the Supabase CLI because the source files in `supabase/functions/*/index.ts` are the canonical implementation.

## Preferred Deploy Path

From the repo root:

```powershell
npx supabase db push
npx supabase functions deploy chat --project-ref cddfhyxlhtmrrtduwlqd
npx supabase functions deploy intel --project-ref cddfhyxlhtmrrtduwlqd
npx supabase functions deploy avatar-sign --project-ref cddfhyxlhtmrrtduwlqd
npx supabase functions deploy verify-location --project-ref cddfhyxlhtmrrtduwlqd
npx supabase functions deploy nearby-facilities --project-ref cddfhyxlhtmrrtduwlqd
npx supabase functions deploy app-version --project-ref cddfhyxlhtmrrtduwlqd
```

JWT verification is source-controlled in `supabase/config.toml`.

## Dashboard Fallback

Use these files only if CLI deploy is unavailable. The Supabase Dashboard editor cannot resolve this repo's relative imports such as `../_shared/cors.ts`, so fallback files inline or bundle shared dependencies.

Before copying `intel.txt` to the dashboard, regenerate it:

```powershell
npm run supabase:bundle:intel
```

Then paste the full file contents into the Dashboard function editor for `intel`.

## Function JWT Settings

Match `supabase/config.toml`:

- `chat`: JWT verification ON
- `intel`: JWT verification ON
- `avatar-sign`: JWT verification ON
- `verify-location`: JWT verification ON
- `nearby-facilities`: JWT verification ON
- `app-version`: JWT verification OFF

## Brain v1 Notes

`intel.txt` must include Brain v1 code before deployment:

- structured `logIntel(...)` logs
- `enforceRateLimit(...)`
- area `brain`
- authenticated-only `personalBrain`
- trend baseline loader
- verified reports loader
- `BRAIN_LLM_SUMMARY`, which should remain off unless explicitly testing LLM summaries

If any of those markers are missing, regenerate the bundle and do not deploy the stale file.
