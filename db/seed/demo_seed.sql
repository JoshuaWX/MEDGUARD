-- ============================================================================
-- MedGuard — DEMO SEED  (hackathon / screen-recording safe demo data)
-- ============================================================================
-- Run this in the Supabase SQL editor (project cddfhyxlhtmrrtduwlqd) BEFORE a demo.
-- It runs as `postgres`, so it bypasses the service-role-only RLS on
-- risk_forecast / health_posts. It is IDEMPOTENT — safe to re-run.
--
-- WHAT IT SEEDS (so every screen has something to show without live 3rd-party APIs):
--   • Demo profile pinned to Edo + Benin City coords (area + treatment demos work
--     even with no GPS).
--   • 14 days of personal check-ins + a 14-day streak  → Home "checked in", MyHealth
--     history, health score, streak.
--   • 3 consecutive weeks of community_weekly_trends for Edo (rising fever story)
--     → CommunityTrendCard renders rich: "most reported", week-over-week delta
--     arrows, trend badge, participation line.
--   • Fresh health_posts (tips + attributed official update) → Health News feed.
--   • Active Lassa risk_forecast across several states (+1 cholera) → Disease Outlook
--     card + Map disease-risk choropleth + treatment-finder narrative.
--
-- SAFETY: no fabricated outbreak statistics. The one official-source post uses
-- NCDC's public advisory wording with a real source_url and NO invented case
-- counts. All demo posts use external_id 'demo-%' so the cleanup at the bottom can
-- remove them. Forecasts are projection-framed. This is DEMO data — remove before
-- any real deployment (see cleanup block at the end).
--
-- PREREQUISITE: the demo account must already exist in auth.users (sign in once
-- with the email below), otherwise the personal section is skipped with a notice.
-- ============================================================================

-- ---------- 1) PERSONAL DATA + COMMUNITY TRENDS (needs the demo user) --------
do $$
declare
  v_email text := 'aolamilekanoladunjoye0412@gmail.com';  -- <<< DEMO ACCOUNT EMAIL
  v_state text := 'Edo';
  v_lat   double precision := 6.3350;   -- Benin City, Edo (has OSM hospitals; Irrua ISTH ~nearby-in-state)
  v_lon   double precision := 5.6037;
  v_uid   uuid;
  d       date;
  v_fever boolean; v_head boolean; v_fatigue boolean; v_dig boolean; v_water boolean; v_sick boolean;
  v_wk0 text := to_char(current_date,      'IYYY') || '-W' || lpad(to_char(current_date,      'IW'), 2, '0');
  v_wk1 text := to_char(current_date - 7,  'IYYY') || '-W' || lpad(to_char(current_date - 7,  'IW'), 2, '0');
  v_wk2 text := to_char(current_date - 14, 'IYYY') || '-W' || lpad(to_char(current_date - 14, 'IW'), 2, '0');
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email) limit 1;

  if v_uid is null then
    raise notice 'DEMO USER % not found in auth.users — sign in once with this email, then re-run. Skipping personal seed (community/posts/forecast below still run).', v_email;
  else
    -- Profile: pin state + location so area signal + treatment finder work sans GPS.
    update public.profiles
       set state      = v_state,
           lga        = coalesce(nullif(lga, ''), 'Oredo'),
           latitude   = v_lat,
           longitude  = v_lon,
           name       = coalesce(nullif(name, ''), 'Amina Bello'),
           full_name  = coalesce(nullif(full_name, ''), 'Amina Bello'),
           updated_at = now()
     where id = v_uid;

    -- Reseed a clean 14-day personal check-in window (incl. today).
    delete from public.health_checkins
     where user_id = v_uid and checkin_date >= current_date - 14;

    for i in 0..13 loop
      d := current_date - i;
      -- Deterministic, varied pattern — mostly calm, a couple of "off" days.
      v_fever   := (i in (0, 3));
      v_head    := (i in (0, 1, 6, 9));
      v_fatigue := (i in (0, 2, 3, 7, 11));
      v_dig     := (i = 3);
      v_water   := (i in (3, 8));
      v_sick    := (i = 6);

      insert into public.health_checkins (
        user_id, checkin_date, iso_week, state,
        has_fever, has_headache, has_fatigue, has_digestive_issues, has_water_exposure, has_sick_contact,
        risk_level, answers, created_at
      ) values (
        v_uid, d,
        to_char(d, 'IYYY') || '-W' || lpad(to_char(d, 'IW'), 2, '0'),
        v_state,
        v_fever, v_head, v_fatigue, v_dig, v_water, v_sick,
        public.calculate_checkin_risk_level(v_fever, v_head, v_fatigue, v_dig, v_water, v_sick),
        jsonb_build_object(
          'hasFever', v_fever, 'hasHeadache', v_head, 'hasFatigue', v_fatigue,
          'hasDigestiveIssues', v_dig, 'hasWaterExposure', v_water, 'hasSickContact', v_sick
        ),
        (d + time '08:15')
      )
      on conflict (user_id, checkin_date) do nothing;
    end loop;

    -- Nice streak for the demo.
    insert into public.health_streaks (user_id, current_streak, longest_streak, last_checkin_date, updated_at)
    values (v_uid, 14, 21, current_date, now())
    on conflict (user_id) do update
      set current_streak    = excluded.current_streak,
          longest_streak    = greatest(health_streaks.longest_streak, excluded.longest_streak),
          last_checkin_date = excluded.last_checkin_date,
          updated_at        = now();

    raise notice 'Seeded 14 personal check-ins + streak for % (%).', v_email, v_uid;
  end if;

  -- Community trends — upsert AFTER personal check-ins so the after-insert trigger's
  -- thin single-user aggregate for this week is replaced by the rich demo numbers.
  -- Story: participation + fever rising week-over-week (Lassa-season narrative).
  --  2 weeks ago
  insert into public.community_weekly_trends (
    iso_week, state, fever_count, headache_count, fatigue_count, digestive_count,
    water_exposure_count, sick_contact_count, low_risk_count, moderate_risk_count,
    elevated_risk_count, total_checkins, prev_week_total, trend_direction, computed_at
  ) values
    (v_wk2, v_state, 2, 3, 4, 1, 1, 1, 6, 2, 1,  9,  null, null,         now()),
    (v_wk1, v_state, 4, 3, 4, 2, 2, 1, 7, 4, 1, 12,  9,   'increasing',  now()),
    (v_wk0, v_state, 7, 4, 5, 3, 3, 2, 9, 6, 3, 18, 12,   'increasing',  now())
  on conflict (iso_week, state) do update set
    fever_count          = excluded.fever_count,
    headache_count       = excluded.headache_count,
    fatigue_count        = excluded.fatigue_count,
    digestive_count      = excluded.digestive_count,
    water_exposure_count = excluded.water_exposure_count,
    sick_contact_count   = excluded.sick_contact_count,
    low_risk_count       = excluded.low_risk_count,
    moderate_risk_count  = excluded.moderate_risk_count,
    elevated_risk_count  = excluded.elevated_risk_count,
    total_checkins       = excluded.total_checkins,
    prev_week_total      = excluded.prev_week_total,
    trend_direction      = excluded.trend_direction,
    computed_at          = now();

  raise notice 'Seeded 3 weeks of community trends for %.', v_state;
end $$;

-- ---------- 2) HEALTH NEWS FEED (fresh, demo posts) --------------------------
insert into public.health_posts (category, title, body, summary, disease, state, source, source_url, published_at, status, external_id)
values
  (
    'official_update',
    'NCDC Lassa fever season advisory',
    'The Nigeria Centre for Disease Control and Prevention (NCDC) advises heightened awareness during the Lassa fever season. Case-management centres remain operational in Edo, Ondo and Ebonyi. The public is reminded to keep homes and surroundings clean, store food in rodent-proof containers, and seek care early at a designated treatment centre if fever does not respond to malaria treatment. This is public advisory guidance, not a confirmation of an outbreak in your area.',
    'NCDC advises heightened Lassa awareness this season; treatment centres operational in Edo, Ondo, Ebonyi.',
    'lassa', null, 'NCDC', 'https://ncdc.gov.ng/diseases/info/L',
    now() - interval '20 hours', 'published', 'demo-ncdc-lassa-advisory'
  ),
  (
    'prevention_tip',
    'Keep Lassa fever out of your home',
    'Lassa fever spreads mainly through contact with food or items contaminated by infected rodents. Protect your household: store grains and food in covered, rodent-proof containers; dispose of refuse far from the home; block rat holes; keep the home and surroundings clean; and avoid drying food where rodents can reach it. If you or a family member has a fever that does not improve, visit a health facility early.',
    'Simple, proven steps to keep rodents — and Lassa fever — out of your home.',
    'lassa', null, 'MedGuard', null,
    now() - interval '2 days', 'published', 'demo-tip-lassa-home'
  ),
  (
    'prevention_tip',
    'Clean water, safe hands',
    'Cholera and other diarrhoeal illnesses spread through contaminated water and food. Drink only water that is treated, boiled, or from a safe source; wash hands with soap after using the toilet and before eating; and wash fruits and vegetables with clean water. If diarrhoea and vomiting occur, begin oral rehydration and seek care quickly — dehydration is the main danger.',
    'Water treatment and handwashing are your first line of defence against cholera.',
    'cholera', null, 'MedGuard', null,
    now() - interval '3 days', 'published', 'demo-tip-clean-water'
  ),
  (
    'announcement',
    'Your daily check-in helps your community',
    'Every time you complete your 30-second daily health check-in, you add to an anonymous, state-level picture of how people around you are feeling this week. No individual answers are ever shared. Together these check-ins help everyone spot when something is changing early. Thank you for taking part.',
    'How your anonymous daily check-in builds a shared early-awareness signal.',
    null, null, 'MedGuard', null,
    now() - interval '4 days', 'published', 'demo-announce-checkin'
  )
on conflict (external_id) do update set
  title        = excluded.title,
  body         = excluded.body,
  summary      = excluded.summary,
  category     = excluded.category,
  disease      = excluded.disease,
  source       = excluded.source,
  source_url   = excluded.source_url,
  published_at = excluded.published_at,
  status       = 'published',
  updated_at   = now();

-- ---------- 3) RISK FORECASTS (active projections) ---------------------------
-- Lassa across the endemic belt + neighbours (map choropleth), plus one cholera.
-- model_version '*_seasonal' → app labels these "Seasonal risk".
insert into public.risk_forecast (
  state, disease, forecast_period_start, forecast_horizon_days,
  projected_risk_level, risk_score, confidence, driver_factors, summary,
  model_version, generated_at, valid_until
)
values
  ('Edo',     'lassa', current_date, 28, 'high',     0.82, 0.90,
    array['Dry-season transmission peak','Elevated rodent activity index','Historical Jan–Mar surge'],
    'Projected elevated Lassa fever risk for Edo through the dry-season peak. This is a risk projection based on seasonal and historical patterns — not a confirmed outbreak.',
    'lassa_seasonal', now(), now() + interval '30 days'),
  ('Ondo',    'lassa', current_date, 28, 'elevated', 0.68, 0.88,
    array['Dry-season transmission peak','Historical case clustering'],
    'Projected elevated Lassa fever risk for Ondo this period. A risk projection, not a confirmed outbreak.',
    'lassa_seasonal', now(), now() + interval '30 days'),
  ('Ebonyi',  'lassa', current_date, 28, 'elevated', 0.64, 0.86,
    array['Dry-season transmission peak','Historical case clustering'],
    'Projected elevated Lassa fever risk for Ebonyi this period. A risk projection, not a confirmed outbreak.',
    'lassa_seasonal', now(), now() + interval '30 days'),
  ('Bauchi',  'lassa', current_date, 28, 'moderate', 0.45, 0.80,
    array['Seasonal pattern','Regional rodent activity'],
    'Projected moderate Lassa fever risk for Bauchi. A risk projection, not a confirmed outbreak.',
    'lassa_seasonal', now(), now() + interval '30 days'),
  ('Taraba',  'lassa', current_date, 28, 'moderate', 0.42, 0.79,
    array['Seasonal pattern','Regional rodent activity'],
    'Projected moderate Lassa fever risk for Taraba. A risk projection, not a confirmed outbreak.',
    'lassa_seasonal', now(), now() + interval '30 days'),
  ('Plateau', 'lassa', current_date, 28, 'low',      0.22, 0.78,
    array['Off-peak seasonal window'],
    'Projected low Lassa fever risk for Plateau this period. A risk projection, not a confirmed outbreak.',
    'lassa_seasonal', now(), now() + interval '30 days'),
  ('Edo',     'cholera', current_date, 28, 'moderate', 0.38, 0.62,
    array['Rainy-season water contamination risk','Sanitation pressure'],
    'Projected moderate cholera risk indicator for Edo. A climate-based risk indicator, not a confirmed outbreak.',
    'cholera_seasonal', now(), now() + interval '30 days')
on conflict (state, disease, forecast_period_start, model_version) do update set
  projected_risk_level = excluded.projected_risk_level,
  risk_score           = excluded.risk_score,
  confidence           = excluded.confidence,
  driver_factors       = excluded.driver_factors,
  summary              = excluded.summary,
  generated_at         = now(),
  valid_until          = excluded.valid_until,
  updated_at           = now();

-- ============================================================================
-- CLEANUP (run to remove demo data — uncomment and execute)
-- ============================================================================
-- delete from public.health_posts where external_id like 'demo-%';
-- delete from public.risk_forecast where model_version in ('lassa_seasonal','cholera_seasonal');
-- -- community_weekly_trends / health_checkins for the demo user reset automatically
-- -- on next real aggregation; delete explicitly only if you need a clean slate:
-- -- delete from public.community_weekly_trends where state = 'Edo';
