"""Produce the current per-state malaria projection and upsert into Supabase.

Serving = Pattern A: this offline job writes rows to public.risk_forecast via the
service-role REST API. The `intel` edge function reads them; the Brain surfaces
them as a PROJECTION (never an outbreak confirmation).

Risk level is assigned RELATIVE to each state's own history (quantiles of past
case load), so a "high" projection means "high for this state", not an absolute
that misfires across very different baselines.

Usage:
  python predict_and_write.py --dry-run   # print rows, write nothing
  python predict_and_write.py             # upsert to risk_forecast (needs ml/.env)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv optional; env may be set externally
    pass

import requests  # noqa: E402

from config import (  # noqa: E402
    DISEASE,
    FEATURES_CSV,
    FORECAST_HORIZON_DAYS,
    METRICS_JSON,
    MODEL_PATH,
    MODEL_VERSION,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)

LEVELS = ["low", "moderate", "elevated", "high"]


def _latest_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Most recent period per state (the basis for the live projection)."""
    return df.sort_values("date").groupby("state", as_index=False).tail(1).reset_index(drop=True)


def _state_quantiles(df: pd.DataFrame) -> dict[str, tuple[float, float, float]]:
    """Per-state 50/75/90 percentiles of historical case load for level bucketing."""
    out: dict[str, tuple[float, float, float]] = {}
    if "cases" not in df.columns:
        return out
    for state, grp in df.groupby("state"):
        vals = grp["cases"].dropna()
        if len(vals) >= 8:
            out[state] = (float(vals.quantile(0.50)), float(vals.quantile(0.75)), float(vals.quantile(0.90)))
    return out


def _level_for(value: float, q: tuple[float, float, float] | None) -> str:
    if q is None or any(np.isnan(x) for x in q):
        return "moderate"  # honest "unknown" middle when we can't rank
    p50, p75, p90 = q
    if value >= p90:
        return "high"
    if value >= p75:
        return "elevated"
    if value >= p50:
        return "moderate"
    return "low"


def _drivers() -> list[str]:
    if not METRICS_JSON.exists():
        return []
    top = json.loads(METRICS_JSON.read_text()).get("top_features", {})
    pretty = {
        "precip": "rainfall", "temp": "temperature", "humidity": "humidity",
        "cases": "recent cases", "season": "seasonal pattern",
    }
    names: list[str] = []
    for feat in list(top)[:4]:
        base = feat.split("_")[0]
        label = pretty.get(base, base)
        if label not in names:
            names.append(label)
    return names[:3]


def _seasonal_predict(rows: pd.DataFrame, hist: pd.DataFrame) -> np.ndarray:
    """Fallback when no XGBoost model shipped (baseline won / thin data)."""
    if "cases" not in hist.columns:
        return np.full(len(rows), np.nan)
    hist = hist.copy()
    hist["bucket"] = hist["date"].dt.isocalendar().week.astype(int)
    by_state_bucket = hist.groupby(["state", "bucket"])["cases"].mean()
    state_mean = hist.groupby("state")["cases"].mean()
    preds = []
    for _, r in rows.iterrows():
        bucket = pd.Timestamp(r["date"]).isocalendar().week
        val = by_state_bucket.get((r["state"], bucket), np.nan)
        if np.isnan(val):
            val = state_mean.get(r["state"], np.nan)
        preds.append(val)
    return np.asarray(preds, dtype=float)


def build_forecasts() -> list[dict]:
    if not FEATURES_CSV.exists():
        raise SystemExit(f"{FEATURES_CSV} not found — run build_dataset.py first.")
    df = pd.read_csv(FEATURES_CSV, parse_dates=["date"])
    latest = _latest_rows(df)

    # Choose predictor: shipped model, else seasonal baseline.
    if MODEL_PATH.exists():
        import joblib

        bundle = joblib.load(MODEL_PATH)
        model, feat_cols, medians = bundle["model"], bundle["features"], bundle["medians"]
        x = latest[feat_cols].fillna(pd.Series(medians))
        scores = model.predict(x)
        source_version = MODEL_VERSION
    else:
        scores = _seasonal_predict(latest, df)
        source_version = "seasonal_baseline"
        if np.all(np.isnan(scores)):
            raise SystemExit(
                "No model and no labels to form a baseline — train first (train.py) "
                "or provide data/labels.csv."
            )

    quants = _state_quantiles(df)
    drivers = _drivers()
    now = datetime.now(timezone.utc)
    period_start = (now + timedelta(days=FORECAST_HORIZON_DAYS)).date()
    valid_until = (now + timedelta(days=FORECAST_HORIZON_DAYS + 7)).isoformat()

    rows: list[dict] = []
    for i, r in latest.iterrows():
        score = float(scores[i]) if not np.isnan(scores[i]) else None
        if score is None:
            continue
        level = _level_for(score, quants.get(r["state"]))
        why = f" Key drivers: {', '.join(drivers)}." if drivers else ""
        rows.append({
            "state": r["state"],
            "disease": DISEASE,
            "forecast_period_start": period_start.isoformat(),
            "forecast_horizon_days": FORECAST_HORIZON_DAYS,
            "projected_risk_level": level,
            "risk_score": round(score, 2),
            "confidence": _confidence(),
            "driver_factors": drivers,
            "summary": (
                f"Malaria transmission risk is projected to be {level} in {r['state']} over the "
                f"next {FORECAST_HORIZON_DAYS // 7} weeks based on recent and seasonal climate "
                f"conditions.{why} This is a risk projection, not a diagnosis or confirmed outbreak."
            ),
            "model_version": source_version,
            "generated_at": now.isoformat(),
            "valid_until": valid_until,
        })
    return rows


def _confidence() -> float:
    """Confidence from validated performance: how much XGBoost beat the baseline."""
    if not METRICS_JSON.exists():
        return 0.5
    m = json.loads(METRICS_JSON.read_text())
    xgb, base = m.get("xgb_avg_mae"), m.get("baseline_avg_mae")
    if xgb and base and base > 0:
        return round(float(np.clip(0.5 + (base - xgb) / base * 0.4, 0.4, 0.85)), 2)
    return 0.5


def upsert(rows: list[dict]) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — see ml/.env.example.")
    endpoint = f"{SUPABASE_URL}/rest/v1/risk_forecast"
    resp = requests.post(
        endpoint,
        params={"on_conflict": "state,disease,forecast_period_start,model_version"},
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        data=json.dumps(rows),
        timeout=60,
    )
    if resp.status_code >= 300:
        raise SystemExit(f"Upsert failed ({resp.status_code}): {resp.text}")
    print(f"Upserted {len(rows)} forecast rows.")


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    rows = build_forecasts()
    if not rows:
        print("No forecast rows produced (no usable predictions).")
        return
    if dry_run:
        print(f"[dry-run] {len(rows)} rows (showing up to 5):")
        for row in rows[:5]:
            print(f"  {row['state']:<12} {row['projected_risk_level']:<9} "
                  f"score={row['risk_score']} conf={row['confidence']} model={row['model_version']}")
        return
    upsert(rows)


if __name__ == "__main__":
    main()
