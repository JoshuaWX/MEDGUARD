"""Cholera SEASONAL + RAINFALL risk (honest, non-ML).

MONTHLY ML-FORECAST ATTEMPT — VERDICT: NOT SUPPORTABLE (assessed 2026-07-02).
Combining Charnley (1971-2021) + NCDC, the national monthly cholera series covers only
~14% of months (83 of 599; 46 months since 2015), and absence of a report does NOT
mean zero cases. With no continuous surveillance and no reliable "normal" months, a
validated monthly case-forecast (with a meaningful backtest) cannot be built honestly
— the negatives are undefined. So we deliberately KEEP this seasonal+rainfall indicator
(multi-source prone states; timing validated by Charnley's Aug-Sep onset peak) rather
than ship an unvalidatable model. A real cholera forecast needs continuous weekly
surveillance (NMEP/DHIS2/SORMAS).


Cholera reporting in Nigeria is episodic, so there is no continuous weekly series
to train/validate an ML forecast (see data/staging_cholera_state.csv — only ~17
snapshots). What IS reliable: cholera is rainfall/flood-driven and peaks in the
rainy season, and the historically cholera-prone states are clear. So we publish
a transparent SEASONAL climate risk for those states — framed as a seasonal risk
indicator, NEVER a precise forecast or confirmed outbreak. Official cholera
outbreaks still reach users via NCDC verified_reports.

Prone states are derived from MULTIPLE reliable sources (not NCDC alone): NCDC
cholera sitreps (recent) + the Charnley et al. sub-national dataset 1971-2021
(WHO + UNICEF + EM-DAT + NCDC + literature). They agree on a broad hotspot set
(northern: Borno/Kano/Yobe/Adamawa; southern/riverine: Lagos/Bayelsa/Rivers), and
Charnley's month-of-onset (peak Aug-Sep) validates the rainy-season timing. Risk =
rainy-season month baseline, bumped when recent rainfall is well above that state's
own seasonal normal (a flood signal).

Usage:
  python cholera_pipeline.py predict --dry-run
  python cholera_pipeline.py predict            # upsert into risk_forecast
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from config import DATA_DIR, STATE_CENTROIDS, WEATHER_START

STAGING = DATA_DIR / "staging_cholera_state.csv"          # NCDC recent (parsed)
CHARNLEY = DATA_DIR / "staging_cholera_charnley.csv"       # 1971-2021 multi-source
WEATHER_CACHE = DATA_DIR / "_cholera_weather.csv"
MODEL_VERSION = "cholera_seasonal_v1"
HORIZON_WEEKS = 4

# Documented fallback prone states (used if the parsed staging file is absent).
# Nigeria's recurrent cholera hotspots (northern + riverine/coastal).
FALLBACK_PRONE = [
    "Lagos", "Jigawa", "Kano", "Bayelsa", "Cross River", "Borno", "Katsina",
    "Adamawa", "Rivers", "Yobe", "Sokoto", "Zamfara", "Bauchi", "Gombe",
]

# Rainy-season month -> base seasonal tier (Nigeria cholera peaks Jun-Oct).
MONTH_BASE = {6: "moderate", 7: "elevated", 8: "elevated", 9: "elevated", 10: "moderate"}
LEVELS = ["low", "moderate", "elevated", "high"]


def _prone_states() -> list[str]:
    """Combine long-run (Charnley 1971-2021) and recent (NCDC) cholera burden into
    a per-state score; return the top hotspots. Falls back to a documented list."""
    score = pd.Series(dtype=float)

    if CHARNLEY.exists():
        ch = pd.read_csv(CHARNLEY)
        hist = ch.groupby("state")["cases"].sum()
        score = score.add(hist / hist.max() * 0.6, fill_value=0)  # 60% long-run history
    if STAGING.exists():
        nc = pd.read_csv(STAGING)
        recent = nc.groupby("state")["cumulative_cases"].max()
        score = score.add(recent / recent.max() * 0.4, fill_value=0)  # 40% recent burden

    if not score.empty:
        prone = [s for s in score.sort_values(ascending=False).index if s in STATE_CENTROIDS][:16]
        if prone:
            return prone
    return [s for s in FALLBACK_PRONE if s in STATE_CENTROIDS]


def _weather(states: list[str]) -> pd.DataFrame:
    if WEATHER_CACHE.exists():
        w = pd.read_csv(WEATHER_CACHE, parse_dates=["date"])
        if set(states).issubset(set(w["state"].unique())):
            return w
    from fetch_weather import fetch_state

    print("Fetching cholera-state rainfall from NASA POWER ...")
    end = datetime.utcnow().strftime("%Y%m%d")
    frames = []
    for s in states:
        lat, lon = STATE_CENTROIDS[s]
        frames.append(fetch_state(s, lat, lon, WEATHER_START, end))
        print(f"  fetched {s}")
    w = pd.concat(frames, ignore_index=True)
    w.to_csv(WEATHER_CACHE, index=False)
    return w


def _step(level: str, n: int) -> str:
    return LEVELS[int(np.clip(LEVELS.index(level) + n, 0, len(LEVELS) - 1))]


def _rain_signal(g: pd.DataFrame, now: datetime) -> tuple[float, float]:
    """Return (recent 30-day precip, this state's climatological 30-day precip for
    the current calendar window)."""
    g = g.dropna(subset=["precip"]).copy()
    g["doy"] = g["date"].dt.dayofyear
    recent = g[g["date"] >= (pd.Timestamp(now) - pd.Timedelta(days=30))]["precip"].sum()
    doy = now.timetuple().tm_yday
    window = g[(g["doy"] - doy).abs() % 365 <= 15]
    # mean 30-day total for this window across years
    climo = window.groupby(g["date"].dt.year)["precip"].sum().mean() if not window.empty else 0.0
    return float(recent), float(climo or 0.0)


def build_rows(dry_run: bool) -> list[dict]:
    states = _prone_states()
    weather = _weather(states)
    weather["date"] = pd.to_datetime(weather["date"])
    now = datetime.now(timezone.utc)
    now_naive = now.replace(tzinfo=None)  # weather dates are tz-naive
    month = now.month
    base = MONTH_BASE.get(month, "low")

    period_start = (now + timedelta(weeks=HORIZON_WEEKS)).date().isoformat()
    valid_until = (now + timedelta(weeks=HORIZON_WEEKS + 1)).isoformat()

    rows = []
    for s in states:
        g = weather[weather["state"] == s]
        recent, climo = _rain_signal(g, now_naive)
        anomaly = recent / (climo + 1.0)
        level = base
        # Flood signal: much wetter than this state's normal for the season.
        if anomaly >= 1.3 and base != "low":
            level = _step(level, 1)
        elif anomaly >= 1.5:
            level = _step("moderate", 0) if base == "low" else level
        # Absolute heavy recent rain guarantees at least moderate.
        if recent >= 200 and LEVELS.index(level) < 1:
            level = "moderate"

        score = float(np.clip(LEVELS.index(level) / 3 + (anomaly - 1) * 0.1, 0, 1))
        rows.append({
            "state": s,
            "disease": "cholera",
            "forecast_period_start": period_start,
            "forecast_horizon_days": HORIZON_WEEKS * 7,
            "projected_risk_level": level,
            "risk_score": round(score, 2),
            "confidence": 0.5,  # seasonal climatology, not a validated model
            "driver_factors": ["rainfall", "seasonal pattern"],
            "summary": (
                f"Cholera risk in {s} is seasonally {level}. This is a rainfall/season-based risk "
                f"indicator for a state that is historically cholera-prone (per NCDC and 1971-2021 "
                f"WHO/UNICEF/EM-DAT records), not a case forecast or a confirmed outbreak. Recent "
                f"rainfall is {'above' if anomaly >= 1.3 else 'near'} the local seasonal normal."
            ),
            "model_version": MODEL_VERSION,
            "generated_at": now.isoformat(),
            "valid_until": valid_until,
        })
    return rows


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    rows = build_rows(dry_run)
    print(f"Cholera seasonal risk for {len(rows)} prone states (month={datetime.now().month}):")
    if dry_run:
        for r in rows:
            print(f"  {r['state']:<12} {r['projected_risk_level']:<9} score={r['risk_score']}")
        return
    from predict_and_write import upsert
    upsert(rows)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "predict":
        raise SystemExit("Usage: python cholera_pipeline.py predict [--dry-run]")
    main()
