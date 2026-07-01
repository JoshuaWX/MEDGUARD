"""Central configuration for the MedGuard forecasting pipeline.

State-level granularity (36 states + FCT). One representative centroid per state
is used to pull climate history from NASA POWER. State names match the
normalized names used by the `intel` edge function so forecasts key cleanly to
`risk_forecast.state`.
"""

from __future__ import annotations

import os
from pathlib import Path

# --- Paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

WEATHER_CSV = DATA_DIR / "weather_daily.csv"
LABELS_CSV = DATA_DIR / "labels.csv"          # user-provided (the bottleneck)
FEATURES_CSV = DATA_DIR / "features.csv"
METRICS_JSON = MODELS_DIR / "metrics.json"
MODEL_PATH = MODELS_DIR / "malaria_v1.joblib"

# --- Modeling parameters -----------------------------------------------------
# Active disease for a given pipeline run. The DISEASES registry below documents
# the climate-sensitive targets and their best open label source (see
# data/SOURCES.md). Malaria's weekly labels are the hardest to get openly, so the
# first *trainable* model is expected to be Lassa fever or cholera.
DISEASE = "malaria"
MODEL_VERSION = f"{DISEASE}_v1"

# disease key -> metadata. `season` is a plain-language note for the report layer;
# `source` points at the recommended open label source in data/SOURCES.md.
DISEASES: dict[str, dict[str, str]] = {
    "malaria": {
        "season": "Transmission peaks in/after the rainy season (rain leads cases ~2-6 weeks).",
        "source": "MAP annual (open) / NHMIS-DHIS2 monthly (gated)",
        "fit": "data-limited: no open weekly labels yet",
    },
    "lassa": {
        "season": "Peaks in the dry season (Nov-Mar), tied to rodent dynamics.",
        "source": "NCDC weekly Lassa situation reports (open, state-level)",
        "fit": "best open weekly series -> first trainable model",
    },
    "cholera": {
        "season": "Rainfall/flood-driven; rainy-season and post-flood surges.",
        "source": "NCDC cholera sitreps + Charnley dataset (open)",
        "fit": "good, outbreak-year heavy",
    },
    "meningitis": {
        "season": "Dry-season/harmattan belt (CSM), Dec-May in the north.",
        "source": "NCDC weekly CSM situation reports (open)",
        "fit": "good, seasonal northern belt",
    },
}

# Forecast horizon: how far ahead we project (mosquito breeding + transmission
# lag means rainfall today informs risk ~2-4 weeks out).
FORECAST_HORIZON_DAYS = 28

# Aggregation period for features + labels.
PERIOD = "W"  # weekly (ISO weeks). Use "M" if labels are monthly.

# Climate lag windows (in periods). With weekly periods these are 2/4/6/8 weeks.
LAG_PERIODS = [2, 4, 6, 8]
ROLLING_WINDOWS = [4, 8]  # rolling-mean windows (periods)

# How many years of weather history to pull.
WEATHER_START = "20180101"  # YYYYMMDD (NASA POWER format)

# --- Supabase (only predict_and_write.py needs these) ------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# --- Nigerian states: name -> (lat, lon) centroid ----------------------------
# Approximate geographic/administrative centroids. Names match the app's
# normalized NIGERIA_STATES list (FCT for the Federal Capital Territory).
STATE_CENTROIDS: dict[str, tuple[float, float]] = {
    "Abia": (5.45, 7.52),
    "Adamawa": (9.33, 12.40),
    "Akwa Ibom": (5.00, 7.85),
    "Anambra": (6.22, 6.94),
    "Bauchi": (10.31, 9.84),
    "Bayelsa": (4.77, 6.07),
    "Benue": (7.33, 8.74),
    "Borno": (11.88, 13.16),
    "Cross River": (5.87, 8.60),
    "Delta": (5.53, 5.90),
    "Ebonyi": (6.26, 8.01),
    "Edo": (6.50, 5.95),
    "Ekiti": (7.72, 5.31),
    "Enugu": (6.45, 7.50),
    "FCT": (9.07, 7.48),
    "Gombe": (10.29, 11.17),
    "Imo": (5.57, 7.05),
    "Jigawa": (12.23, 9.56),
    "Kaduna": (10.52, 7.44),
    "Kano": (12.00, 8.52),
    "Katsina": (12.99, 7.60),
    "Kebbi": (11.49, 4.20),
    "Kogi": (7.73, 6.69),
    "Kwara": (8.97, 4.39),
    "Lagos": (6.52, 3.38),
    "Nasarawa": (8.50, 8.20),
    "Niger": (9.93, 5.60),
    "Ogun": (6.82, 3.65),
    "Ondo": (7.10, 4.84),
    "Osun": (7.56, 4.52),
    "Oyo": (7.85, 3.93),
    "Plateau": (9.22, 9.52),
    "Rivers": (4.81, 6.98),
    "Sokoto": (13.06, 5.24),
    "Taraba": (7.87, 9.78),
    "Yobe": (12.00, 11.50),
    "Zamfara": (12.17, 6.66),
}

STATES = list(STATE_CENTROIDS.keys())

# Common variants seen in source data -> canonical state name. Extend as needed.
STATE_ALIASES: dict[str, str] = {
    "abuja": "FCT",
    "fct abuja": "FCT",
    "federal capital territory": "FCT",
    "akwa": "Akwa Ibom",
    "akwa-ibom": "Akwa Ibom",
    "cross-river": "Cross River",
    "nassarawa": "Nasarawa",
}


def normalize_state(raw: str | None) -> str | None:
    """Map a messy source state string to a canonical config.STATES name, or None."""
    if not raw:
        return None
    key = " ".join(str(raw).strip().split()).strip()
    low = key.lower()
    if low in STATE_ALIASES:
        return STATE_ALIASES[low]
    for state in STATES:
        if state.lower() == low:
            return state
    # title-case fallback (e.g. "LAGOS" -> "Lagos")
    titled = key.title()
    return titled if titled in STATES else None
