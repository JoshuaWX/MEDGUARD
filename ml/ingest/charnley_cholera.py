"""Ingest the Charnley et al. sub-national cholera dataset (Nigeria, 1971-2020).

Source (static, open, downloads now):
  https://github.com/GinaCharnley/cholera_data_drc_nga
  file: "Cholera data, DRC & NGA/NGA-Table 1.csv"
  cite: Charnley et al., BMC Infect Dis 2022, doi:10.1186/s12879-022-07266-w

HONEST CAVEAT: this is an outbreak-charting compilation with IRREGULAR temporal
resolution (some rows a single day, some only a year) and many rows missing a
state. It is good for cholera *seasonality priors and history*, not a dense
weekly target on its own. We normalize what is usable into the canonical schema
and write a STAGING file (data/staging_cholera_charnley.csv) — you decide whether
to merge it into labels.csv (see ingest/README.md).

Usage:
  python -m ingest.charnley_cholera
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pandas as pd
import requests

# Allow running both as a module and as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import DATA_DIR, normalize_state  # noqa: E402

RAW_URL = (
    "https://raw.githubusercontent.com/GinaCharnley/cholera_data_drc_nga/main/"
    "Cholera%20data%2C%20DRC%20%26%20NGA/NGA-Table%201.csv"
)
STAGING = DATA_DIR / "staging_cholera_charnley.csv"

# Month names for the free-text "Date" column (e.g. "1 Mar", "2 Jan").
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def _parse_date(date_str: object, year: object) -> pd.Timestamp | None:
    """Best-effort: combine the free-text day-month with the year. Falls back to
    Jan 1 of the year when the day-month is absent/unparseable."""
    try:
        yr = int(float(year))
    except (TypeError, ValueError):
        return None
    if isinstance(date_str, str) and date_str.strip():
        parts = date_str.strip().split()
        if len(parts) == 2 and parts[1][:3].title() in MONTHS:
            try:
                return pd.Timestamp(year=yr, month=MONTHS[parts[1][:3].title()], day=int(parts[0]))
            except ValueError:
                pass
    return pd.Timestamp(year=yr, month=1, day=1)


def ingest() -> pd.DataFrame:
    print(f"Downloading Charnley NGA cholera CSV ...")
    resp = requests.get(RAW_URL, timeout=60)
    resp.raise_for_status()
    raw = pd.read_csv(io.StringIO(resp.text))

    rows = []
    dropped_no_state = dropped_no_cases = 0
    for _, r in raw.iterrows():
        state = normalize_state(r.get("State"))
        if not state:
            dropped_no_state += 1
            continue
        cases = pd.to_numeric(r.get("Cases"), errors="coerce")
        if pd.isna(cases):
            dropped_no_cases += 1
            continue
        date = _parse_date(r.get("Date"), r.get("Year"))
        if date is None:
            continue
        rows.append({
            "state": state,
            "date": date.date().isoformat(),
            "disease": "cholera",
            "cases": int(cases),
        })

    out = pd.DataFrame(rows).sort_values(["state", "date"]).reset_index(drop=True)
    out.to_csv(STAGING, index=False)
    print(
        f"Wrote {len(out):,} cholera rows -> {STAGING}\n"
        f"  states covered: {out['state'].nunique()} | "
        f"years: {out['date'].str[:4].min()}..{out['date'].str[:4].max()}\n"
        f"  dropped: {dropped_no_state} no-state, {dropped_no_cases} no-cases\n"
        "  NOTE: irregular dates — review before merging into labels.csv (see ingest/README.md)."
    )
    return out


if __name__ == "__main__":
    ingest()
