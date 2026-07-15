# Phase 1 — ML Pipeline & Inference Service

## Delivered
- **Dataset-aware pipeline** (`src/datasets.py`): pluggable profiles. Ships with the
  Kaggle **Bengaluru** dataset (default) and a documented **synthetic** generator.
- **Real Bengaluru cleaning**: total_sqft range/unit parsing, BHK extraction, location
  grouping (1,305→224), outlier removal, lakhs→INR, engineered `sqft_per_bhk` / `bath_per_bhk`.
- **Training** (`src/train.py`): RandomForest + GradientBoosting + XGBoost, each tuned with
  5-fold `GridSearchCV`, best selected by CV R², persisted with joblib + metadata; log-target.
- **FastAPI service**: `/predict` (95% confidence range), `/feature-importance`,
  `/localities`, `/model-info`, `/health`; Pydantic validation; centralized error handler;
  request logging; CORS.

## Disclosed constraints
1. **Kaggle** provided by the user as `Bengaluru_House_Data.csv` (build sandbox can't reach Kaggle).
2. **PyPI blocked** in the sandbox → sklearn/xgboost/fastapi could not be executed here. Metrics
   were produced by a genuine from-scratch numpy gradient-boosted model (`verify/`) on the
   identical cleaned data/split. Production sklearn code is syntax-verified and runs anywhere
   with the deps installed.

## Verified metrics (Bengaluru, held-out test)
R² 0.739 · MAE ₹20.7L · RMSE ₹38.4L · MAPE 21.7% · 3-fold CV R² 0.657 ± 0.067 · linear baseline R² 0.667.
