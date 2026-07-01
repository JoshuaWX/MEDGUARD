"""Load and validate the user-provided labels file (the ground-truth bottleneck).

Returns a clean labels DataFrame [state, date, disease, cases] or None if no
usable labels exist. Validation is intentionally loud: bad ground truth produces
confidently wrong forecasts, so problems are surfaced, not silently dropped.
"""

from __future__ import annotations

import pandas as pd

from config import DISEASE, LABELS_CSV, STATES

REQUIRED_COLS = {"state", "date", "disease", "cases"}


def load_labels(verbose: bool = True) -> pd.DataFrame | None:
    if not LABELS_CSV.exists():
        if verbose:
            print(
                f"No labels file at {LABELS_CSV}.\n"
                "  -> The pipeline will run the SEASONAL BASELINE ONLY and will not\n"
                "     train or emit a model. See data/README.md for the label schema."
            )
        return None

    df = pd.read_csv(LABELS_CSV)
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"labels.csv missing required columns: {sorted(missing)}")

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["cases"] = pd.to_numeric(df["cases"], errors="coerce")
    df = df[df["disease"].astype(str).str.lower() == DISEASE]

    issues: list[str] = []

    bad_dates = int(df["date"].isna().sum())
    if bad_dates:
        issues.append(f"{bad_dates} rows with unparseable dates (dropped)")
        df = df.dropna(subset=["date"])

    bad_cases = int(df["cases"].isna().sum())
    if bad_cases:
        issues.append(f"{bad_cases} rows with non-numeric cases (dropped)")
        df = df.dropna(subset=["cases"])

    negatives = int((df["cases"] < 0).sum())
    if negatives:
        issues.append(f"{negatives} rows with negative cases (dropped)")
        df = df[df["cases"] >= 0]

    unknown_states = sorted(set(df["state"]) - set(STATES))
    if unknown_states:
        issues.append(f"states not in config.STATES (dropped): {unknown_states}")
        df = df[df["state"].isin(STATES)]

    if df.empty:
        if verbose:
            print("labels.csv contained no usable malaria rows after validation -> baseline only.")
        return None

    # Outlier sniff test (per-state robust z on cases) — report, do not drop.
    outlier_states: list[str] = []
    for state, grp in df.groupby("state"):
        med = grp["cases"].median()
        mad = (grp["cases"] - med).abs().median()
        if mad and ((grp["cases"] - med).abs() > 8 * mad).any():
            outlier_states.append(state)

    if verbose:
        covered = df["state"].nunique()
        span = f"{df['date'].min().date()} .. {df['date'].max().date()}"
        print(f"Labels: {len(df):,} rows | {covered}/{len(STATES)} states | {span}")
        for msg in issues:
            print(f"  ! {msg}")
        if outlier_states:
            print(f"  ? possible outliers (review, not dropped): {outlier_states}")
        if covered < len(STATES):
            print(f"  ! {len(STATES) - covered} states have NO labels — they get no forecast.")

    return df.sort_values(["state", "date"]).reset_index(drop=True)


if __name__ == "__main__":
    load_labels()
