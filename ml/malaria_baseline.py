"""Malaria ANNUAL baseline (honest, data-limited — NOT a live forecast).

Nigeria has no open *weekly* malaria surveillance (NHMIS/DHIS2 is gated). What IS
open and real is the Nigeria Malaria Indicator Survey (MIS) via the DHS API:
malaria RDT prevalence in children, by geopolitical ZONE (not per-state), per
survey year. We publish that as a per-state ANNUAL BASELINE — every state takes
its zone's prevalence tier — clearly framed as a survey baseline, never a forecast
or a confirmed outbreak.

Source: DHS Program API, indicator ML_PMAL_C_RDT (malaria via RDT), Nigeria MIS.
(NOT NCDC — DHS/MIS is an independent, authoritative source.)

STATE-LEVEL UPGRADE PATH (documented, not built): the Malaria Atlas Project (MAP)
publishes *modelled* per-state (ADMIN1) annual Pf incidence as rasters. Converting
those to per-state values needs raster zonal-stats (rasterio + the state polygons
in mobile-expo/assets/data/nigeria-states.json) against MAP's WCS GeoTIFF — a
heavier geospatial job deferred for now. Truly granular *weekly* malaria still
requires NMEP/DHIS2 access. Until then this zone-level baseline is the honest floor.

Usage:
  python malaria_baseline.py predict --dry-run
  python malaria_baseline.py predict            # upsert into risk_forecast
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests

from config import DATA_DIR

DHS_URL = (
    "https://api.dhsprogram.com/rest/dhs/data"
    "?countryIds=NG&indicatorIds=ML_PMAL_C_RDT&breakdown=subnational&f=json&perpage=200"
)
BASELINE_CSV = DATA_DIR / "malaria_state_baseline.csv"  # from ingest/map_incidence.py
LEVELS = ["low", "moderate", "elevated", "high"]

# Malaria transmission SEASON by region (climate-informed): south is high most of
# the year and peaks in the long rains; the north is markedly seasonal, peaking
# after the rains (~Aug-Nov) and quiet in the dry/harmattan months. Month -> bump.
_SOUTH_BUMP = {5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1}
_NORTH_BUMP = {8: 1, 9: 1, 10: 1, 11: 1, 1: -1, 2: -1, 3: -1, 12: -1}

# 6 geopolitical zones -> their states (canonical names). 37 total.
ZONE_STATES: dict[str, list[str]] = {
    "North Central": ["Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "FCT"],
    "North East": ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"],
    "North West": ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"],
    "South East": ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
    "South South": ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
    "South West": ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
}
ZONES = set(ZONE_STATES)


_STATE_ZONE = {s: z for z, states in ZONE_STATES.items() for s in states}


def _region(state: str) -> str:
    return "north" if _STATE_ZONE.get(state, "").startswith("North") else "south"


def fetch_zone_prevalence() -> tuple[int, dict[str, float]]:
    resp = requests.get(DHS_URL, timeout=60)
    resp.raise_for_status()
    data = resp.json().get("Data", [])
    rows = [r for r in data if r.get("CharacteristicLabel") in ZONES]
    if not rows:
        raise SystemExit("DHS API returned no zone-level malaria data.")
    year = max(int(r["SurveyYear"]) for r in rows)
    latest = {r["CharacteristicLabel"]: float(r["Value"]) for r in rows if int(r["SurveyYear"]) == year}
    return year, latest


def _load_baseline() -> tuple[dict[str, float], str]:
    """Per-state endemicity value. Prefer MAP per-state (ingest/map_incidence.py);
    else DHS 6-zone survey mapped to states. Returns (state->value, source)."""
    if BASELINE_CSV.exists():
        df = pd.read_csv(BASELINE_CSV)
        src = str(df["source"].iloc[0]) if "source" in df and len(df) else "map"
        return {str(r["state"]): float(r["incidence"]) for _, r in df.iterrows()}, src
    _, prev = fetch_zone_prevalence()
    return {s: prev[z] for z, states in ZONE_STATES.items() if z in prev for s in states}, "dhs_zone"


def _floor_tier(value: float, lo: float, hi: float) -> str:
    """Relative endemicity floor (scale-agnostic: works for MAP incidence or DHS %)."""
    if hi <= lo:
        return "moderate"
    q = (value - lo) / (hi - lo)
    return "elevated" if q >= 0.66 else "moderate" if q >= 0.33 else "low"


def _step(level: str, n: int) -> str:
    i = max(0, min(len(LEVELS) - 1, LEVELS.index(level) + n))
    return LEVELS[i]


def build_rows() -> list[dict]:
    baseline, source = _load_baseline()
    if not baseline:
        raise SystemExit("No malaria baseline available (MAP + DHS both failed).")
    vals = list(baseline.values())
    lo, hi = min(vals), max(vals)

    now = datetime.now(timezone.utc)
    month = now.month
    period_start = (now + timedelta(days=28)).date().isoformat()
    valid_until = (now + timedelta(days=35)).isoformat()
    src_label = ("Malaria Atlas Project (modelled Pf incidence)" if source == "map_pf"
                 else "Nigeria MIS survey (zone-level)")
    model_version = "map_seasonal_v1" if source == "map_pf" else "dhs_seasonal_v1"

    rows = []
    for state, value in baseline.items():
        floor = _floor_tier(value, lo, hi)
        bump = (_NORTH_BUMP if _region(state) == "north" else _SOUTH_BUMP).get(month, 0)
        level = _step(floor, bump)
        vmax = hi or 1.0
        score = round(min(1.0, (value / vmax) * 0.7 + (LEVELS.index(level) / 3) * 0.3), 3)
        rows.append({
            "state": state,
            "disease": "malaria",
            "forecast_period_start": period_start,
            "forecast_horizon_days": 28,
            "projected_risk_level": level,
            "risk_score": score,
            "confidence": 0.45,
            "driver_factors": ["endemicity baseline", "seasonal transmission"],
            "summary": (
                f"Malaria risk in {state} is {level} this month. This blends a per-state endemicity "
                f"baseline from the {src_label} with the region's seasonal transmission pattern "
                f"(malaria rises in/after the rains). It is a climate-informed risk indicator, not a "
                f"validated case forecast or a confirmed outbreak."
            ),
            "model_version": model_version,
            "generated_at": now.isoformat(),
            "valid_until": valid_until,
        })
    return rows


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    rows = build_rows()
    src = rows[0]["model_version"] if rows else "?"
    print(f"Malaria monthly risk ({len(rows)} states, month={datetime.now().month}, model={src}):")
    if dry_run:
        for r in sorted(rows, key=lambda x: -x["risk_score"])[:10]:
            print(f"  {r['state']:<12} {r['projected_risk_level']:<9} score={r['risk_score']}")
        print("  ... (all 37 states) [dry-run, nothing written]")
        return
    from predict_and_write import upsert
    upsert(rows)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "predict":
        raise SystemExit("Usage: python malaria_baseline.py predict [--dry-run]")
    main()
