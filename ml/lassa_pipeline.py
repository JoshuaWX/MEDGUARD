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
# Tier thresholds (quantiles of the smoothed forward target): elevated >= p70, high >= p90.
ELEVATED_Q = 0.70
HIGH_Q = 0.90


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

    # Regression target (kept for reference): confirmed HORIZON weeks ahead.
    df["target"] = df["confirmed_week"].shift(-HORIZON_WEEKS)

    # TIER target (the professional framing): smooth the next HORIZON-week window
    # (mean weekly confirmed) to cut noise, then bucket against the national
    # historical distribution — normal < p70, elevated p70-p90, high >= p90.
    fwd = df["confirmed_week"].rolling(HORIZON_WEEKS).mean().shift(-HORIZON_WEEKS)
    df["target_mean"] = fwd
    thr_e = float(fwd.quantile(ELEVATED_Q))
    thr_h = float(fwd.quantile(HIGH_Q))
    tier = np.select([fwd >= thr_h, fwd >= thr_e], [2, 1], default=0).astype(float)
    tier[fwd.isna().to_numpy()] = np.nan
    df["target_tier"] = tier
    df["elevated_bin"] = np.where(fwd.isna(), np.nan, (fwd >= thr_e).astype(float))

    df.to_csv(FEATURES, index=False)
    print(f"Wrote {len(df)} weekly rows -> {FEATURES} "
          f"(horizon={HORIZON_WEEKS}w; elevated>={thr_e:.1f}/wk, high>={thr_h:.1f}/wk; "
          f"trainable={int(df['elevated_bin'].notna().sum())}, "
          f"elevated weeks={int(np.nansum(df['elevated_bin']))})")
    return df


# ---------------------------------------------------------------- train -------
def _feature_cols(df: pd.DataFrame) -> list[str]:
    drop = {"date", "confirmed_week", "target", "target_mean", "target_tier", "elevated_bin"}
    return [c for c in df.columns if c not in drop]


def _season_prob(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    """Seasonal baseline P(elevated): historical elevated-rate by week-of-year."""
    tb = train.copy()
    tb["wk"] = tb["date"].dt.isocalendar().week.astype(int)
    by_wk = tb.groupby("wk")["elevated_bin"].mean()
    gmean = float(tb["elevated_bin"].mean())
    wk = test["date"].dt.isocalendar().week.astype(int)
    return wk.map(by_wk).fillna(gmean).to_numpy()


def _new_classifier():
    from xgboost import XGBClassifier
    return XGBClassifier(n_estimators=350, max_depth=3, learning_rate=0.05,
                         subsample=0.85, colsample_bytree=0.85, random_state=42,
                         n_jobs=4, eval_metric="logloss")


def _auc(y, p) -> float | None:
    from sklearn.metrics import roc_auc_score
    return float(roc_auc_score(y, p)) if len(set(y)) > 1 else None


def train() -> None:
    from sklearn.metrics import accuracy_score

    if not FEATURES.exists():
        raise SystemExit(f"{FEATURES} not found — run `build` first.")
    df = pd.read_csv(FEATURES, parse_dates=["date"]).dropna(subset=["elevated_bin"]).reset_index(drop=True)
    df["elevated_bin"] = df["elevated_bin"].astype(int)
    if len(df) < 100:
        raise SystemExit(f"Only {len(df)} trainable weeks — too thin. Gather more reports.")
    try:
        import xgboost  # noqa: F401
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
        if len(tr) < 40 or te.empty or tr["elevated_bin"].nunique() < 2:
            continue
        med = tr[feats].median()
        clf = _new_classifier()
        clf.fit(tr[feats].fillna(med), tr["elevated_bin"])
        p = clf.predict_proba(te[feats].fillna(med))[:, 1]
        pb = _season_prob(tr, te)
        rows.append({
            "test_start": str(te["date"].iloc[0].date()), "n": int(len(te)),
            "xgb_auc": _auc(te["elevated_bin"], p), "base_auc": _auc(te["elevated_bin"], pb),
            "xgb_acc": float(accuracy_score(te["elevated_bin"], (p >= 0.5).astype(int))),
        })
        print(f"  fold from {te['date'].iloc[0].date()} (n={len(te)}): "
              f"XGB AUC={_fmt(rows[-1]['xgb_auc'])}  baseline AUC={_fmt(rows[-1]['base_auc'])}  "
              f"acc={rows[-1]['xgb_acc']:.2f}")

    xgb_auc = float(np.mean([r["xgb_auc"] for r in rows if r["xgb_auc"] is not None]))
    base_auc = float(np.mean([r["base_auc"] for r in rows if r["base_auc"] is not None]))
    acc = float(np.mean([r["xgb_acc"] for r in rows]))
    winner = "xgboost" if xgb_auc >= base_auc else "baseline"
    print(f"\nWalk-forward AUC — XGB={xgb_auc:.2f} baseline={base_auc:.2f} | accuracy={acc:.0%} "
          f"-> winner: {winner}")

    importances: dict[str, float] = {}
    if winner == "xgboost":
        import joblib
        med = df[feats].median()
        final = _new_classifier()
        final.fit(df[feats].fillna(med), df["elevated_bin"])
        joblib.dump({"model": final, "features": feats, "medians": med.to_dict(),
                     "task": "tier"}, MODEL_PATH)
        importances = dict(sorted(zip(feats, map(float, final.feature_importances_)),
                                  key=lambda kv: kv[1], reverse=True))
        print(f"Saved classifier -> {MODEL_PATH}")
    elif MODEL_PATH.exists():
        MODEL_PATH.unlink()

    METRICS.write_text(json.dumps({
        "model_version": MODEL_VERSION, "task": "tier", "winner": winner, "n_rows": len(df),
        "elevated_rate": round(float(df["elevated_bin"].mean()), 3),
        "xgb_auc": round(xgb_auc, 3), "baseline_auc": round(base_auc, 3), "accuracy": round(acc, 3),
        "folds": rows, "top_features": dict(list(importances.items())[:12]),
    }, indent=2))
    print(f"Wrote {METRICS}")


def _fmt(v) -> str:
    return f"{v:.2f}" if isinstance(v, (int, float)) else "n/a"


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


def _level_from_prob(p: float) -> str:
    """Map P(elevated) to the app's 4 display levels."""
    if p >= 0.75:
        return "high"
    if p >= 0.5:
        return "elevated"
    if p >= 0.25:
        return "moderate"
    return "low"


def _step_down(level: str, steps: int) -> str:
    i = max(0, LEVELS.index(level) - steps)
    return LEVELS[i]


def _confidence() -> float:
    """Confidence from validated discrimination (AUC)."""
    if not METRICS.exists():
        return 0.5
    auc = json.loads(METRICS.read_text()).get("xgb_auc")
    if isinstance(auc, (int, float)):
        return round(float(np.clip(auc, 0.4, 0.9)), 2)
    return 0.5


def _national_prob(df: pd.DataFrame) -> tuple[float, str]:
    """P(elevated) for the coming window: from the classifier, else seasonal baseline."""
    latest = df.iloc[-1]
    if MODEL_PATH.exists():
        import joblib
        b = joblib.load(MODEL_PATH)
        x = pd.DataFrame([latest[b["features"]]]).fillna(pd.Series(b["medians"]))
        return float(b["model"].predict_proba(x)[0, 1]), MODEL_VERSION
    wk = int((latest["date"] + timedelta(weeks=HORIZON_WEEKS)).isocalendar().week)
    by_wk = df.assign(w=df["date"].dt.isocalendar().week.astype(int)).groupby("w")["elevated_bin"].mean()
    return float(by_wk.get(wk, float(df["elevated_bin"].mean()))), "seasonal_baseline"


def predict(dry_run: bool) -> None:
    if not FEATURES.exists():
        raise SystemExit(f"{FEATURES} not found — run `build` first.")
    df = pd.read_csv(FEATURES, parse_dates=["date"]).sort_values("date").reset_index(drop=True)

    prob, source_version = _national_prob(df)
    national_level = _level_from_prob(prob)
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
            "risk_score": round(prob, 3),
            "confidence": _confidence(),
            "driver_factors": drivers,
            "summary": (
                f"National Lassa fever risk is projected to be {national_level} over the next "
                f"{HORIZON_WEEKS} weeks; {state} historically accounts for ~{round(share_n*100)}% "
                f"of reported Lassa cases. This is a risk projection, not a diagnosis or a confirmed outbreak."
            ),
            "model_version": source_version,
            "generated_at": now.isoformat(),
            "valid_until": valid_until,
        })

    print(f"National Lassa projection: {national_level} (P(elevated)={prob:.2f}, "
          f"model={source_version}, conf={_confidence()})")
    if dry_run:
        print(f"[dry-run] {len(rows)} apportioned state rows:")
        for r in rows:
            print(f"  {r['state']:<10} {r['projected_risk_level']:<9} p={r['risk_score']}")
        return

    from predict_and_write import upsert
    upsert(rows)


# ------------------------------------------------------------- backtest -------
def backtest() -> None:
    """Honest evidence for the TIER model: walk forward through history, at each
    step predicting the elevated-risk label for weeks the model NEVER trained on,
    and compare to what actually happened. Reports the metrics that matter for a
    risk warning — accuracy, ROC-AUC, and precision/recall for the 'elevated'
    class — vs the seasonal baseline. Writes data/lassa_backtest_tier.csv.
    """
    from sklearn.metrics import accuracy_score, precision_score, recall_score

    if not FEATURES.exists():
        raise SystemExit(f"{FEATURES} not found — run `build` first.")
    df = pd.read_csv(FEATURES, parse_dates=["date"]).dropna(subset=["elevated_bin"]).sort_values("date").reset_index(drop=True)
    df["elevated_bin"] = df["elevated_bin"].astype(int)
    try:
        import xgboost  # noqa: F401
    except ImportError:
        raise SystemExit("xgboost not installed — pip install -r requirements.txt")

    feats = _feature_cols(df)
    n = len(df)
    start = max(60, n // 3)          # warm-up training window
    step = 8                          # retrain every 8 weeks
    preds = []
    i = start
    while i < n:
        tr = df.iloc[:i]
        te = df.iloc[i:i + step]
        if tr["elevated_bin"].nunique() < 2:
            i += step
            continue
        med = tr[feats].median()
        clf = _new_classifier()
        clf.fit(tr[feats].fillna(med), tr["elevated_bin"])
        p = clf.predict_proba(te[feats].fillna(med))[:, 1]
        pb = _season_prob(tr, te)
        for j, (_, row) in enumerate(te.iterrows()):
            preds.append({
                "date": row["date"].date().isoformat(),
                "actual_elevated": int(row["elevated_bin"]),
                "xgb_prob": round(float(p[j]), 3),
                "baseline_prob": round(float(pb[j]), 3),
            })
        i += step

    bt = pd.DataFrame(preds)
    out = DATA_DIR / "lassa_backtest_tier.csv"
    bt.to_csv(out, index=False)

    y = bt["actual_elevated"]
    xp = (bt["xgb_prob"] >= 0.5).astype(int)
    bp = (bt["baseline_prob"] >= 0.5).astype(int)
    acc = accuracy_score(y, xp)
    prec = precision_score(y, xp, zero_division=0)
    rec = recall_score(y, xp, zero_division=0)
    auc = _auc(y, bt["xgb_prob"])
    base_acc = accuracy_score(y, bp)
    base_auc = _auc(y, bt["baseline_prob"])

    print(f"Tier backtest over {len(bt)} held-out weeks ({bt['date'].min()} .. {bt['date'].max()})")
    print(f"  question: 'will the next {HORIZON_WEEKS} weeks be an ELEVATED Lassa period?' "
          f"({y.mean()*100:.0f}% of weeks were)")
    print(f"  accuracy:   XGBoost {acc*100:.0f}%   seasonal baseline {base_acc*100:.0f}%")
    print(f"  ROC-AUC:    XGBoost {_fmt(auc)}     seasonal baseline {_fmt(base_auc)}")
    print(f"  when it flags ELEVATED: precision {prec*100:.0f}% (right when it warns), "
          f"recall {rec*100:.0f}% (caught of all elevated periods)")
    print(f"  wrote per-week predicted-vs-actual -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "train", "predict", "backtest"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.cmd == "build":
        build()
    elif args.cmd == "train":
        train()
    elif args.cmd == "backtest":
        backtest()
    else:
        predict(args.dry_run)
