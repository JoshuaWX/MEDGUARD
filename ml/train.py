"""Train the malaria forecaster and validate it honestly.

Key principles (locked):
  * Walk-forward / temporal validation — NEVER a random split (time-series
    leakage is the #1 way these models look great and fail in the field).
  * Always benchmark against a seasonal baseline. If XGBoost can't beat it on
    held-out folds, the baseline "wins" and no model artifact is emitted.
  * No accuracy is claimed that metrics.json doesn't reproduce.

Without a labels file (no `target` column) this runs nothing trainable and exits
cleanly — it will not fabricate a model.
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

from config import FEATURES_CSV, METRICS_JSON, MODEL_PATH, MODEL_VERSION, PERIOD

MIN_TRAIN_ROWS = 200      # below this, data is too thin to trust a model
N_FOLDS = 4


def _feature_cols(df: pd.DataFrame) -> list[str]:
    drop = {"state", "date", "cases", "target"}
    return [c for c in df.columns if c not in drop]


def _season_bucket(dates: pd.Series) -> pd.Series:
    if PERIOD == "W":
        return dates.dt.isocalendar().week.astype(int)
    return dates.dt.month


def seasonal_baseline_predict(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    """Predict each test row as the mean historical target for its state+season."""
    train = train.copy()
    train["bucket"] = _season_bucket(train["date"])
    by_state_bucket = train.groupby(["state", "bucket"])["target"].mean()
    state_mean = train.groupby("state")["target"].mean()
    global_mean = train["target"].mean()

    test = test.copy()
    test["bucket"] = _season_bucket(test["date"])
    preds = []
    for _, row in test.iterrows():
        val = by_state_bucket.get((row["state"], row["bucket"]), np.nan)
        if np.isnan(val):
            val = state_mean.get(row["state"], global_mean)
        preds.append(val)
    return np.asarray(preds, dtype=float)


def walk_forward_blocks(
    periods: list[pd.Timestamp], n_folds: int
) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
    """Expanding-window folds. Each fold trains on everything before `start` and
    tests on the block of periods in [start, end). Testing a block (not a single
    period) keeps each fold's evaluation statistically meaningful."""
    n = len(periods)
    if n < (n_folds + 1) * 2:
        # Too few periods for blocks: fall back to one period per fold.
        return [(p, p) for p in periods[-n_folds:]]
    block = n // (n_folds + 1)
    bounds: list[tuple[pd.Timestamp, pd.Timestamp]] = []
    for k in range(1, n_folds + 1):
        start = periods[k * block]
        end = periods[min((k + 1) * block, n - 1)]
        bounds.append((start, end))
    return bounds


def train() -> None:
    if not FEATURES_CSV.exists():
        raise SystemExit(f"{FEATURES_CSV} not found — run build_dataset.py first.")

    df = pd.read_csv(FEATURES_CSV, parse_dates=["date"])

    if "target" not in df.columns:
        print(
            "No `target` column (no labels) -> nothing to train.\n"
            "  Provide data/labels.csv (see data/README.md) and rerun build_dataset.py."
        )
        return

    df = df.dropna(subset=["target"])
    if len(df) < MIN_TRAIN_ROWS:
        print(
            f"Only {len(df)} labeled+featured rows (< {MIN_TRAIN_ROWS}). Too thin to trust a\n"
            "  model. Shipping the SEASONAL BASELINE; gather more history and rerun."
        )
        _write_metrics(winner="baseline", reason="insufficient_data", n_rows=len(df))
        return

    try:
        from xgboost import XGBRegressor
    except ImportError:
        raise SystemExit("xgboost not installed — pip install -r requirements.txt")

    feat_cols = _feature_cols(df)
    df = df.sort_values("date").reset_index(drop=True)
    periods = sorted(pd.Timestamp(p) for p in df["date"].unique())
    blocks = walk_forward_blocks(periods, N_FOLDS)

    fold_rows = []
    for start, end in blocks:
        train_df = df[df["date"] < start]
        test_df = df[(df["date"] >= start) & (df["date"] <= end)] if start != end else df[df["date"] == start]
        if len(train_df) < 50 or test_df.empty:
            continue

        medians = train_df[feat_cols].median()
        x_tr = train_df[feat_cols].fillna(medians)
        x_te = test_df[feat_cols].fillna(medians)

        model = XGBRegressor(
            n_estimators=400,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=42,
            n_jobs=4,
        )
        model.fit(x_tr, train_df["target"])
        xgb_mae = mean_absolute_error(test_df["target"], model.predict(x_te))
        base_mae = mean_absolute_error(
            test_df["target"], seasonal_baseline_predict(train_df, test_df)
        )
        fold_rows.append({
            "test_start": str(start.date()), "test_end": str(end.date()),
            "n_test": int(len(test_df)), "xgb_mae": xgb_mae, "base_mae": base_mae,
        })
        print(f"  fold {start.date()}..{end.date()} (n={len(test_df)}): "
              f"XGBoost MAE={xgb_mae:.2f}  baseline MAE={base_mae:.2f}")

    if not fold_rows:
        print("Could not form walk-forward folds — need more distinct periods.")
        _write_metrics(winner="baseline", reason="no_folds", n_rows=len(df))
        return

    xgb_avg = float(np.mean([f["xgb_mae"] for f in fold_rows]))
    base_avg = float(np.mean([f["base_mae"] for f in fold_rows]))
    winner = "xgboost" if xgb_avg < base_avg else "baseline"
    print(f"\nWalk-forward avg MAE — XGBoost={xgb_avg:.2f}  baseline={base_avg:.2f}  -> winner: {winner}")

    importances: dict[str, float] = {}
    if winner == "xgboost":
        # Refit on all labeled data and persist.
        import joblib

        x_all = df[feat_cols].fillna(df[feat_cols].median())
        final = XGBRegressor(
            n_estimators=400, max_depth=4, learning_rate=0.05,
            subsample=0.85, colsample_bytree=0.85, random_state=42, n_jobs=4,
        )
        final.fit(x_all, df["target"])
        joblib.dump({"model": final, "features": feat_cols, "medians": df[feat_cols].median().to_dict()}, MODEL_PATH)
        importances = dict(sorted(zip(feat_cols, map(float, final.feature_importances_)),
                                  key=lambda kv: kv[1], reverse=True))
        print(f"Saved model -> {MODEL_PATH}")
    else:
        # Baseline wins; do not ship an XGBoost model.
        if MODEL_PATH.exists():
            MODEL_PATH.unlink()
        print("Baseline wins — no XGBoost model emitted (seasonal baseline ships).")

    _write_metrics(
        winner=winner, reason="walk_forward", n_rows=len(df),
        xgb_avg_mae=xgb_avg, baseline_avg_mae=base_avg,
        folds=fold_rows, top_features=dict(list(importances.items())[:12]),
    )


def _write_metrics(**kw) -> None:
    payload = {"model_version": MODEL_VERSION, "period": PERIOD, **kw}
    METRICS_JSON.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {METRICS_JSON}")


if __name__ == "__main__":
    train()
