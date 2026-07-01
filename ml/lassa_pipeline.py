"""National Lassa fever forecaster with per-state apportionment.

WHY THIS IS SEPARATE FROM THE (state-level) malaria pipeline:
  NCDC Lassa sitreps give NATIONAL weekly counts only (per-state numbers are
  chart images — see ingest/ncdc_lassa_pdf.py). So we model Lassa NATIONALLY and
  then apportion the national risk onto the historically-endemic states
  (config.LASSA_STATE_SHARES). The TIMING (when risk rises) is modelled; the
  GEOGRAPHY (which states) is a transparent historical-share overlay. Genuine new
  spread still reaches users via the official NCDC verified_reports alert channel.

Climate pairing: Lassa is a dry-season, rodent-driven disease concentrated in a
few states, so we pair the national target with a SHARE-WEIGHTED average of the
endemic states' climate (not a whole-country mean).

Subcommands:
  python lassa_pipeline.py build              # -> data/features_lassa.csv
  python lassa_pipeline.py train              # -> models/lassa_v1.joblib + metrics_lassa.json
  python lassa_pipeline.py predict --dry-run  # apportioned per-state rows (no write)
  python lassa_pipeline.py predict            # upsert into risk_forecast (needs ml/.env)
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from config import (
    DATA_DIR,
    FORECAST_HORIZON_DAYS,
    LAG_PERIODS,
    LASSA_ENDEMIC_STATES,
    LASSA_STATE_SHARES,
    MODELS_DIR,
    ROLLING_WINDOWS,
    STATE_CENTROIDS,
    WEATHER_CSV,
    WEATHER_START,
)

LASSA_NATIONAL = DATA_DIR / "staging_lassa_national.csv"
FEATURES = DATA_DIR / "features_lassa.csv"
MODEL_PATH = MODELS_DIR / "lassa_v1.joblib"
METRICS = MODELS_DIR / "metrics_lassa.json"
MODEL_VERSION = "lassa_v1"

HORIZON_WEEKS = max(1, round(FORECAST_HORIZON_DAYS / 7))
CLIMATE = ["temp", "humidity", "precip"]
LEVELS = ["low", "moderate", "elevated", "high"]


# ---------------------------------------------------------------- build -------
ENDEMIC_CACHE = DATA_DIR / "_endemic_weather.csv"


def _endemic_weekly_climate() -> pd.DataFrame:
    """Share-weighted weekly climate across the Lassa-endemic states."""
    if WEATHER_CSV.exists():
        daily = pd.read_csv(WEATHER_CSV, parse_dates=["date"])
        daily = daily[daily["state"].isin(LASSA_ENDEMIC_STATES)]
        if daily.empty:
            raise SystemExit("weather_daily.csv has no endemic-state rows — run fetch_weather.py.")
    elif ENDEMIC_CACHE.exists():
        daily = pd.read_csv(ENDEMIC_CACHE, parse_dates=["date"])
    else:
        # Self-sufficient: pull just the endemic states from NASA POWER, then cache
        # so subsequent builds don't re-hit the API.
        from fetch_weather import fetch_state
        from datetime import datetime as _dt

        print("No weather cache — fetching endemic-state climate from NASA POWER ...")
        end = _dt.utcnow().strftime("%Y%m%d")
        frames = []
        for s in LASSA_ENDEMIC_STATES:
            lat, lon = STATE_CENTROIDS[s]
            frames.append(fetch_state(s, lat, lon, WEATHER_START, end))
            print(f"  fetched {s}")
        daily = pd.concat(frames, ignore_index=True)
        daily.to_csv(ENDEMIC_CACHE, index=False)

    daily["date"] = pd.to_datetime(daily["date"])
    weights = {s: LASSA_STATE_SHARES[s] for s in daily["state"].unique()}
    wsum = sum(weights.values())

    # Weekly per state (precip summed, temp/humidity averaged), then share-weighted mean.
    out = []
    for s, g in daily.set_index("date").groupby("state"):
        wk = g.resample("W").agg({"temp": "mean", "humidity": "mean", "precip": "sum"})
        wk["w"] = weights[s] / wsum
        out.append(wk.reset_index().assign(state=s))
    allw = pd.concat(out, ignore_index=True)
    # Share-weighted mean per date = sum(value*w) / sum(w) — vectorized, no apply.
    for c in CLIMATE:
        allw[c] = allw[c] * allw["w"]
    grp = allw.groupby("date")
    agg = grp[CLIMATE].sum().div(grp["w"].sum(), axis=0).reset_index()
    agg["date"] = agg["date"].dt.to_period("W").dt.start_time
    return agg


def build() -> pd.DataFrame:
    if not LASSA_NATIONAL.exists():
        raise SystemExit(f"{LASSA_NATIONAL} not found — run ingest/ncdc_lassa_pdf.py first.")
    lassa = pd.read_csv(LASSA_NATIONAL, parse_dates=["date"])
    lassa = lassa[["date", "confirmed_week"]].dropna().sort_values("date")
    lassa["date"] = lassa["date"].dt.to_period("W").dt.start_time

    climate = _endemic_weekly_climate()
    df = lassa.merge(climate, on="date", how="inner").sort_values("date").reset_index(drop=True)

    # Lagged climate + rolling means (dry-season/rodent lag can be long).
    for col in CLIMATE:
        for lag in LAG_PERIODS:
            df[f"{col}_lag_{lag}"] = df[col].shift(lag)
        for win in ROLLING_WINDOWS:
            df[f"{col}_roll_{win}"] = df[col].shift(1).rolling(win).mean()

    # Seasonality + recent-case memory.
    wk = df["date"].dt.isocalendar().week.astype(int)
    df["season_sin"] = np.sin(2 * np.pi * wk / 52)
    df["season_cos"] = np.cos(2 * np.pi * wk / 52)
    df["cases_lag_1"] = df["confirmed_week"].shift(1)
    df["cases_lag_2"] = df["confirmed_week"].shift(2)
    df["cases_roll_4"] = df["confirmed_week"].shift(1).rolling(4).mean()

    # Target: national confirmed HORIZON weeks ahead (the forward projection).
    df["target"] = df["confirmed_week"].shift(-HORIZON_WEEKS)

    df.to_csv(FEATURES, index=False)
    print(f"Wrote {len(df)} weekly rows -> {FEATURES} "
          f"(horizon={HORIZON_WEEKS}w; trainable={int(df['target'].notna().sum())})")
    return df


# ---------------------------------------------------------------- train -------
def _feature_cols(df: pd.DataFrame) -> list[str]:
    drop = {"date", "confirmed_week", "target"}
    return [c for c in df.columns if c not in drop]


def _season_baseline(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    tb = train.copy()
    tb["wk"] = tb["date"].dt.isocalendar().week.astype(int)
    by_wk = tb.groupby("wk")["target"].mean()
    gmean = tb["target"].mean()
    wk = test["date"].dt.isocalendar().week.astype(int)
    return wk.map(by_wk).fillna(gmean).to_numpy()


def train() -> None:
    from sklearn.metrics import mean_absolute_error

    if not FEATURES.exists():
        raise SystemExit(f"{FEATURES} not found — run `build` first.")
    df = pd.read_csv(FEATURES, parse_dates=["date"]).dropna(subset=["target"]).reset_index(drop=True)
    if len(df) < 100:
        raise SystemExit(f"Only {len(df)} trainable weeks — too thin. Gather more reports.")

    try:
        from xgboost import XGBRegressor
    except ImportError:
        raise SystemExit("xgboost not installed — pip install -r requirements.txt")

    feats = _feature_cols(df)
    df = df.sort_values("date").reset_index(drop=True)
    n, folds = len(df), 4
    block = n // (folds + 1)
    rows = []
    for k in range(1, folds + 1):
        cut = k * block
        tr, te = df.iloc[:cut], df.iloc[cut:cut + block]
        if len(tr) < 40 or te.empty:
            continue
        med = tr[feats].median()
        model = XGBRegressor(n_estimators=350, max_depth=3, learning_rate=0.05,
                             subsample=0.85, colsample_bytree=0.85, random_state=42, n_jobs=4)
        model.fit(tr[feats].fillna(med), tr["target"])
        xgb = mean_absolute_error(te["target"], model.predict(te[feats].fillna(med)))
        base = mean_absolute_error(te["target"], _season_baseline(tr, te))
        rows.append({"test_start": str(te["date"].iloc[0].date()), "n": len(te),
                     "xgb_mae": xgb, "base_mae": base})
        print(f"  fold from {te['date'].iloc[0].date()} (n={len(te)}): "
              f"XGB MAE={xgb:.2f}  baseline MAE={base:.2f}")

    xgb_avg = float(np.mean([r["xgb_mae"] for r in rows]))
    base_avg = float(np.mean([r["base_mae"] for r in rows]))
    winner = "xgboost" if xgb_avg < base_avg else "baseline"
    print(f"\nWalk-forward avg MAE — XGB={xgb_avg:.2f} baseline={base_avg:.2f} -> winner: {winner}")

    importances: dict[str, float] = {}
    if winner == "xgboost":
        import joblib
        med = df[feats].median()
        final = XGBRegressor(n_estimators=350, max_depth=3, learning_rate=0.05,
                             subsample=0.85, colsample_bytree=0.85, random_state=42, n_jobs=4)
        final.fit(df[feats].fillna(med), df["target"])
        joblib.dump({"model": final, "features": feats, "medians": med.to_dict()}, MODEL_PATH)
        importances = dict(sorted(zip(feats, map(float, final.feature_importances_)),
                                  key=lambda kv: kv[1], reverse=True))
        print(f"Saved model -> {MODEL_PATH}")
    elif MODEL_PATH.exists():
        MODEL_PATH.unlink()

    METRICS.write_text(json.dumps({
        "model_version": MODEL_VERSION, "winner": winner, "n_rows": len(df),
        "xgb_avg_mae": xgb_avg, "baseline_avg_mae": base_avg, "folds": rows,
        "top_features": dict(list(importances.items())[:12]),
    }, indent=2))
    print(f"Wrote {METRICS}")


# -------------------------------------------------------------- predict -------
def _drivers() -> list[str]:
    if not METRICS.exists():
        return []
    top = json.loads(METRICS.read_text()).get("top_features", {})
    pretty = {"precip": "rainfall", "temp": "temperature", "humidity": "humidity",
              "cases": "recent cases", "season": "seasonal pattern"}
    names: list[str] = []
    for f in list(top)[:5]:
        label = pretty.get(f.split("_")[0], f.split("_")[0])
        if label not in names:
            names.append(label)
    return names[:3]


def _level(value: float, q: tuple[float, float, float]) -> str:
    p50, p75, p90 = q
    if value >= p90:
        return "high"
    if value >= p75:
        return "elevated"
    if value >= p50:
        return "moderate"
    return "low"


def _step_down(level: str, steps: int) -> str:
    i = max(0, LEVELS.index(level) - steps)
    return LEVELS[i]


def _confidence() -> float:
    if not METRICS.exists():
        return 0.5
    m = json.loads(METRICS.read_text())
    xgb, base = m.get("xgb_avg_mae"), m.get("baseline_avg_mae")
    if xgb and base and base > 0:
        return round(float(np.clip(0.5 + (base - xgb) / base * 0.4, 0.4, 0.85)), 2)
    return 0.5


def predict(dry_run: bool) -> None:
    if not FEATURES.exists():
        raise SystemExit(f"{FEATURES} not found — run `build` first.")
    df = pd.read_csv(FEATURES, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    hist = df["confirmed_week"].dropna()
    q = (float(hist.quantile(0.50)), float(hist.quantile(0.75)), float(hist.quantile(0.90)))

    latest = df.iloc[-1]
    if MODEL_PATH.exists():
        import joblib
        b = joblib.load(MODEL_PATH)
        x = pd.DataFrame([latest[b["features"]]]).fillna(pd.Series(b["medians"]))
        national_score = float(b["model"].predict(x)[0])
        source_version = MODEL_VERSION
    else:
        # Baseline fallback: seasonal mean for the target week-of-year.
        wk = int((latest["date"] + timedelta(weeks=HORIZON_WEEKS)).isocalendar().week)
        by_wk = df.assign(w=df["date"].dt.isocalendar().week.astype(int)).groupby("w")["confirmed_week"].mean()
        national_score = float(by_wk.get(wk, hist.mean()))
        source_version = "seasonal_baseline"

    national_level = _level(national_score, q)
    drivers = _drivers()
    now = datetime.now(timezone.utc)
    period_start = (now + timedelta(weeks=HORIZON_WEEKS)).date().isoformat()
    valid_until = (now + timedelta(weeks=HORIZON_WEEKS + 1)).isoformat()
    wsum = sum(LASSA_STATE_SHARES.values())

    rows = []
    for state, share in LASSA_STATE_SHARES.items():
        share_n = share / wsum
        # Big-share states carry the national level; smaller-share states step down
        # so we never overstate risk for a state that rarely sees Lassa.
        steps = 0 if share_n >= 0.15 else (1 if share_n >= 0.05 else 2)
        level = _step_down(national_level, steps)
        rows.append({
            "state": state,
            "disease": "lassa",
            "forecast_period_start": period_start,
            "forecast_horizon_days": HORIZON_WEEKS * 7,
            "projected_risk_level": level,
            "risk_score": round(national_score * share_n, 2),
            "confidence": _confidence(),
            "driver_factors": drivers,
            "summary": (
                f"National Lassa fever risk is projected to be {national_level} over the next "
                f"{HORIZON_WEEKS} weeks; {state} historically accounts for ~{round(share_n*100)}% "
                f"of confirmed cases. This is a risk projection, not a diagnosis or confirmed outbreak."
            ),
            "model_version": source_version,
            "generated_at": now.isoformat(),
            "valid_until": valid_until,
        })

    print(f"National Lassa projection: {national_level} (score={national_score:.1f}, "
          f"model={source_version}, conf={_confidence()})")
    if dry_run:
        print(f"[dry-run] {len(rows)} apportioned state rows:")
        for r in rows:
            print(f"  {r['state']:<10} {r['projected_risk_level']:<9} score={r['risk_score']}")
        return

    from predict_and_write import upsert
    upsert(rows)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "train", "predict"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.cmd == "build":
        build()
    elif args.cmd == "train":
        train()
    else:
        predict(args.dry_run)
