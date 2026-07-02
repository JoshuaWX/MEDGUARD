"""Parse NCDC Cholera Situation Report PDFs into a STATE-LEVEL series.

Unlike Lassa (whose per-state data is trapped in charts), cholera sitreps include
an extractable **per-state table** ("No | State | Suspected cases | % of total |
Cumulative %"). We pull the state + cumulative suspected-cases columns.

INPUT:  a single cholera sitrep PDF or a folder (download with
        `python -m ingest.download_lassa_reports --cat 7 --out data/cholera_pdfs --prefix cholera`).
OUTPUT: data/staging_cholera_state.csv (state, year, epi_week, date, cumulative_cases).

HONEST NOTE: cholera reporting is EPISODIC (big outbreak years, quiet years) and
the table lists only the main affected states each week, so the series is
intermittent — good for identifying cholera-prone states and seasonality, harder
as a dense weekly target. Values are CUMULATIVE within a year; difference
consecutive weeks per state to get new cases (see cholera cleaning, TODO).

Usage:
  python -m ingest.ncdc_cholera_pdf data/cholera_pdfs/
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from config import DATA_DIR, normalize_state  # noqa: E402

STAGING = DATA_DIR / "staging_cholera_state.csv"
NAME_RE = re.compile(r"(20\d{2})\D+wk?(\d{1,2})", re.IGNORECASE)
# A state row flattened to text: "3 Abia 44 4% 80%" or "1 Bayelsa 763 66% 66%".
STATE_ROW = re.compile(r"^\s*\d{1,2}\s+([A-Za-z][A-Za-z\-'.\s]+?)\s+([\d,]+)\s+\d+\s*%")


def _state_table(pdf) -> list[tuple[str, int]]:
    """Return [(state, cumulative_cases)] from the per-state table, or []."""
    for page in pdf.pages:
        for tb in page.extract_tables():
            flat = [" ".join(c for c in row if c) for row in tb]
            head = " ".join(flat[:2]).lower()
            if "state" in head and "suspected" in head and "lga" not in head:
                out = []
                for line in flat:
                    m = STATE_ROW.match(line)
                    if not m:
                        continue
                    st = normalize_state(m.group(1).replace("-", " ").strip())
                    if st:
                        out.append((st, int(m.group(2).replace(",", ""))))
                if out:
                    return out
    return []


def parse_pdf(path: Path) -> list[dict]:
    nm = NAME_RE.search(path.stem)
    if not nm:
        print(f"  ! {path.name}: no year/week in filename — skipped")
        return []
    year, week = int(nm.group(1)), int(nm.group(2))
    try:
        with pdfplumber.open(path) as pdf:
            rows = _state_table(pdf)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {path.name}: unreadable ({type(exc).__name__}) — skipped")
        return []
    if not rows:
        print(f"  ! {path.name}: no per-state table found — skipped")
        return []
    try:
        d = date.fromisocalendar(year, week, 1).isoformat()
    except ValueError:
        d = date(year, 1, 1).isoformat()
    return [{"state": s, "year": year, "epi_week": week, "date": d,
             "cumulative_cases": c, "source_file": path.name} for s, c in rows]


def ingest(target: str) -> pd.DataFrame:
    p = Path(target)
    pdfs = sorted(p.glob("*.pdf")) if p.is_dir() else [p]
    if not pdfs:
        raise SystemExit(f"No PDF(s) found at {target}")

    records: list[dict] = []
    ok = 0
    for pdf_path in pdfs:
        recs = parse_pdf(pdf_path)
        if recs:
            ok += 1
            records.extend(recs)

    if not records:
        raise SystemExit("No cholera state tables parsed.")

    df = (pd.DataFrame(records)
          .drop_duplicates(["state", "year", "epi_week"])
          .sort_values(["year", "epi_week", "state"])
          .reset_index(drop=True))
    df.to_csv(STAGING, index=False)
    print(f"\nParsed {ok}/{len(pdfs)} reports -> {len(df)} state-rows -> {STAGING}")
    print(f"  states seen: {df['state'].nunique()} | years: {df['year'].min()}..{df['year'].max()}")
    return df


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python -m ingest.ncdc_cholera_pdf <pdf-or-folder>")
    ingest(sys.argv[1])
