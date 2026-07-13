"""Auto-ingest the MedGuard Health News feed (public.health_posts).

Pulls what official bodies PUBLISH — NCDC / WHO / UN-OCHA Nigeria health reports —
from the ReliefWeb API (structured, reliable) plus a best-effort scrape of NCDC's
own news page, and upserts them as ATTRIBUTED posts. Also seeds a curated library
of prevention tips. Optionally emits a verified_reports row for a clearly
state-scoped outbreak confirmation.

SAFETY (matches the app's locked stance):
  * Only WHITELISTED official sources are published as official/outbreak news.
  * Posts store the publisher's own wording, ATTRIBUTED (source + url + date) —
    never paraphrased into new claims. MedGuard never self-declares an outbreak.
  * Tips are educational and non-diagnostic (a disclaimer is appended).

Usage:
  python -m ingest.health_feed --dry-run     # print normalized posts, write nothing
  python -m ingest.health_feed               # upsert to health_posts (needs ml/.env)
  RELIEFWEB_APPNAME=your-approved-name        # required for the ReliefWeb source
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

_UUID_NS = uuid.UUID("1b671a64-40d5-491e-99b0-da01ff1f3341")  # fixed namespace for deterministic ids

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (  # noqa: E402
    DATA_DIR,
    STATES,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    normalize_state,
)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MedGuard/1.0"
RELIEFWEB_API = "https://api.reliefweb.int/v2/reports"
OFFICIAL_SOURCES = {"ncdc", "who", "world health organization", "un ocha", "ocha", "unicef"}
DISEASE_KEYWORDS = {
    "lassa": "lassa", "malaria": "malaria", "cholera": "cholera",
    "meningitis": "meningitis", "measles": "measles", "mpox": "mpox",
    "monkeypox": "mpox", "diphtheria": "diphtheria", "yellow fever": "yellow fever",
    "covid": "covid", "polio": "polio",
}
OUTBREAK_WORDS = re.compile(
    r"\b(outbreak|situation report|sitrep|cases?|deaths?|confirmed|epidemic|alert)\b", re.I)
BODY_MAX = 1400
SUMMARY_MAX = 220
NOW = datetime.now(timezone.utc)


# ------------------------------------------------------------------ helpers ---
def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")           # strip any HTML
    text = re.sub(r"\[[^\]]*\]\([^)]*\)", " ", text)      # strip markdown links
    text = re.sub(r"[*_#>`]", "", text)                   # strip markdown marks
    return re.sub(r"\s+", " ", text).strip()


def _disease_of(text: str) -> str | None:
    low = (text or "").lower()
    for kw, tag in DISEASE_KEYWORDS.items():
        if kw in low:
            return tag
    return None


def _state_of(text: str) -> str | None:
    """Detect exactly one Nigerian state named in the text (else None)."""
    low = " " + (text or "").lower() + " "
    hits = {s for s in STATES if f" {s.lower()} " in low}
    return normalize_state(next(iter(hits))) if len(hits) == 1 else None


def _is_official(source: str) -> bool:
    return (source or "").strip().lower() in OFFICIAL_SOURCES


def _external_id(prefix: str, key: str) -> str:
    return f"{prefix}:{hashlib.sha1(key.encode('utf-8')).hexdigest()[:16]}"


# --------------------------------------------------------------- reliefweb ----
def fetch_reliefweb(limit: int = 25) -> list[dict]:
    appname = os.environ.get("RELIEFWEB_APPNAME")
    if not appname:
        print("  [reliefweb] RELIEFWEB_APPNAME not set — skipping (register a free "
              "appname at https://apidoc.reliefweb.int/parameters#appname).")
        return []
    body = {
        "filter": {"operator": "AND", "conditions": [
            {"field": "primary_country.iso3", "value": "nga"},
            {"field": "source.shortname",
             "value": ["NCDC", "WHO", "OCHA", "UNICEF"]},
        ]},
        "fields": {"include": ["title", "body", "date.created", "url_alias",
                               "source.shortname", "source.name"]},
        "sort": ["date.created:desc"],
        "limit": limit,
    }
    try:
        resp = requests.post(f"{RELIEFWEB_API}?appname={appname}", json=body,
                             headers={"User-Agent": UA}, timeout=60)
        if resp.status_code == 403:
            print(f"  [reliefweb] 403 — appname '{appname}' not approved yet.")
            return []
        resp.raise_for_status()
        data = resp.json().get("data", [])
    except Exception as e:  # never break the run on a source failure
        print(f"  [reliefweb] fetch failed: {e}")
        return []

    posts: list[dict] = []
    for item in data:
        f = item.get("fields", {})
        title = _clean(f.get("title", ""))
        if not title:
            continue
        src_list = f.get("source", []) or []
        src = (src_list[0].get("shortname") or src_list[0].get("name")) if src_list else "ReliefWeb"
        if not _is_official(src):
            continue  # whitelist: only official sources published as official
        raw_body = _clean(f.get("body", "")) or title
        date = str(f.get("date", {}).get("created", ""))[:10] or NOW.date().isoformat()
        url = f.get("url_alias", "")
        blob = f"{title} {raw_body}"
        posts.append({
            "external_id": _external_id("reliefweb", str(item.get("id") or url or title)),
            "category": "outbreak_news" if OUTBREAK_WORDS.search(blob) else "official_update",
            "title": title[:200],
            "summary": (raw_body[:SUMMARY_MAX] + ("…" if len(raw_body) > SUMMARY_MAX else "")),
            "body": raw_body[:BODY_MAX],
            "disease": _disease_of(blob),
            "state": _state_of(blob),
            "source": src.upper() if src.lower() == "ncdc" or src.lower() == "who" else src,
            "source_url": (f"https://reliefweb.int/node/{item.get('id')}" if not url
                           else (url if url.startswith("http") else f"https://reliefweb.int/{url}")),
            "published_at": f"{date}T00:00:00Z",
        })
    print(f"  [reliefweb] {len(posts)} official Nigeria posts")
    return posts


# -------------------------------------------------------------------- ncdc ----
def fetch_ncdc_news(limit: int = 12) -> list[dict]:
    """Best-effort scrape of NCDC's news page. Guarded — returns [] on any issue.

    Items live at /news/recent as /news/<id>/<slug>. The title is derived from the
    slug; the newest items are the highest ids.
    """
    from urllib.parse import unquote
    try:
        resp = requests.get("https://ncdc.gov.ng/news/recent",
                            headers={"User-Agent": UA}, timeout=45)
        if resp.status_code >= 300:
            print(f"  [ncdc] news page {resp.status_code} — skipping")
            return []
        pairs = re.findall(r'href="/news/(\d+)/([^"?#]+)"', resp.text, re.I)
    except Exception as e:
        print(f"  [ncdc] scrape failed: {e}")
        return []

    # newest first (highest id), dedupe by id
    best: dict[int, str] = {}
    for nid, slug in pairs:
        best.setdefault(int(nid), slug)
    posts: list[dict] = []
    for nid in sorted(best, reverse=True)[:limit]:
        slug = best[nid]
        title = _clean(unquote(slug).replace("-", " ")).strip(" :|").title() or f"NCDC update {nid}"
        url = f"https://ncdc.gov.ng/news/{nid}/{slug}"
        posts.append({
            "external_id": _external_id("ncdc", f"/news/{nid}"),
            "category": "outbreak_news" if OUTBREAK_WORDS.search(title) else "official_update",
            "title": title[:200],
            "summary": title[:SUMMARY_MAX],
            "body": f"{title}. Full advisory published by NCDC — see the official source for details.",
            "disease": _disease_of(title),
            "state": _state_of(title),
            "source": "NCDC",
            "source_url": url,
            "published_at": NOW.isoformat(),
        })
    print(f"  [ncdc] {len(posts)} news items")
    return posts


# -------------------------------------------------------------------- tips ----
TIP_DISCLAIMER = " This is general prevention advice, not a diagnosis — see a health worker if unwell."

def load_tips() -> list[dict]:
    path = DATA_DIR / "prevention_tips.json"
    if not path.exists():
        return []
    tips = json.loads(path.read_text(encoding="utf-8"))
    posts = []
    for t in tips:
        body = _clean(t["body"]) + TIP_DISCLAIMER
        posts.append({
            "external_id": _external_id("tip", t["slug"]),
            "category": "prevention_tip",
            "title": t["title"][:200],
            "summary": (t["body"][:SUMMARY_MAX] + ("…" if len(t["body"]) > SUMMARY_MAX else "")),
            "body": body[:BODY_MAX],
            "disease": t.get("disease"),
            "state": None,
            "source": "MedGuard",
            "source_url": None,
            "published_at": NOW.isoformat(),
        })
    print(f"  [tips] {len(posts)} prevention tips")
    return posts


# ------------------------------------------------------- verified_reports -----
def to_verified_reports(posts: list[dict]) -> list[dict]:
    """A clearly state-scoped official outbreak item also becomes a verified_reports
    row (attributed, verified) so it flows into the state risk/Brain/SMS channel."""
    rows = []
    for p in posts:
        if p["category"] != "outbreak_news" or not p.get("state"):
            continue
        if p["source"].upper() not in ("NCDC", "WHO"):
            continue
        rows.append({
            # deterministic id from the post -> idempotent across daily runs (no dupes)
            "id": str(uuid.uuid5(_UUID_NS, p["external_id"])),
            "state": p["state"],
            "signal_type": "outbreak_alert",
            "summary": p["summary"] or p["title"],
            "source_url": p.get("source_url"),
            "source_type": "official",
            "credibility_level": "high",
            "verification_status": "verified",
            "reviewed_by": "auto:ncdc-ingest",
            "occurred_at": p["published_at"],
        })
    return rows


# --------------------------------------------------------------- publish ------
def _upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — see ml/.env.example.")
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params={"on_conflict": on_conflict},
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        data=json.dumps(rows), timeout=60,
    )
    if resp.status_code >= 300:
        raise SystemExit(f"Upsert {table} failed ({resp.status_code}): {resp.text}")
    print(f"Upserted {len(rows)} rows -> {table}")


def main() -> None:
    dry = "--dry-run" in sys.argv
    print("Sourcing MedGuard health feed…")
    posts = fetch_reliefweb() + fetch_ncdc_news() + load_tips()

    # dedupe by external_id (first wins — reliefweb > ncdc > tips already ordered)
    seen, unique = set(), []
    for p in posts:
        if p["external_id"] in seen:
            continue
        seen.add(p["external_id"])
        unique.append(p)

    verified = to_verified_reports(unique)
    print(f"\nTotal: {len(unique)} posts "
          f"({sum(p['category']=='official_update' for p in unique)} official, "
          f"{sum(p['category']=='outbreak_news' for p in unique)} outbreak, "
          f"{sum(p['category']=='prevention_tip' for p in unique)} tips) "
          f"+ {len(verified)} verified_reports")

    if dry:
        for p in unique[:12]:
            tag = f"[{p['category']}]"
            print(f"  {tag:<17} {p['source']:<10} {p['title'][:70]}"
                  + (f"  ({p['state']})" if p.get("state") else ""))
        return

    _upsert("health_posts", unique, on_conflict="external_id")
    if verified:
        _upsert("verified_reports", verified, on_conflict="id")  # no natural key; insert new


if __name__ == "__main__":
    argparse.ArgumentParser().parse_known_args()  # tolerate --dry-run
    main()
