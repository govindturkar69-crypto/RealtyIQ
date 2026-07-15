import os
import re
from dataclasses import dataclass
from typing import Callable, List
import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

@dataclass
class DatasetProfile:
    name: str
    raw_filename: str
    target: str
    numeric: List[str]
    categorical: List[str]
    eng_numeric: List[str]
    eng_categorical: List[str]
    clean_fn: Callable[[pd.DataFrame], pd.DataFrame]
    outlier_fn: Callable[[pd.DataFrame], pd.DataFrame]
    engineer_fn: Callable[[pd.DataFrame], pd.DataFrame]
    area_col: str = "area_sqft"

    @property
    def raw_path(self):
        return os.path.join(DATA_DIR, self.raw_filename)

    @property
    def numeric_features(self):
        return self.numeric + self.eng_numeric

    @property
    def categorical_features(self):
        return self.categorical + self.eng_categorical

    @property
    def feature_columns(self):
        return self.numeric_features + self.categorical_features

_AGE_BUCKETS = [(-1, 2, "New"), (2, 7, "Recent"), (7, 15, "Established"), (15, 100, "Old")]
_SYN_RAW_NUM = ["area_sqft", "bhk", "bathrooms", "floor_no", "total_floors", "age_years",
                "parking", "gym", "pool", "security", "schools_score", "hospitals_score"]

def _syn_clean(df):
    df = df.copy().drop_duplicates()
    df["furnishing"] = df["furnishing"].fillna("Unfurnished")
    for c in _SYN_RAW_NUM:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=[c for c in _SYN_RAW_NUM if c != "parking"] + ["price"])
    df = df[(df["area_sqft"] > 100) & (df["price"] > 0)]
    df.loc[df["total_floors"] < df["floor_no"], "total_floors"] = df["floor_no"]
    return df.reset_index(drop=True)

def _syn_outliers(df, k=1.5):
    df = df.copy()
    df["_p"] = df["price"] / df["area_sqft"]
    keep = pd.Series(False, index=df.index)
    for _, g in df.groupby("city"):
        q1, q3 = g["_p"].quantile([0.25, 0.75])
        iqr = q3 - q1
        keep.loc[g.index] = g["_p"].between(q1 - k * iqr, q3 + k * iqr)
    return df[keep].drop(columns="_p").reset_index(drop=True)

def _syn_bucket(a):
    for lo, hi, lab in _AGE_BUCKETS:
        if lo < a <= hi:
            return lab
    return "Old"

def _syn_engineer(df):
    df = df.copy()
    tf = df["total_floors"].replace(0, np.nan)
    df["floor_ratio"] = (df["floor_no"] / tf).fillna(0.0)
    bhk = df["bhk"].replace(0, np.nan)
    df["bath_per_bhk"] = (df["bathrooms"] / bhk).fillna(0.0)
    df["area_per_bhk"] = (df["area_sqft"] / bhk).fillna(df["area_sqft"])
    df["rooms_total"] = df["bhk"] + df["bathrooms"]
    df["amenities_count"] = df["gym"] + df["pool"] + df["security"] + (df["parking"] > 0).astype(int)
    df["is_ground_floor"] = (df["floor_no"] == 0).astype(int)
    df["age_bucket"] = df["age_years"].apply(_syn_bucket)
    return df

SYNTHETIC = DatasetProfile(
    name="synthetic", raw_filename="housing_raw.csv", target="price",
    numeric=_SYN_RAW_NUM,
    categorical=["city", "locality", "property_type", "furnishing"],
    eng_numeric=["floor_ratio", "bath_per_bhk", "area_per_bhk", "rooms_total",
                 "amenities_count", "is_ground_floor"],
    eng_categorical=["age_bucket"],
    clean_fn=_syn_clean, outlier_fn=_syn_outliers, engineer_fn=_syn_engineer,
    area_col="area_sqft",
)

_SQFT_UNITS = {"sq. meter": 10.7639, "sq.meter": 10.7639, "sq. yards": 9.0,
               "sq.yards": 9.0, "perch": 272.25, "acres": 43560.0,
               "guntha": 1089.0, "cents": 435.6, "grounds": 2400.0}

def _parse_sqft(x):
    if pd.isna(x):
        return np.nan
    s = str(x).strip().lower()
    if "-" in s:
        parts = re.findall(r"[\d.]+", s)
        if len(parts) == 2:
            return (float(parts[0]) + float(parts[1])) / 2
    for unit, mult in _SQFT_UNITS.items():
        if unit in s:
            num = re.findall(r"[\d.]+", s)
            return float(num[0]) * mult if num else np.nan
    try:
        return float(s)
    except ValueError:
        return np.nan

def _beng_clean(df):
    df = df.copy()
    df["area_type"] = df["area_type"].str.replace(r"\s+", " ", regex=True).str.strip()
    df["availability_status"] = np.where(
        df["availability"].str.strip().eq("Ready To Move"),
        "Ready To Move", "Under Construction")
    df["bhk"] = df["size"].str.extract(r"(\d+)").astype("float")
    df["total_sqft"] = df["total_sqft"].apply(_parse_sqft)
    df["bath"] = pd.to_numeric(df["bath"], errors="coerce")
    df["balcony"] = pd.to_numeric(df["balcony"], errors="coerce").fillna(0)
    df["location"] = df["location"].fillna("other").str.strip()
    df["price"] = pd.to_numeric(df["price"], errors="coerce") * 1e5

    df = df.dropna(subset=["total_sqft", "bhk", "bath", "price"])
    df = df[(df["total_sqft"] > 0) & (df["bhk"] > 0) & (df["price"] > 0)]
    df = df[df["bath"] <= df["bhk"] + 2]
    df = df[(df["total_sqft"] / df["bhk"]) >= 300]

    counts = df["location"].value_counts()
    rare = counts[counts <= 10].index
    df["location"] = df["location"].where(~df["location"].isin(rare), "other")
    keep = ["location", "area_type", "availability_status", "total_sqft",
            "bhk", "bath", "balcony", "price"]
    return df[keep].reset_index(drop=True)

def _beng_outliers(df):
    df = df.copy()
    df["_ppsf"] = df["price"] / df["total_sqft"]
    keep = pd.Series(True, index=df.index)
    for _, g in df.groupby("location"):
        if len(g) < 8:
            continue
        m, s = g["_ppsf"].mean(), g["_ppsf"].std()
        if s and not np.isnan(s):
            keep.loc[g.index] = g["_ppsf"].between(m - s, m + s)
    lo, hi = df["_ppsf"].quantile([0.01, 0.99])
    keep &= df["_ppsf"].between(lo, hi)
    return df[keep].drop(columns="_ppsf").reset_index(drop=True)

def _beng_engineer(df):
    df = df.copy()
    df["sqft_per_bhk"] = df["total_sqft"] / df["bhk"]
    df["bath_per_bhk"] = df["bath"] / df["bhk"]
    return df

BENGALURU = DatasetProfile(
    name="bengaluru", raw_filename="Bengaluru_House_Data.csv", target="price",
    numeric=["total_sqft", "bhk", "bath", "balcony"],
    categorical=["location", "area_type", "availability_status"],
    eng_numeric=["sqft_per_bhk", "bath_per_bhk"],
    eng_categorical=[],
    clean_fn=_beng_clean, outlier_fn=_beng_outliers, engineer_fn=_beng_engineer,
    area_col="total_sqft",
)

REGISTRY = {p.name: p for p in (SYNTHETIC, BENGALURU)}

def get_profile(name):
    if name not in REGISTRY:
        raise KeyError(f"Unknown dataset '{name}'. Options: {list(REGISTRY)}")
    return REGISTRY[name]
