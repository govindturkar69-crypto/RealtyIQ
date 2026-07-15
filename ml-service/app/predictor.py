import os
import sys
import json
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import config as C  # noqa: E402
import features as F  # noqa: E402


class Predictor:
    def __init__(self):
        self.model = None
        self.meta = {}
        self.load()

    def load(self):
        if os.path.exists(C.MODEL_PATH):
            self.model = joblib.load(C.MODEL_PATH)
        if os.path.exists(C.METADATA_PATH):
            with open(C.METADATA_PATH) as f:
                self.meta = json.load(f)

    @property
    def ready(self):
        return self.model is not None

    def predict(self, payload: dict) -> dict:
        if not self.ready:
            raise RuntimeError("Model not loaded. Run `python src/train.py` first.")
        X = F.add_engineered_features(pd.DataFrame([payload]))[F.FEATURE_COLUMNS]
        point = max(float(self.model.predict(X)[0]), 1.0)
        sigma = float(self.meta.get("sigma_log", 0.15))
        z = float(self.meta.get("confidence_z", C.CONFIDENCE_Z))
        log_p = np.log1p(point)
        area = max(float(payload.get(F.PROFILE.area_col, 1)), 1)
        return {"predicted_price": int(round(point, -3)),
                "confidence_low": int(round(np.expm1(log_p - z * sigma), -3)),
                "confidence_high": int(round(np.expm1(log_p + z * sigma), -3)),
                "confidence_interval_pct": 95,
                "price_per_sqft": int(round(point / area)),
                "currency": "INR",
                "model_name": self.meta.get("model_name", "unknown")}

    def feature_importance(self, top: int = 15):
        items = list(self.meta.get("feature_importance", {}).items())[:top]
        return [{"feature": k, "importance": v} for k, v in items]

    def enums(self):
        return self.meta.get("enums", {})

    def info(self):
        return {k: self.meta.get(k) for k in
                ("model_name", "dataset", "trained_at", "metrics", "cv_r2",
                 "n_train", "n_test")}
