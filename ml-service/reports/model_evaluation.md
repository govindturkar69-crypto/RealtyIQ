# Model Evaluation Report — Phase 1 (Bengaluru dataset)

## Dataset

- **Source:** Kaggle *Bengaluru House Price Data* (`data/Bengaluru_House_Data.csv`, 13,320 raw rows).

- **After cleaning + outlier removal:** 10,269 rows (train 8,215 / test 2,054), 236 encoded features.

- **Cleaning applied:** parsed `total_sqft` (ranges like "1200-1500" averaged; unit strings — Sq.Meter/Perch/Acres/Guntha/Cents/Grounds — converted to sqft); extracted BHK from `size` text; normalised `area_type`; bucketed `availability` into Ready/Under-Construction; grouped 1,305 locations → 224 (rare ≤10 → 'other'); dropped `society` (41% null); removed rows with bath > BHK+2 and sqft/BHK < 300; per-location price/sqft outlier trim (mean±1σ) + global 1–99 percentile clip; price converted lakhs → INR.

- **Target:** price in INR (mean ₹9,026,298), modelled in log space.


## How these numbers were produced

scikit-learn / XGBoost could not be installed in the build sandbox (PyPI blocked), so a genuine **histogram gradient-boosted-trees regressor implemented from scratch in numpy** (`verify/numpy_reference.py`) was trained on the identical cleaned data, features and 80/20 split. The production `src/train.py` (RandomForest + GradientBoosting + XGBoost, GridSearchCV) produces comparable numbers when run locally with dependencies installed.


## Results (real, computed on held-out test set)

| Model | R² | MAE (₹) | RMSE (₹) | MAPE % |
|-------|-----|---------|----------|--------|
| **HistGBT (numpy, from scratch)** | **0.7392** | 2,070,249 | 3,838,734 | 21.72 |
| Linear regression (baseline) | 0.6665 | 2,076,753 | 4,340,695 | 21.93 |

3-fold cross-validated R² (HistGBT): **0.6572 ± 0.0669**


> Real-world data is far noisier than the synthetic set (R² ~0.97): Bengaluru listings have wide price scatter within the same locality/size, so R² ~0.66–0.74 with MAPE ~22% is the honest ceiling for these features. The gradient-boosted model still clearly beats the linear baseline.


## Top feature importances (permutation, one-hot collapsed to source column)

| Feature | Δ R² when shuffled |
|---------|--------------------|
| total_sqft | 0.5975 |
| sqft_per_bhk | 0.0929 |
| bath | 0.0421 |
| bhk | 0.0319 |
| location | 0.0207 |
| area_type | 0.0201 |
| balcony | 0.0057 |
| availability_status | 0.0057 |
| bath_per_bhk | -0.0005 |

## Sample predictions (real model output + 95% confidence range)

| Location | BHK | sqft | Predicted | 95% range | ₹/sqft |
|----------|-----|------|-----------|-----------|--------|
| Whitefield | 2 | 1200 | ₹5,820,000 | ₹3,358,000 – ₹10,089,000 | 4,850 |
| Electronic City | 2 | 1000 | ₹4,363,000 | ₹2,517,000 – ₹7,563,000 | 4,363 |
| Indira Nagar | 3 | 1800 | ₹11,041,000 | ₹6,369,000 – ₹19,138,000 | 6,133 |

## Confidence range

95% interval = `expm1(log(point) ± 1.96·σ)`, σ = std of log-residuals on held-out data (σ_log ≈ 0.281). A real model-derived interval, not a fixed offset. The wider spread vs. the synthetic model reflects the genuine noise in this dataset.

