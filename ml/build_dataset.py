"""Build the modeling table: aggregate daily climate to periods and engineer
the lagged features that let rainfall/temperature *lead* malaria risk.

The mechanism: heavy rain creates breeding sites; mosquitoes mature and transmit
over the following weeks, so cases lag climate by ~2-8 weeks. We encode that with
lag + rolling-mean features and predict cases HORIZON periods ahead.

Output: data/features.csv [state, date, <features...>, target]. Works with or
without labels — without labels the `target` column is absent (the table is then
only usable for live prediction, not training).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from config import (
    FEATURES_CSV,
    FORECAST_HORIZON_DAYS,
    LAG_PERIODS,
    PERIOD,
    ROLLING_WINDOWS,
    WEATHER_CSV,
)
from load_labels import load_labels

CLIMATE_COLS = ["temp", "humidity", "precip"]
HORIZON_PERIODS = max(1, round(FORECAST_HORIZON_DAYS / (7 if PERIOD == "W" else 30)))


def aggregate_weather() -> pd.DataFrame:
    """Daily -> per-period per-state. Precip summed; temp/humidity averaged."""
    if not WEATHER_CSV.exists():
        raise SystemExit(f"{WEATHER_CSV} not found — run fetch_weather.py first.")

    daily = pd.read_csv(WEATHER_CSV, parse_dates=["date"])
    daily = daily.set_index("date")

    out: list[pd.DataFrame] = []
    for state, grp in daily.groupby("state"):
        agg = grp.resample(PERIOD).agg({"temp": "mean", "humidity": "mean", "precip": "sum"})
        agg.insert(0, "state", state)
        out.append(agg.reset_index())
    weekly = pd.concat(out, ignore_index=True)
    # Normalize period start to the period's first day for clean joins with labels.
    weekly["date"] = weekly["date"].dt.to_period(PERIOD).dt.start_time
    return weekly.sort_values(["state", "date"]).reset_index(drop=True)


def add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["state", "date"]).copy()
    g = df.groupby("state", group_keys=False)

    for col in CLIMATE_COLS:
        for lag in LAG_PERIODS:
            df[f"{col}_lag_{lag}"] = g[col].shift(lag)
        for win in ROLLING_WINDOWS:
            df[f"{col}_roll_{win}"] = g[col].shift(1).rolling(win).mean().reset_index(drop=True)

    # Seasonality (cyclical week-of-year / month).
    period_no = df["date"].dt.isocalendar().week.astype(int) if PERIOD == "W" else df["date"].dt.month
    cycle = 52 if PERIOD == "W" else 12
    df["season_sin"] = np.sin(2 * np.pi * period_no / cycle)
    df["season_cos"] = np.cos(2 * np.pi * period_no / cycle)
    return df


def attach_labels_and_target(df: pd.DataFrame, labels: pd.DataFrame | None) -> pd.DataFrame:
    if labels is None:
        return df  # no target column -> prediction-only table

    lab = labels[["state", "date", "cases"]].copy()
    lab["date"] = lab["date"].dt.to_period(PERIOD).dt.start_time
    df = df.merge(lab, on=["state", "date"], how="left")

    g = df.groupby("state", group_keys=False)
    # Recent case load as a feature (what we know at prediction time).
    df["cases_lag_1"] = g["cases"].shift(1)
    df["cases_lag_2"] = g["cases"].shift(2)
    df["cases_roll_4"] = g["cases"].shift(1).rolling(4).mean().reset_index(drop=True)
    # Target: cases HORIZON periods AHEAD (the forward projection).
    df["target"] = g["cases"].shift(-HORIZON_PERIODS)
    return df


def build() -> pd.DataFrame:
    weekly = aggregate_weather()
    feats = add_lag_features(weekly)
    labels = load_labels()
    feats = attach_labels_and_target(feats, labels)

    feats.to_csv(FEATURES_CSV, index=False)
    has_target = "target" in feats.columns
    trainable = int(feats["target"].notna().sum()) if has_target else 0
    print(
        f"Wrote {len(feats):,} rows -> {FEATURES_CSV} "
        f"(horizon={HORIZON_PERIODS} {PERIOD}-periods; "
        f"{'trainable rows=' + str(trainable) if has_target else 'NO labels -> prediction-only'})"
    )
    return feats


if __name__ == "__main__":
    build()
