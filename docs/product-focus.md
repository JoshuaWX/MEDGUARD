# MEDGUARD product focus proposal

Date: 2026-09-07. Status: founder selected disease-prone Nigerian communities as the target audience; the product and release changes below remain proposals for discussion.

## The purpose

Help people in disease-prone Nigerian communities receive and understand credible health warnings relevant to their area and take a practical preventive next step in time.

The user promise is: **“Tell me what matters for health in my area, why I should trust it, and what I can do.”**

This returns to the original local-awareness problem in `CLAUDE_CODE_HANDOFF.md`. The product hypothesis is that selecting relevant official information, explaining its meaning, and making the next step easy will be more useful than assembling more health features. Repository evidence supports this as a coherent direction; user demand and impact still need validation.

## What the repository shows

- `README.md` describes local signals, official updates, check-ins, and nearby care together. The original proposal centres timely local information and preventive action.
- `mobile-expo/src/screens/HomeScreen.tsx` places a greeting and environmental conditions before Health News and the area outlook, and gives chat a floating entry point.
- `mobile-expo/src/navigation/TabNavigator.tsx` gives Home, Map, My Health, and Profile the main navigation positions. Alerts are a separate screen.
- `mobile-expo/src/screens/MyHealthScreen.tsx` includes check-ins, streaks, steps, BMI, and cycle tracking. These introduce a personal-wellness purpose alongside public-health awareness.
- `mobile-expo/src/screens/AlertsScreen.tsx` already separates official/reviewed reports from projections. That distinction is useful foundation work to preserve.
- `ml/lassa_pipeline.py` models national Lassa risk and apportions it to states using historical shares. These are not independently learned state forecasts. This inspection did not reproduce model performance or assess statistical validity.
- `website/src/pages/pilot.astro` already proposes testing relevance, understanding, action, and trust, and describes SMS/USSD as requiring partners. Earlier pitch files contain broader claims; they should not be treated as verified current capabilities.

This is a product assessment from source and notes, not a live-device or production-service audit.

## First audience and scope

The founder selected disease-prone Nigerian communities as the target audience, rather than a student-focused launch. Within those communities, households and caregivers are a proposed first user group; community health workers, clinics, and trusted local organisations may help reach them. The founder confirmed that Nigeria is the target but does not yet know which community or state is reachable for a pilot. Pilot access is unconfirmed. Do not assume all communities have the same languages, phone access, trusted messengers, or health priorities.

An undecided pilot location does not block defining the core experience or inspecting the existing official-update journey. Until access is established, prioritise source attribution, geographic scope, freshness, clear next steps, and truthful empty/error states. Keep delivery-channel selection open. Do not select a disease, promise nationwide service, or build new channel infrastructure merely to fill the gap in pilot knowledge.

Choose one community, one delivery channel participants actually use, and one or two health topics with reliable relevant sources and reviewed guidance. Community recruitment does not imply community-level surveillance: state information must stay labelled as state information.

Delivery must follow the audience. Use the Android prototype for the first test only if participants can and will use it. Investigate SMS, existing community messaging groups, and health-worker delivery against participants' actual access and trust. For a basic-phone audience, evaluate a bounded SMS pilot and its delivery costs before adding more app features. USSD can support checking or subscribing; SMS can deliver an opted-in warning. Neither channel is assumed to be operational nationwide. National reach remains a longer-term ambition.

## The core experience

1. Choose an area manually, with optional location assistance. The essential information should require minimal setup.
2. See the most relevant current official update, including affected area, publisher, report date, and source link.
3. Read a brief explanation and a small set of source-backed, reviewed next steps. Preserve the original meaning and make explanatory text distinguishable from the source.
4. Open the source or a relevant care resource when needed.
5. Opt into notifications for meaningful relevant changes, with easy controls.

The app's Home should answer this journey before offering secondary material. The same source, area, date, and action should survive delivery in a short message or through a community intermediary. No current matching report, stale information, and an unavailable source are distinct states. None should imply that an area is safe. Show the date of the underlying information separately from the last successful retrieval.

Forecasts, if retained in the pilot, belong in a clearly separate experimental outlook with scope, horizon, and limitations. Do not blend them into a generic disease-risk verdict. Timeliness means reducing avoidable delay after evidence becomes available; “real time” and “before outbreaks happen” are not established capabilities.

## Feature priorities

| Feature | Proposed treatment | Reason |
| --- | --- | --- |
| Official updates, area matching, source/date/expiry | Perfect first | Establishes relevance and trust |
| Plain-language prevention guidance | Perfect first | Turns an update into a useful next step |
| Opt-in relevant notifications and delivery reliability | Perfect first | Information must reach people when it matters |
| Freshness, missing-data states, low-data readability | Perfect first | Keeps the central promise understandable and dependable |
| Health News and Alerts | Bring into one coherent reading journey | Users should not have to discover which screen contains relevant information |
| Nearby care | Keep as a contextual action | Helps when an update calls for finding care; verify listing quality |
| Weather and AQI | Secondary, relevant context only | Should earn attention through a specific useful action |
| Disease-risk map and forecasts | Separate research/validation track | A map or model should improve a decision before becoming the product's main claim |
| General AI chat | Pause expansion and deprioritise | An open-ended health assistant is a separate product; test alert-specific explanations first |
| Check-ins, personal Brain, symptom trends | Defer from the first focused journey | Need evidence of incremental value and sufficient data; do not make daily logging a prerequisite for local updates |
| Steps, BMI, cycle tracking, streaks | Set aside from the focused release | Serve a personal-wellness goal beyond this scope |
| SMS/USSD | Audience-dependent delivery work | Essential if the chosen audience needs it; not another feature to add for its own sake |

“Set aside” is a scope recommendation, not an instruction to delete existing user records or immediately remove functionality.

## How to work toward it

### 1. Establish the need

Speak with 5–8 people from the chosen community about the last health warning they received: where it came from, whether it concerned their area, what was unclear, and what they did. Compare the proposed experience with the official page or message they already use. Choose an initial topic from these needs and source availability, not solely because a model already exists.

### 2. Perfect one complete journey

Move relevant updates and next steps to the centre of Home. Connect the alert list, detail, source, and relevant care action. Reduce competing entry points. Preserve existing attribution, privacy, and consent behaviour. Audit ingestion, location matching, freshness, and notification delivery for that exact journey before expanding coverage.

Acceptance scenarios: current matching report; national advisory; report for another state; expired report; failed refresh; no GPS permission; notification opening the intended update; opt-out respected; forecast visibly distinct from an official report. These are future implementation checks, not tests run for this proposal.

### 3. Test usefulness before expanding

Run a small usability pilot with roughly 10–20 consenting participants. Use labelled historical/example updates if no relevant event occurs; do not send simulated warnings as real alerts. A short pilot can test comprehension and usability, not prove outbreak prevention or lives saved.

Primary measure: the proportion of participants who can correctly identify whether an update concerns their area, identify its source and freshness, and explain an appropriate next step without help. A proposed initial usability gate is 8 of 10 participants succeeding within a minute; this is a working target, not an external standard.

Also track source-to-delivery delay, wrong-area/duplicate/stale messages, misunderstood projections, and whether participants find the service worth receiving. Separate attempted delivery, confirmed receipt, opening an update, and self-reported action. Daily app opens and check-in streaks are weak success measures for an event-driven awareness service.

If people understand the message but cannot act, investigate the missing resource or access barrier. If they already receive equally useful information elsewhere, revise the audience or delivery approach before building more.

## The rule for future additions

Add a feature only when evidence shows it improves the ability to **receive, understand, trust, or act on a relevant local health update**. Record the user problem and the measure expected to improve before implementing it.

WHO describes risk communication as enabling informed protective decisions and stresses understandable, trusted channels. This supports the focus on communication and action; it does not establish demand for MEDGUARD or validate its forecasts. Sources: [WHO risk communication overview](https://www.who.int/news-room/questions-and-answers/item/emergencies-risk-communication), [WHO emergency risk communication guideline](https://www.who.int/publications/b/31390).
