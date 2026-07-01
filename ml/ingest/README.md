# Label ingestion — turning trusted sources into `data/labels.csv`

All adapters normalize to the **canonical schema**: `state, date, disease, cases`
(see `../data/README.md`). Trusted sources and their assessment are in
[`../data/SOURCES.md`](../data/SOURCES.md).

## Adapters

### `charnley_cholera.py` — runs now (no credentials)
Downloads the static, open Charnley sub-national cholera CSV and normalizes it.
```bash
python -m ingest.charnley_cholera   # -> data/staging_cholera_charnley.csv
```
Output is a **staging** file (irregular/outbreak-level history). Review it, then
append the rows you trust to `data/labels.csv`. It is not auto-merged.

### `download_lassa_reports.py` — auto-fetch the back-catalogue (runs now)
Scrapes the NCDC Lassa sitrep catalogue (cat=5) — **471 weekly reports discovered**,
back to ~2018 — and downloads each PDF idempotently into `data/lassa_pdfs/`.
```bash
python -m ingest.download_lassa_reports            # all (~471 PDFs, several min)
python -m ingest.download_lassa_reports --limit 30 # newest 30 to start
python -m ingest.download_lassa_reports --cat 6 --out data/csm_pdfs  # meningitis catalogue
```
Then parse the folder (next adapter). Integrity check: parsed `confirmed_cum`
should rise monotonically and its week-to-week delta should track `confirmed_week`.

### `ncdc_lassa_pdf.py` — runs now, parses Lassa sitrep PDFs (national weekly)
Extracts the page-1 national summary from NCDC Lassa Fever Situation Reports into
a clean weekly series. **Verified on real week-30 and week-46 2024 reports.**
```bash
python -m ingest.ncdc_lassa_pdf path/to/lassa_week30.pdf      # one report
python -m ingest.ncdc_lassa_pdf path/to/folder_of_pdfs/       # batch -> data/staging_lassa_national.csv
```
**Important honest limitation:** in these PDFs the per-**state** confirmed counts
exist only as **maps and bar charts (Figures 2 & 5), not tables** — so automated
extraction yields a **national** weekly series (`confirmed_week` = the target),
not per-state. Lassa is concentrated in a few dry-season states (the report prints
the cumulative split, e.g. Ondo 26% / Edo 23% / Bauchi 17%), so a national model
is meaningful; true per-state weekly labels would need manual map-reading or a
DHIS2-style source. **Workflow:** download the back-catalogue of weekly Lassa
reports (NCDC sitreps page or the ReliefWeb mirror), drop them in one folder, run
the batch command → multi-year national weekly series.

### `reliefweb_index.py` — needs a free approved appname
Builds a worklist of NCDC weekly situation reports (one row per report: epi-week,
date, URL) so you digitize systematically rather than hunting the site.
```bash
# 1. Request an appname: https://apidoc.reliefweb.int/parameters#appname
# 2. set RELIEFWEB_APPNAME (env or ml/.env), then:
python -m ingest.reliefweb_index --disease lassa     # -> data/sources/reliefweb_lassa_index.csv
```
This indexes the reports; it does **not** read the PDFs (digitization is manual —
the per-state tables are inside the PDFs).

## Manual digitization workflow (the realistic path for NCDC sitreps)

1. Run `reliefweb_index.py` (or browse <https://ncdc.gov.ng/diseases/sitreps>) to
   get the list of weekly reports for a disease.
2. For each report, open the **state breakdown table** (suspected/confirmed cases
   + deaths per state) and copy the **confirmed (or suspected) case counts** into
   `data/labels.csv` using `labels_template.csv` as the format:
   - `date` = Monday of that epi-week (`YYYY-MM-DD`).
   - `disease` = `lassa` | `cholera` | `meningitis` (match `config.DISEASES`).
   - one row per state that appears in the table; omit states not listed.
3. Validate as you go: `python load_labels.py` (set `config.DISEASE` to the disease
   you are building) reports coverage, gaps and outliers.

> Tip: NCDC Lassa sitreps report **cumulative** counts within a year. If you copy
> cumulative numbers, convert to weekly **new** cases by differencing consecutive
> weeks per state before training (a one-off cleaning step). Document which you used.

## After you have labels

Set `config.DISEASE` to the disease, then run the normal pipeline:
```bash
python build_dataset.py && python train.py
```
