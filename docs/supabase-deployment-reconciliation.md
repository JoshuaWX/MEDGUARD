# Supabase deployment reconciliation

## Source of truth

- `supabase/migrations/` is the Supabase CLI migration ledger.
- `db/migrations/` is a read-only legacy archive. Do not replay it in production.
- `supabase/config.toml` is the source of truth for deployed Edge Function JWT settings.

## Current ledger

The three production history entries have matching no-op ledger markers in
`supabase/migrations/`. They document work that was previously applied outside
the CLI migration layout, so their schema effects must never be replayed.

`20260826201841_legacy_schema_baseline.sql` mechanically assembles the legacy
SQL history for a fresh project. It is intentionally **not marked as applied in
production** until a local reset has completed successfully and the generated
schema can be compared with production. Do not run `supabase db push` while
this baseline is pending verification.

## Edge Functions

The production function inventory is 11 functions. `nearby-facilities` permits
guest searches and therefore uses `verify_jwt = false`; it is rate-limited by
the function itself. All other settings are recorded in `supabase/config.toml`.

Before deploying a function, type-check it and deploy only reviewed source:

```powershell
npx --yes deno check --node-modules-dir=auto supabase/functions/<name>/index.ts
supabase functions deploy <name> --project-ref cddfhyxlhtmrrtduwlqd --use-api
```
