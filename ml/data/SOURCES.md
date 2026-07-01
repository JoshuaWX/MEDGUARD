# MedGuard label sources — verified sourcing dossier

Researched 2026-06-29. Every entry below was checked, not assumed. The honest
headline finding shapes the whole plan:

> **Malaria's granular routine case data is the *hardest* to get openly.** Nigeria's
> weekly/monthly malaria counts live in NHMIS/DHIS2 (access-gated, via NMEP/FMOH)
> and the open Malaria Atlas Project only publishes **annual** subnational
> incidence — too coarse for a weekly climate model. Meanwhile **NCDC publishes
> consistent *weekly, state-level* situation reports for the climate-sensitive
> epidemic-prone diseases — Lassa fever, cholera, meningitis (CSM), measles** —
> which are an excellent fit for a climate-lag forecast.

**Recommendation:** lead the first *trainable* model with **Lassa fever** (densest
open weekly state series, strong dry-season signal), add **cholera** second
(rainfall/flood-driven), and treat **malaria** as data-limited for now (annual
MAP baseline only) until DHIS2 access is arranged. The pipeline (`config.DISEASES`)
already supports all of them with the same schema.

---

## Tier 1 — open, weekly, state-level (best fit for forecasting)

### NCDC Situation Reports (Lassa fever, cholera, CSM, measles, mpox, diphtheria)
- **What:** Per-epi-week, per-state tables of suspected/confirmed cases + deaths.
- **Where:** <https://ncdc.gov.ng/diseases/sitreps> (PDF per disease per week) and
  the **ReliefWeb mirror** (cleaner, consistent epi-week titles):
  <https://reliefweb.int/updates?search=NCDC%20situation%20report>
- **Granularity:** weekly, state (some LGA). **Span:** Lassa ~2018–present (very
  consistent), cholera by outbreak year (2018, 2021, 2024 heavy), CSM seasonal.
- **Access:** PDFs. Two paths:
  - **`ingest/ncdc_lassa_pdf.py`** auto-parses the page-1 national summary →
    clean weekly series (verified on real wk30 & wk46 2024 reports).
  - Per-state tables for manual digitization where they exist (cholera/CSM).
  - `ingest/reliefweb_index.py` builds a worklist of report links. ⚠️ **ReliefWeb
    API now needs a free *approved appname*** (<https://apidoc.reliefweb.int/parameters#appname>;
    set `RELIEFWEB_APPNAME`).
- ⚠️ **VERIFIED GRANULARITY CAVEAT (Lassa, 2026-06-29):** in the Lassa sitreps the
  per-**state** confirmed counts are only in **maps/bar charts (Figures), not
  tables** — so automated extraction is **national weekly** only. Cholera/CSM
  sitreps more often include a state table. Plan around this per disease.
- **License:** NCDC public reports; cite "Nigeria Centre for Disease Control (NCDC)".
- **Fit:** ★★★★★ for national weekly (auto); ★★★☆☆ for state weekly (manual).

### NCDC Weekly Epidemiological Report (IDSR summary)
- **What:** Weekly IDSR roll-up across priority diseases.
- **Where:** <https://ncdc.gov.ng/reports/weekly>
- **Note:** Malaria is *not* a headline line item here; the epidemic-prone diseases are.

---

## Tier 2 — open, pre-digitized (use now, with caveats)

### Charnley et al. sub-national cholera dataset (Nigeria + DRC, 1971–2020)
- **What:** Curated cholera **cases/deaths by state** from WHO, UNICEF, EM-DAT,
  NCDC and literature. Columns: `Date, Year, State, LGA, Cases, Deaths, Confirmed, …`.
- **Where:** <https://github.com/GinaCharnley/cholera_data_drc_nga> →
  `Cholera data, DRC & NGA/NGA-Table 1.csv` (raw, static — downloads now).
- **Caveat:** **irregular/outbreak-level**, mixed temporal resolution (some rows
  only a year, some a day), not a dense weekly series. Good for **cholera
  seasonality priors and historical context**, weak as a standalone weekly target.
- **Adapter:** `ingest/charnley_cholera.py` normalizes it to the canonical schema.
- **License:** open repo (cite the BMC Infect Dis paper, doi:10.1186/s12879-022-07266-w).
- **Fit:** ★★★☆☆ supplementary cholera labels.

---

## Tier 3 — open but coarse (baselines / priors, not weekly targets)

### Malaria Atlas Project (MAP)
- **What:** Modelled subnational malaria **incidence/prevalence (annual)**, admin-unit.
- **Where:** <https://data.malariaatlas.org/> · R pkg `malariaAtlas` ·
  <https://github.com/malaria-atlas-project/malariaAtlas>
- **Caveat:** **annual**, modelled (not raw surveillance). Use as a malaria spatial
  baseline / sanity check, not a weekly label. **Fit:** ★★★☆☆ (malaria, annual).

### WHO World Malaria Report / GHO; WHO cholera (HDX)
- Annual, mostly national/regional. Context + validation. **Fit:** ★★☆☆☆.
- WHO cholera on HDX: <https://data.humdata.org/dataset/world-health-organization-who-cholera-data>

---

## Tier 4 — gated (the "right" malaria data, needs partnership)

### NHMIS / DHIS2 (National Health Management Information System)
- **What:** Routine facility malaria (and other) counts, **monthly, state/LGA** —
  the genuinely granular malaria source.
- **Access:** gated; requires NMEP/Federal Ministry of Health authorization.
- **Fit:** ★★★★★ *if* access is obtained. Track as a partnership action item.

---

## Practical sourcing order (what to actually do)

1. **Lassa fever (now, manual):** digitize ~weekly NCDC Lassa sitreps (ReliefWeb
   mirror is easiest) into `data/labels.csv` using the template. 2018→present gives
   a usable multi-year weekly state series. → first trainable model.
2. **Cholera (now, scripted + manual):** run `ingest/charnley_cholera.py` for
   history; top up recent years from NCDC cholera sitreps.
3. **Malaria (parallel, slower):** pull MAP annual as a baseline; pursue DHIS2
   access for real weekly/monthly labels.

All targets share one schema: `state, date, disease, cases` (see `data/README.md`).
