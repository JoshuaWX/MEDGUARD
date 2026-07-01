"""Build a machine-readable INDEX of NCDC situation reports from ReliefWeb.

This does not digitize the reports (they are PDFs); it produces a worklist —
one row per weekly report with its epi-week, date and URL — so digitization into
labels.csv is systematic instead of hunting the website.

⚠️ ReliefWeb's API requires a FREE *approved appname*. Request one at
   https://apidoc.reliefweb.int/parameters#appname  then:
     export RELIEFWEB_APPNAME=your-approved-name   (or set in ml/.env)

Usage:
  python -m ingest.reliefweb_index --disease lassa
  python -m ingest.reliefweb_index --disease cholera --limit 300
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from config import DATA_DIR  # noqa: E402

API = "https://api.reliefweb.int/v2/reports"
SOURCES_DIR = DATA_DIR / "sources"

DISEASE_QUERY = {
    "lassa": "NCDC Lassa Fever Situation Report",
    "cholera": "NCDC Cholera Situation Report",
    "meningitis": "NCDC CSM Cerebrospinal Meningitis Situation Report",
    "measles": "NCDC Measles Situation Report",
}

EPI_WEEK_RE = re.compile(r"epi[\s_-]*week[\s_-]*(\d{1,2})", re.IGNORECASE)
WEEK_RE = re.compile(r"\bweek[\s_-]*(\d{1,2})\b", re.IGNORECASE)


def _epi_week(title: str) -> int | None:
    m = EPI_WEEK_RE.search(title) or WEEK_RE.search(title)
    return int(m.group(1)) if m else None


def fetch(disease: str, limit: int) -> pd.DataFrame:
    appname = os.environ.get("RELIEFWEB_APPNAME")
    if not appname:
        raise SystemExit(
            "RELIEFWEB_APPNAME not set. Request a free approved appname at\n"
            "  https://apidoc.reliefweb.int/parameters#appname\n"
            "then set RELIEFWEB_APPNAME (env or ml/.env)."
        )
    query = DISEASE_QUERY.get(disease)
    if not query:
        raise SystemExit(f"Unknown disease '{disease}'. Choose from {list(DISEASE_QUERY)}.")

    rows: list[dict] = []
    offset = 0
    page = 100
    while offset < limit:
        body = {
            "query": {"value": query},
            "filter": {"field": "source.shortname", "value": "NCDC"},
            "fields": {"include": ["title", "date.created", "url_alias"]},
            "sort": ["date.created:desc"],
            "limit": min(page, limit - offset),
            "offset": offset,
        }
        resp = requests.post(f"{API}?appname={appname}", json=body, timeout=60)
        if resp.status_code == 403:
            raise SystemExit(f"ReliefWeb 403 — appname '{appname}' not approved yet.")
        resp.raise_for_status()
        data = resp.json().get("data", [])
        if not data:
            break
        for item in data:
            f = item.get("fields", {})
            title = f.get("title", "")
            rows.append({
                "disease": disease,
                "epi_week": _epi_week(title),
                "date": f.get("date", {}).get("created", "")[:10],
                "title": title,
                "url": f.get("url_alias", ""),
            })
        offset += len(data)

    df = pd.DataFrame(rows)
    SOURCES_DIR.mkdir(exist_ok=True)
    out = SOURCES_DIR / f"reliefweb_{disease}_index.csv"
    df.to_csv(out, index=False)
    print(f"Indexed {len(df)} {disease} reports -> {out}")
    if not df.empty:
        print(f"  date range: {df['date'].min()} .. {df['date'].max()}")
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--disease", default="lassa", choices=list(DISEASE_QUERY))
    ap.add_argument("--limit", type=int, default=400)
    args = ap.parse_args()
    fetch(args.disease, args.limit)
