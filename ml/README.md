# MedGuard ML — environmental disease-risk forecasting

Offline Python pipeline that projects disease risk per Nigerian **state** ~4 weeks ahead from
climate. The live model is **Lassa fever** (`lassa_pipeline.py`) — a **risk-tier classifier**
(normal / elevated / high) validated at AUC ~0.95 / ~87% accuracy on "will the next 4 weeks be an
elevated period?". The trained model runs as a scheduled job that writes forecasts into the Supabase
`risk_forecast` table; the `intel` edge function + the app's risk **map** read that table and
surface it as a **risk projection**. (Malaria is data-limited — see `data/SOURCES.md`.)

## Scheduling (Phase 3)

`.github/workflows/lassa-forecast.yml` runs the whole chain **weekly** (Mondays) on GitHub Actions:
download new NCDC sitreps → parse → build features (fresh climate) → retrain the tier classifier →
`predict` (write rows). **One-time setup:** add a repo secret `SUPABASE_SERVICE_ROLE_KEY`
(Settings → Secrets and variables → Actions). Trigger a manual run from the Actions tab to verify.
pg_cron can't be used here — the model is Python, not Deno.

> **Safety stance (locked).** Output is a *risk projection from climate + season* — **never** an
> outbreak confirmation and **never** a diagnosis. Official outbreaks remain NCDC/WHO-only. No
> accuracy number is claimed unless `models/metrics.json` reproduces it on a temporal hold-out.

This directory is **pure offline tooling**: it does not import from or modify the Expo app or the
edge functions. Nothing here runs in production until Phase 2 (edge integration) and Phase 3
(scheduling), which are intentionally out of scope for this first pass.

## Setup

```bash
cd ml
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # only needed for predict_and_write.py
```

## Pipeline (run in order)

| Step | Command | Output |
| --- | --- | --- |
| 1. Weather | `python fetch_weather.py` | `data/weather_daily.csv` |
| 2. Labels  | place your file at `data/labels.csv` (see `data/README.md`) | — |
| 3. Features| `python build_dataset.py` | `data/features.csv` |
| 4. Train   | `python train.py` | `models/malaria_v1.joblib`, `models/metrics.json` |
| 5. Forecast| `python predict_and_write.py --dry-run` then without flag | rows in `risk_forecast` |

Steps 1, 3 run offline. Step 4 needs labels (step 2). Step 5 needs `.env` + the `029` migration
applied.

## Lassa fever — the first working model (`lassa_pipeline.py`)

Lassa is the first disease with real, trainable labels. Because NCDC Lassa sitreps only expose
**national** weekly counts (per-state numbers are chart images), Lassa has its own self-contained
pipeline that models nationally and **apportions** the result onto the endemic states.

```bash
python -m ingest.download_lassa_reports        # 1. fetch sitrep PDFs -> data/lassa_pdfs/
python -m ingest.ncdc_lassa_pdf data/lassa_pdfs/   # 2. -> data/staging_lassa_national.csv
python lassa_pipeline.py build                 # 3. national target + endemic-states climate -> features_lassa.csv
python lassa_pipeline.py train                 # 4. XGBoost vs seasonal baseline -> lassa_v1.joblib / metrics_lassa.json
python lassa_pipeline.py predict --dry-run     # 5. national projection apportioned to states (no write)
python lassa_pipeline.py predict               # 5b. upsert into risk_forecast (disease='lassa'; needs .env + migration 029)
```

Design specifics: the national target is paired with a **share-weighted average of the endemic
states' climate** (Ondo/Edo/Bauchi/… in `config.LASSA_STATE_SHARES`), not a country-wide mean.
Prediction assigns the national risk level to the big-share states and steps it down for smaller
ones, so a rarely-affected state is never shown as "high". Endemic weather is cached in
`data/_endemic_weather.csv` so re-builds don't re-hit NASA POWER. On the current 2020–2026 data
(315 weekly rows) the **XGBoost tier classifier beats the seasonal-climatology baseline on
walk-forward AUC (0.95 vs 0.87, ~87% accuracy)**, so the pipeline ships the model. The benchmark is
kept live every run: if the baseline ever matches it, `train` refuses to save a model and ships the
baseline instead — the pipeline never overclaims. See the walk-forward backtest (`lassa_pipeline.py
backtest`) for the honest per-episode scorecard: it caught all four sustained surges in the held-out
window (2022–2026) at 100% precision, with lead times up to 9 weeks.

## The honest bottleneck: labels

The model is only as good as its **ground truth** — historical confirmed malaria cases per state
per week/month. That data is **not** in this repo and must be sourced and **verified** (NCDC Weekly
Epidemiological Report, and/or a vetted public dataset). See [`data/README.md`](data/README.md) for
the exact schema and sourcing notes. Until a trustworthy labels file exists, `train.py` runs the
**seasonal baseline only** and refuses to emit a model — it will not fabricate accuracy.

## Design choices (grounded in comparable work)

- **XGBoost** for the model — gradient-boosted trees are the workhorse for tabular climate
  forecasting in the Nigerian Lassa/malaria literature and the EPIDEMIA (Ethiopia) lineage;
  interpretable feature importances become the Brain's "driver factors".
- **Lagged climate features** (`rain_lag_2w/4w/6w/8w`, rolling means) are the core predictive
  mechanism — rain leads cases by weeks.
- **Walk-forward / temporal validation, never a random split** — time-series leakage is the #1
  failure mode. Every run is benchmarked against a **seasonal-climatology baseline** (per-state
  mean by week-of-year); if XGBoost can't beat it, the baseline ships. A SARIMA baseline is a
  natural future upgrade.
