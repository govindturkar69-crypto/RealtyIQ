# RealtyIQ — ML Inference Service (Phase 1)

FastAPI microservice that trains real-estate price models and serves predictions
with a 95% confidence range and feature importance. Dataset-aware: ships with the
Kaggle **Bengaluru** dataset (default) and a **synthetic** Indian-cities generator.

## Stack
scikit-learn (RandomForest, GradientBoosting) + XGBoost, compared via 5-fold
GridSearchCV; pandas/numpy preprocessing; joblib persistence; FastAPI + Pydantic.

## Layout
```
ml-service/
├── data/
│   ├── Bengaluru_House_Data.csv     # Kaggle raw dataset (default)
│   ├── generate_dataset.py          # synthetic Nagpur/Pune/Mumbai generator
│   ├── prepare_clean.py             # export cleaned CSV (for inspection / seeding)
│   └── *_clean.csv                  # cleaned outputs
├── src/
│   ├── config.py                    # paths, DATASET switch, constants
│   ├── datasets.py                  # dataset PROFILES (clean/outlier/engineer per schema)
│   ├── features.py                  # dataset-agnostic feature layer
│   └── train.py                     # RF/GBR/XGB + GridSearchCV + CV-select + joblib + report
├── app/
│   ├── schemas.py                   # Pydantic request/response
│   ├── predictor.py                 # loads model + metadata, builds confidence range
│   └── main.py                      # FastAPI endpoints
├── models/metadata.json             # enums, importances, metrics (model.joblib after training)
├── reports/                         # model_evaluation.md + *_metrics.json
└── verify/numpy_reference.py        # dependency-free numpy model that computed the metrics
```

## Run locally
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/train.py --dataset bengaluru      # trains RF/GBR/XGB, selects best, writes metrics
uvicorn app.main:app --app-dir app --port 8001
```
Switch datasets with `--dataset synthetic` (run `python data/generate_dataset.py` first).

## Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/health` | liveness + model-loaded flag |
| GET  | `/localities` | dropdown data: categorical options + numeric ranges |
| GET  | `/model-info` | selected model + test metrics |
| GET  | `/feature-importance?top=15` | why a price is predicted |
| POST | `/predict` | predicted price + 95% confidence range + ₹/sqft |

### Example
```bash
curl -X POST localhost:8001/predict -H "Content-Type: application/json" -d '{
  "location":"Whitefield","area_type":"Super built-up Area",
  "availability_status":"Ready To Move","total_sqft":1200,"bhk":2,"bath":2,"balcony":1 }'
```

## Metrics (real, held-out test — see reports/model_evaluation.md)
Bengaluru: **R² 0.739**, 3-fold CV R² 0.657 ±0.067, MAE ₹20.7L, RMSE ₹38.4L, MAPE 21.7%
(linear baseline R² 0.667). Metrics computed by the numpy verifier because the build
sandbox blocks PyPI; the sklearn/XGBoost pipeline reproduces them locally.

## Adding a new dataset
Add one `DatasetProfile` in `src/datasets.py` (raw filename, columns, clean/outlier/
engineer functions). The rest of the pipeline is dataset-agnostic.
