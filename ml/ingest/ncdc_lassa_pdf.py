"""Parse NCDC Lassa Fever Situation Report PDFs into a NATIONAL weekly series.

WHY NATIONAL (honest finding, verified 2026-06-29):
  In these reports the per-STATE confirmed counts live only in choropleth MAPS
  and bar CHARTS (Figures 2 & 5) — they are NOT in machine-readable tables. What
  IS reliably extractable is the page-1 "Table 1" national summary: current-week
  and cumulative Suspected / Confirmed / Probable / Deaths / CFR, plus the number
  of states & LGAs affected. So automated digitization yields a national weekly
  Lassa series (a meaningful target — Lassa is concentrated in a few dry-season
  states). State-level weekly counts would require manual map-reading.

INPUT:  a single sitrep PDF, or a directory of them (download from
        https://ncdc.gov.ng/diseases/sitreps or the ReliefWeb mirror).
OUTPUT: data/staging_lassa_national.csv — one row per epi week:
        year, epi_week, date (Mon of ISO week), confirmed_week, suspected_week,
        probable_week, deaths_cum, cfr_pct, states_affected, confirmed_cum.

Usage:
  python -m ingest.ncdc_lassa_pdf path/to/lassa_week30.pdf
  python -m ingest.ncdc_lassa_pdf path/to/folder_of_pdfs/
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from config import DATA_DIR  # noqa: E402

STAGING = DATA_DIR / "staging_lassa_national.csv"

# "Epi Week 30: 22nd - 28th July 2024"  /  "EpiWeek:302024"
WEEK_RE = re.compile(r"Epi\s*Week[:\s]*?(\d{1,2})\b", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(20\d{2})\b")
# The downloader names files lassa_<year>_wk<NN>.pdf — authoritative for year+week.
NAME_RE = re.compile(r"(20\d{2})\D+wk?(\d{1,2})", re.IGNORECASE)
# The CUMULATIVE row is the reliable anchor: "Cumulative <susp> <conf> <prob> <deaths> <cfr>%".
# The report lists the current year FIRST, then the previous year for comparison, so the first
# match is the current-year cumulative. We DERIVE weekly new cases by differencing the cumulative
# across reports — far more robust than trying to read the current-week row, which is absent in
# low/zero-case weeks (that positional ambiguity is what corrupted early parses).
CUM_RE = re.compile(
    r"Cumulative\s+(\d[\d,]*)\s+(\d[\d,]*)\s+(\d[\d,]*)\s+(\d[\d,]*)\s+([\d.]+)\s*%", re.IGNORECASE)
# States affected for the current-year cumulative = the State(s): count just before that row.
CUM_STATES_RE = re.compile(r"State\(s\):\s*(\d+)[\s\S]{0,90}?Cumulative\s+\d", re.IGNORECASE)

MIN_YEAR = 2015  # plausibility bound for year extracted from PDF text


def _int(s: str) -> int:
    return int(s.replace(",", ""))


def _year_week(path: Path, text: str) -> tuple[int | None, int | None]:
    """Resolve (year, epi_week). The FILENAME is authoritative (the downloader
    encodes both); fall back to the PDF text only when the name lacks them."""
    nm = NAME_RE.search(path.stem)
    year = int(nm.group(1)) if nm else None
    week = int(nm.group(2)) if nm else None

    if week is None:
        wk = WEEK_RE.search(text)
        week = int(wk.group(1)) if wk else None
    if year is None:
        # Most common plausible year in the text (avoids stray figures like 2034).
        cand = [int(y) for y in YEAR_RE.findall(text)]
        cand = [y for y in cand if MIN_YEAR <= y <= date.today().year + 1]
        if cand:
            year = max(set(cand), key=cand.count)
    return year, week


def parse_pdf(path: Path) -> dict | None:
    try:
        with pdfplumber.open(path) as pdf:
            text = pdf.pages[0].extract_text() or ""
    except Exception as exc:  # noqa: BLE001 - corrupt/truncated download; skip, don't crash
        print(f"  ! {path.name}: unreadable PDF ({type(exc).__name__}) — skipped")
        return None

    year, epi_week = _year_week(path, text)
    if not year or not epi_week:
        print(f"  ! {path.name}: no epi week/year (older layout or scanned image) — skipped")
        return None

    cum = CUM_RE.findall(text)  # [current_year_cumulative, prev_year_cumulative]
    if not cum:
        print(f"  ! {path.name}: no cumulative row matched (older layout or scanned image) — skipped")
        return None
    susp_cum, conf_cum, prob_cum, deaths_cum, cfr = cum[0]

    states = CUM_STATES_RE.search(text)
    try:
        iso_date = date.fromisocalendar(year, epi_week, 1)  # Monday of that ISO week
    except ValueError:
        iso_date = date(year, 1, 1)

    return {
        "year": year,
        "epi_week": epi_week,
        "date": iso_date.isoformat(),
        "suspected_cum": _int(susp_cum),
        "confirmed_cum": _int(conf_cum),
        "deaths_cum": _int(deaths_cum),
        "cfr_pct": float(cfr),
        "states_affected": int(states.group(1)) if states else None,
        "source_file": path.name,
    }


def ingest(target: str) -> pd.DataFrame:
    p = Path(target)
    pdfs = sorted(p.glob("*.pdf")) if p.is_dir() else [p]
    if not pdfs:
        raise SystemExit(f"No PDF(s) found at {target}")

    records = []
    for pdf_path in pdfs:
        rec = parse_pdf(pdf_path)
        if rec:
            records.append(rec)

    if not records:
        raise SystemExit("No reports parsed.")

    df = (
        pd.DataFrame(records)
        .drop_duplicates(["year", "epi_week"])
        .sort_values(["year", "epi_week"])
        .reset_index(drop=True)
    )
    df = _derive_weekly(df)

    df.to_csv(STAGING, index=False)
    print(f"\nWrote {len(df)} weekly national rows -> {STAGING}")
    print("  Target for forecasting = confirmed_week (new national confirmed Lassa cases),")
    print("  derived by differencing the per-year cumulative (robust to layout differences).")
    if df["repaired"].any():
        print(f"  note: {int(df['repaired'].sum())} week(s) had a cumulative dip (data revision)"
              " — clamped to 0 new cases.")
    return df


def _derive_weekly(df: pd.DataFrame) -> pd.DataFrame:
    """Cumulative resets each year, so weekly new cases = within-year diff of the
    cumulative (first week of a year = its cumulative). Cumulative is enforced
    non-decreasing (cummax) to absorb occasional downward data revisions."""
    out = []
    for _, g in df.groupby("year", sort=True):
        g = g.sort_values("epi_week").copy()
        mono = g["confirmed_cum"].cummax()
        g["repaired"] = mono != g["confirmed_cum"]
        g["confirmed_cum"] = mono
        # First reported week of the year only equals the cumulative if it IS week 1.
        # If earlier weeks are missing, the cumulative is a multi-week sum — don't
        # fabricate a spike; leave that one week unknown (NaN, dropped downstream).
        first_is_wk1 = g["epi_week"].iloc[0] == 1
        weekly = g["confirmed_cum"].diff()
        weekly.iloc[0] = g["confirmed_cum"].iloc[0] if first_is_wk1 else pd.NA
        g["confirmed_week"] = weekly.clip(lower=0).astype("Int64")
        # Same treatment for suspected (a useful secondary signal).
        s_mono = g["suspected_cum"].cummax()
        s_weekly = s_mono.diff()
        s_weekly.iloc[0] = s_mono.iloc[0] if first_is_wk1 else pd.NA
        g["suspected_week"] = s_weekly.clip(lower=0).astype("Int64")
        out.append(g)
    res = pd.concat(out, ignore_index=True)
    cols = ["year", "epi_week", "date", "confirmed_week", "confirmed_cum",
            "suspected_week", "suspected_cum", "deaths_cum", "cfr_pct",
            "states_affected", "repaired", "source_file"]
    return res[[c for c in cols if c in res.columns]]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python -m ingest.ncdc_lassa_pdf <pdf-or-folder>")
    ingest(sys.argv[1])
