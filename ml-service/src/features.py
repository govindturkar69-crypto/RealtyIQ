import os
import pandas as pd

import config as C
from datasets import get_profile

PROFILE = get_profile(os.getenv("DATASET", C.DATASET))

TARGET = PROFILE.target
NUMERIC_FEATURES = PROFILE.numeric_features
CATEGORICAL_FEATURES = PROFILE.categorical_features
FEATURE_COLUMNS = PROFILE.feature_columns

def load_raw(path: str = None) -> pd.DataFrame:
    return pd.read_csv(path or PROFILE.raw_path)

def clean(df):
    return PROFILE.clean_fn(df)

def remove_outliers(df):
    return PROFILE.outlier_fn(df)

def add_engineered_features(df):
    return PROFILE.engineer_fn(df)

def build_clean_frame(path: str = None, drop_outliers: bool = True) -> pd.DataFrame:
    df = clean(load_raw(path))
    if drop_outliers:
        df = remove_outliers(df)
    return add_engineered_features(df)

def build_dataset(path: str = None, drop_outliers: bool = True):
    df = build_clean_frame(path, drop_outliers)
    return df[FEATURE_COLUMNS], df[TARGET].astype(float)

def encode_matrix(X: pd.DataFrame) -> pd.DataFrame:
    return pd.get_dummies(X, columns=CATEGORICAL_FEATURES, drop_first=False).astype(float)
