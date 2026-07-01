"""Pull daily climate history per state centroid from the NASA POWER API.

NASA POWER (https://power.larc.nasa.gov/) is free, keyless, global, and provides
daily agro-climatology back to 1981 — ideal ground truth for the climate
features that drive malaria transmission.

Parameters pulled (daily, point):
  T2M         - temperature at 2m (deg C)
  RH2M        - relative humidity at 2m (%)
  PRECTOTCORR - bias-corrected precipitation (mm/day)

Output: data/weather_daily.csv with columns [state, date, temp, humidity, precip].

The fetch is idempotent and cached per state under data/_weather_cache/, so
reruns only fetch states (or extend date ranges) not already on disk.
"""

from __future__ import annotations

import sys
import time
from datetime import datetime

import pandas as pd
import requests

from config import STATE_CENTROIDS, WEATHER_CSV, WEATHER_START, DATA_DIR

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = "T2M,RH2M,PRECTOTCORR"
CACHE_DIR = DATA_DIR / "_weather_cache"
CACHE_DIR.mkdir(exist_ok=True)

# NASA POWER uses -999 as its fill/missing sentinel.
FILL = -999.0


def _end_date() -> str:
    return datetime.utcnow().strftime("%Y%m%d")


def fetch_state(state: str, lat: float, lon: float, start: str, end: str) -> pd.DataFrame:
    """Fetch one state's daily series. Returns tidy [state, date, temp, humidity, precip]."""
    resp = requests.get(
        POWER_URL,
        params={
            "parameters": PARAMS,
            "community": "AG",
            "longitude": f"{lon}",
            "latitude": f"{lat}",
            "start": start,
            "end": end,
            "format": "JSON",
        },
        timeout=60,
    )
    resp.raise_for_status()
    block = resp.json()["properties"]["parameter"]

    frame = pd.DataFrame(
        {
            "temp": block["T2M"],
            "humidity": block["RH2M"],
            "precip": block["PRECTOTCORR"],
        }
    )
    frame.index = pd.to_datetime(frame.index, format="%Y%m%d")
    frame = frame.replace(FILL, pd.NA)
    frame.insert(0, "state", state)
    frame = frame.reset_index(names="date")
    return frame


def fetch_all(start: str = WEATHER_START, force: bool = False) -> pd.DataFrame:
    end = _end_date()
    frames: list[pd.DataFrame] = []

    for i, (state, (lat, lon)) in enumerate(STATE_CENTROIDS.items(), 1):
        cache = CACHE_DIR / f"{state.replace(' ', '_')}.csv"
        if cache.exists() and not force:
            df = pd.read_csv(cache, parse_dates=["date"])
            print(f"[{i:>2}/{len(STATE_CENTROIDS)}] {state:<12} cached ({len(df)} rows)")
        else:
            try:
                df = fetch_state(state, lat, lon, start, end)
                df.to_csv(cache, index=False)
                print(f"[{i:>2}/{len(STATE_CENTROIDS)}] {state:<12} fetched ({len(df)} rows)")
                time.sleep(0.5)  # be polite to the API
            except Exception as exc:  # noqa: BLE001 - report and continue
                print(f"[{i:>2}/{len(STATE_CENTROIDS)}] {state:<12} FAILED: {exc}", file=sys.stderr)
                continue
        frames.append(df)

    if not frames:
        raise SystemExit("No weather data fetched — check connectivity to NASA POWER.")

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values(["state", "date"]).reset_index(drop=True)
    combined.to_csv(WEATHER_CSV, index=False)
    print(f"\nWrote {len(combined):,} rows across {combined['state'].nunique()} states -> {WEATHER_CSV}")
    return combined


if __name__ == "__main__":
    fetch_all(force="--force" in sys.argv)
