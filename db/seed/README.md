# Demo seeding

`demo_seed.sql` populates a demo-ready dataset so every screen has something to
show on stage without depending on live third-party APIs (Overpass, weather,
NCDC feeds) or on having many real users.

## Run it

1. **Sign in once** in the app with the demo email (so the account exists in
   `auth.users`). Default in the script: `aolamilekanoladunjoye0412@gmail.com`.
   To use a different account, edit `v_email` (and optionally `v_state` / coords)
   at the top of the `do $$` block.
2. Open the **Supabase SQL editor** (project `cddfhyxlhtmrrtduwlqd`).
3. Paste the whole of `demo_seed.sql` and **Run**. It runs as `postgres`, so it
   bypasses the service-role-only RLS on `risk_forecast` / `health_posts`.
4. It's **idempotent** — re-run any time to reset the demo to a known state.

## What you get

| Screen | Seeded so it shows |
| --- | --- |
| Home | "Checked in today", welcoming hero, Disease Outlook (Edo Lassa = high), fresh Health News |
| MyHealth | 14-day streak, check-in history, health score, **rich Community Insights** (most-reported callout, week-over-week delta arrows, trend badge) |
| Health News | 4 fresh posts (NCDC advisory + prevention tips + announcement) |
| Map → Disease risk | Lassa choropleth across Edo/Ondo/Ebonyi/Bauchi/Taraba/Plateau + Edo cholera |
| Map → Treatment | Pick **Lassa** in Edo → Irrua ISTH (NCDC-designated) ranked first + Directions |

## Safety / cleanup

- No fabricated outbreak statistics. The one official-source post uses NCDC's
  public advisory wording with a real `source_url` and no invented case counts.
  Forecasts are projection-framed.
- All demo posts use `external_id 'demo-%'`; forecasts use `*_seasonal` model
  versions. The **cleanup block** at the bottom of `demo_seed.sql` removes them.
- This is demo data — clean it up before any real deployment.
