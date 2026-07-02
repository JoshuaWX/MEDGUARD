"""Fetch per-STATE malaria (Pf) incidence from the Malaria Atlas Project (MAP).

MAP publishes modelled *Plasmodium falciparum* incidence-rate rasters via a public
GeoServer WCS. We fetch the latest Nigeria subset and sample it at each state
centroid to produce a per-state ANNUAL baseline — finer than the DHS 6-zone data.
This is a modelled annual baseline (endemicity), NOT a live case forecast.

Endpoint (verified 2026-07-02):
  https://data.malariaatlas.org/geoserver/Malaria/ows  (WCS 2.0.1)
  coverage: Malaria__YYYYMM_Global_Pf_Incidence_Rate (latest release chosen)

Output: data/malaria_state_baseline.csv (state, incidence, source).
FALLBACK: if MAP/rasterio is unavailable, writes the DHS 6-zone baseline mapped to
states (source='dhs_zone') so malaria always has per-state data.

Usage: python -m ingest.map_incidence
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from config import DATA_DIR, STATE_CENTROIDS  # noqa: E402

WCS = "https://data.malariaatlas.org/geoserver/Malaria/ows"
OUT = DATA_DIR / "malaria_state_baseline.csv"
RASTER = DATA_DIR / "_map_pf_incidence.tif"
# Nigeria bounding box (lon/lat).
BBOX = {"lon": (2.6, 14.7), "lat": (4.2, 13.9)}


def _latest_coverage() -> str:
    r = requests.get(WCS, params={"service": "WCS", "version": "2.0.1", "request": "GetCapabilities"}, timeout=90)
    r.raise_for_status()
    ids = re.findall(r"(Malaria__(\d{6})_Global_Pf_Incidence_Rate)", r.text)
    if not ids:
        raise RuntimeError("No Pf incidence coverage found in MAP capabilities.")
    return max(ids, key=lambda t: t[1])[0]  # latest by YYYYMM


def _fetch_raster(coverage: str) -> Path:
    # WCS 2.0.1 GetCoverage, geographic subset. GeoServer uses axis labels Lat/Long.
    params = {
        "service": "WCS", "version": "2.0.1", "request": "GetCoverage",
        "coverageId": coverage, "format": "image/geotiff",
        "subset": [f"Long({BBOX['lon'][0]},{BBOX['lon'][1]})", f"Lat({BBOX['lat'][0]},{BBOX['lat'][1]})"],
    }
    r = requests.get(WCS, params=params, timeout=180)
    if r.status_code >= 300 or not r.content[:4] in (b"II*\x00", b"MM\x00*"):
        # Retry with E/N axis labels some GeoServer configs use.
        params["subset"] = [f"E({BBOX['lon'][0]},{BBOX['lon'][1]})", f"N({BBOX['lat'][0]},{BBOX['lat'][1]})"]
        r = requests.get(WCS, params=params, timeout=180)
        r.raise_for_status()
    RASTER.write_bytes(r.content)
    return RASTER


def _per_state_from_raster(tif: Path) -> pd.DataFrame:
    import numpy as np
    import rasterio

    rows = []
    with rasterio.open(tif) as ds:
        nodata = ds.nodata
        band = ds.read(1)
        for state, (lat, lon) in STATE_CENTROIDS.items():
            try:
                r0, c0 = ds.index(lon, lat)
            except Exception:  # noqa: BLE001
                continue
            # Average a small window around the centroid, ignoring nodata.
            win = band[max(0, r0 - 3):r0 + 4, max(0, c0 - 3):c0 + 4].astype("float64")
            if nodata is not None:
                win[win == nodata] = np.nan
            win[win < 0] = np.nan
            val = float(np.nanmean(win)) if np.isfinite(win).any() else float("nan")
            if val == val:  # not NaN
                rows.append({"state": state, "incidence": round(val, 2), "source": "map_pf"})
    return pd.DataFrame(rows)


def _dhs_fallback() -> pd.DataFrame:
    """Per-state baseline from the DHS 6-zone survey (zone value applied to states)."""
    from malaria_baseline import ZONE_STATES, fetch_zone_prevalence

    _, prev = fetch_zone_prevalence()
    rows = []
    for zone, states in ZONE_STATES.items():
        p = prev.get(zone)
        if p is None:
            continue
        for s in states:
            rows.append({"state": s, "incidence": round(p, 2), "source": "dhs_zone"})
    return pd.DataFrame(rows)


def ingest() -> pd.DataFrame:
    try:
        cov = _latest_coverage()
        print(f"MAP coverage: {cov}")
        tif = _fetch_raster(cov)
        df = _per_state_from_raster(tif)
        if df.empty:
            raise RuntimeError("raster sampling produced no values")
        print(f"MAP per-state incidence: {len(df)} states.")
    except Exception as exc:  # noqa: BLE001 - fall back so malaria always has data
        print(f"! MAP raster path failed ({type(exc).__name__}: {exc}). Falling back to DHS zone baseline.")
        df = _dhs_fallback()

    df.sort_values("state").to_csv(OUT, index=False)
    print(f"Wrote {len(df)} rows -> {OUT} (source={df['source'].iloc[0] if len(df) else 'none'})")
    return df


if __name__ == "__main__":
    ingest()
