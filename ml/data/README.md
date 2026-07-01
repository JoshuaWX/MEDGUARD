# MedGuard ML — data contract

This folder holds pipeline inputs/outputs. The CSVs are git-ignored (large,
reproducible); only these docs are tracked.

## The label file (you must provide this) — `data/labels.csv`

This is the **ground truth** the model learns from, and the single biggest
determinant of forecast quality. The pipeline cannot invent it.

**Required schema** (one row per state per period per disease):

| column   | type   | meaning |
| -------- | ------ | --- |
| `state`  | text   | Must match a name in `config.STATES` (e.g. `Lagos`, `Kano`, `FCT`). |
| `date`   | date   | Start of the reporting period (ISO `YYYY-MM-DD`). Weekly → Monday of the ISO week; monthly → 1st of the month. Match `config.PERIOD`. |
| `disease`| text   | `malaria` for now. |
| `cases`  | number | Confirmed/reported case count for that state+period+disease. |

Example:

```csv
state,date,disease,cases
Lagos,2023-01-02,malaria,184
Lagos,2023-01-09,malaria,201
Kano,2023-01-02,malaria,150
```

## Where to source labels — and the honesty rule

Candidate sources (must be **verified before any accuracy claim**, not taken on faith):

- **NCDC Weekly Epidemiological Report** — <https://ncdc.gov.ng/reports>. The
  authoritative Nigerian surveillance series; tables are per-state per-week and
  must be digitized into the schema above.
- **Vetted public datasets** (e.g. Figshare/HDX malaria compilations). The
  "Figshare 2015–2024, ~89% accuracy" figures discussed earlier are **unverified
  leads** — treat any such dataset as a candidate to validate (coverage, units,
  provenance), never as established fact, and never copy an accuracy number you
  did not reproduce.

`load_labels.py` validates whatever you place here (state coverage, period gaps,
non-negative counts, obvious outliers) and reports problems loudly. If
`labels.csv` is absent, `train.py` runs the **seasonal baseline only** and
refuses to emit a model — the pipeline never fabricates a forecast.

## Generated files (git-ignored)

- `weather_daily.csv` — daily climate per state (from `fetch_weather.py`).
- `features.csv` — modeling table with climate lags + target (from `build_dataset.py`).
- `_weather_cache/` — per-state NASA POWER cache for idempotent refetch.
