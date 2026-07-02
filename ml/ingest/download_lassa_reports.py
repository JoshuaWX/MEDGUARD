"""Auto-download the back-catalogue of NCDC Lassa Fever situation-report PDFs.

Scrapes the NCDC sitreps category page (cat=5 = Lassa), which lists every weekly
report as a table row with the week number, a date (year), and a direct hashed
PDF link under /themes/common/files/sitreps/<hash>.pdf. Downloads each PDF into
data/lassa_pdfs/ named lassa_<year>_wk<NN>.pdf (idempotent — skips existing).

Then run the parser over the folder:
  python -m ingest.ncdc_lassa_pdf data/lassa_pdfs/

Usage:
  python -m ingest.download_lassa_reports                 # all available
  python -m ingest.download_lassa_reports --limit 20      # newest N
  python -m ingest.download_lassa_reports --cat 6 --out data/csm_pdfs   # meningitis
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import DATA_DIR  # noqa: E402

BASE = "https://ncdc.gov.ng"
CAT_URL = BASE + "/diseases/sitreps/?cat={cat}"
UA = {"User-Agent": "Mozilla/5.0 (MedGuard research; contact via app)"}

# One catalogue row: "... for Week 23</td> <!--<td>06 June 2026</td>--> <td> <a href="/.../<hash>.pdf"
ROW_RE = re.compile(
    r"for Week\s*(\d+)\s*</td>\s*"           # week number
    r"<!--\s*<td>([^<]*?)</td>\s*-->\s*"     # commented date (has the year)
    r"<td>\s*<a[^>]*href=\"([^\"]+\.pdf)\"", # pdf href
    re.IGNORECASE | re.DOTALL,
)
YEAR_RE = re.compile(r"\b(20\d{2})\b")


def discover(cat: int) -> list[tuple[int, int | None, str]]:
    """Return [(week, year, pdf_url)] from the catalogue page."""
    resp = requests.get(CAT_URL.format(cat=cat), headers=UA, timeout=60)
    resp.raise_for_status()
    rows = []
    for week, date_str, href in ROW_RE.findall(resp.text):
        ym = YEAR_RE.search(date_str)
        year = int(ym.group(1)) if ym else None
        url = href if href.startswith("http") else BASE + href
        rows.append((int(week), year, url))
    return rows


def download(cat: int, out_dir: Path, limit: int | None, prefix: str = "lassa") -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = discover(cat)
    if not rows:
        raise SystemExit(
            "No report rows found — the catalogue markup may have changed. "
            "Inspect the page and adjust ROW_RE."
        )
    # Newest first is the page's natural order; honor --limit.
    if limit:
        rows = rows[:limit]

    got = skipped = failed = 0
    for week, year, url in rows:
        name = f"{prefix}_{year or 'NA'}_wk{week:02d}.pdf"
        dest = out_dir / name
        if dest.exists():
            skipped += 1
            continue
        try:
            r = requests.get(url, headers=UA, timeout=90)
            r.raise_for_status()
            if not r.content.startswith(b"%PDF"):
                print(f"  ! {name}: not a PDF (skipped)")
                failed += 1
                continue
            dest.write_bytes(r.content)
            got += 1
            print(f"  + {name}")
            time.sleep(0.4)  # be polite
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {name}: {exc}")
            failed += 1

    print(f"\nDone. downloaded={got} skipped(existing)={skipped} failed={failed} -> {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cat", type=int, default=5, help="NCDC sitrep category (5=Lassa, 6=meningitis, 7=cholera)")
    ap.add_argument("--out", default=str(DATA_DIR / "lassa_pdfs"))
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--prefix", default="lassa", help="output filename prefix (e.g. cholera)")
    args = ap.parse_args()
    download(args.cat, Path(args.out), args.limit, args.prefix)
