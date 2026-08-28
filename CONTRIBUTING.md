# Contributing to MedGuard

MedGuard is a proprietary portfolio prototype. Contributions should be small, reviewable, and focused on the production paths in `mobile-expo/`, `supabase/`, and `ml/`.

## Before opening a pull request

```bash
npm ci
npm run verify
supabase db reset
supabase test db
```

Document any native-device checks separately. Health Connect, background location, and remote push require an installable Expo build.

Use a short imperative commit subject, explain user impact and security implications, and include screenshots for meaningful UI changes. Do not commit generated native folders, dependencies, logs, screenshots containing personal data, or secrets.

Database changes belong in a new timestamped file under `supabase/migrations/`. The `db/migrations/` directory is historical only.
