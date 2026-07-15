"""Production training pipeline (dataset-aware): cleaning -> outlier removal ->
feature engineering -> split -> model training (RandomForest, GradientBoosting,
XGBoost) -> GridSearchCV tuning -> CV-based selection -> evaluation (R2/MAE/RMSE)
-> joblib persistence + metadata + markdown report.

Usage: python src/train.py --dataset bengaluru   (or synthetic)"""
import os
import sys
import json
import argparse
import warnings
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")


def _log(y):
    return np.log1p(y)


def _exp(y):
    return np.expm1(y)


def build_preprocessor(F):
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    return ColumnTransformer([
        ("num", StandardScaler(), F.NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore"), F.CATEGORICAL_FEATURES),
    ], remainder="drop")


def make_pipeline(F, estimator):
    from sklearn.pipeline import Pipeline
    from sklearn.compose import TransformedTargetRegressor
    reg = TransformedTargetRegressor(regressor=estimator, func=np.log1p, inverse_func=np.expm1)
    return Pipeline([("prep", build_preprocessor(F)), ("model", reg)])


def candidate_models(C):
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    models = {
        "RandomForest": (
            RandomForestRegressor(random_state=C.RANDOM_STATE, n_jobs=-1),
            {"model__regressor__n_estimators": [200, 400],
             "model__regressor__max_depth": [None, 20],
             "model__regressor__min_samples_leaf": [1, 3]}),
        "GradientBoosting": (
            GradientBoostingRegressor(random_state=C.RANDOM_STATE),
            {"model__regressor__n_estimators": [300, 500],
             "model__regressor__max_depth": [2, 3],
             "model__regressor__learning_rate": [0.05, 0.1]}),
    }
    try:
        from xgboost import XGBRegressor
        models["XGBoost"] = (
            XGBRegressor(random_state=C.RANDOM_STATE, n_jobs=-1,
                         objective="reg:squarederror", tree_method="hist"),
            {"model__regressor__n_estimators": [400, 700],
             "model__regressor__max_depth": [4, 6],
             "model__regressor__learning_rate": [0.03, 0.08],
             "model__regressor__subsample": [0.8, 1.0]})
    except Exception:
        print("[warn] xgboost not installed; training RF + GBR only.")
    return models


def evaluate(y_true, y_pred):
    from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
    return {"r2": float(r2_score(y_true, y_pred)),
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
            "mape": float(np.mean(np.abs((y_true - y_pred) / np.clip(y_true, 1, None))) * 100)}


def feature_importance(pipeline):
    prep = pipeline.named_steps["prep"]
    est = pipeline.named_steps["model"].regressor_
    if not hasattr(est, "feature_importances_"):
        return {}
    names = prep.get_feature_names_out()
    pairs = sorted(zip(names, est.feature_importances_), key=lambda kv: kv[1], reverse=True)
    return {n.split("__", 1)[-1]: float(v) for n, v in pairs[:20]}


def enums_from_clean(F, clean_df):
    cat = {c: sorted(clean_df[c].dropna().astype(str).unique().tolist())
           for c in F.PROFILE.categorical}
    num = {c: {"min": float(clean_df[c].min()), "max": float(clean_df[c].max()),
               "median": float(clean_df[c].median())} for c in F.PROFILE.numeric}
    return {"categorical": cat, "numeric_ranges": num}


def write_report(C, F, md):
    lines = ["# Model Evaluation Report\n",
             f"**Dataset:** {md['dataset']}  ",
             f"**Selected model:** {md['model_name']}  ",
             f"**Train / Test rows:** {md['n_train']} / {md['n_test']}  ",
             f"**Cross-val R² (best):** {md['cv_r2']:.4f}\n",
             "## Leaderboard (held-out test set)\n",
             "| Model | CV R² | Test R² | MAE (₹) | RMSE (₹) | MAPE % |",
             "|-------|-------|---------|---------|----------|--------|"]
    for name, r in md["leaderboard"].items():
        t = r["test"]
        lines.append(f"| {name} | {r['cv_r2']:.4f} | {t['r2']:.4f} | {t['mae']:,.0f} "
                     f"| {t['rmse']:,.0f} | {t['mape']:.2f} |")
    lines += ["\n## Top feature importances\n", "| Feature | Importance |", "|---------|-----------|"]
    for k, v in list(md["feature_importance"].items())[:12]:
        lines.append(f"| {k} | {v:.4f} |")
    with open(os.path.join(C.REPORTS_DIR, "model_evaluation.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default=os.getenv("DATASET", "bengaluru"),
                    choices=["bengaluru", "synthetic"])
    args = ap.parse_args()
    os.environ["DATASET"] = args.dataset

    import config as C
    import features as F
    from sklearn.model_selection import train_test_split, GridSearchCV

    os.makedirs(C.MODELS_DIR, exist_ok=True)
    os.makedirs(C.REPORTS_DIR, exist_ok=True)

    clean_df = F.build_clean_frame()
    X, y = clean_df[F.FEATURE_COLUMNS], clean_df[F.TARGET].astype(float)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=C.TEST_SIZE,
                                          random_state=C.RANDOM_STATE)

    leaderboard, fitted = {}, {}
    for name, (est, grid) in candidate_models(C).items():
        search = GridSearchCV(make_pipeline(F, est), grid, scoring="r2",
                              cv=C.CV_FOLDS, n_jobs=-1)
        search.fit(Xtr, ytr)
        preds = search.predict(Xte)
        leaderboard[name] = {"cv_r2": float(search.best_score_),
                             "best_params": {k.split("__")[-1]: v
                                             for k, v in search.best_params_.items()},
                             "test": evaluate(yte.to_numpy(), preds)}
        fitted[name] = search.best_estimator_
        print(f"{name}: CV R2={search.best_score_:.4f}  "
              f"Test R2={leaderboard[name]['test']['r2']:.4f}")

    best_name = max(leaderboard, key=lambda n: leaderboard[n]["cv_r2"])
    best = fitted[best_name]
    resid_log = _log(yte.to_numpy()) - _log(np.clip(best.predict(Xte), 1, None))
    sigma_log = float(np.std(resid_log))

    joblib.dump(best, C.MODEL_PATH)
    meta = {"model_name": best_name, "dataset": args.dataset,
            "trained_at": pd.Timestamp.now(tz="UTC").isoformat(),
            "target_currency": "INR",
            "n_train": int(len(Xtr)), "n_test": int(len(Xte)),
            "feature_columns": F.FEATURE_COLUMNS,
            "raw_input_columns": F.PROFILE.numeric + F.PROFILE.categorical,
            "area_col": F.PROFILE.area_col,
            "metrics": leaderboard[best_name]["test"],
            "cv_r2": leaderboard[best_name]["cv_r2"], "leaderboard": leaderboard,
            "sigma_log": sigma_log, "confidence_z": C.CONFIDENCE_Z,
            "feature_importance": feature_importance(best),
            "enums": enums_from_clean(F, clean_df)}
    with open(C.METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"\nBest model: {best_name} -> {C.MODEL_PATH}")
    write_report(C, F, meta)


if __name__ == "__main__":
    main()
