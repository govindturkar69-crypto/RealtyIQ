import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import features as F

SEED = 42

def train_test_split(X, y, test_size=0.2, seed=SEED):
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(X))
    cut = int(len(X) * (1 - test_size))
    return X[idx[:cut]], X[idx[cut:]], y[idx[:cut]], y[idx[cut:]]

def metrics(y_true, y_pred):
    err = y_true - y_pred
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    return {
        "r2": float(1 - ss_res / ss_tot),
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err ** 2))),
        "mape": float(np.mean(np.abs(err) / np.clip(np.abs(y_true), 1, None)) * 100),
    }

class _Tree:
    def __init__(self, max_depth, min_leaf, l2, colsample, rng):
        self.max_depth, self.min_leaf, self.l2 = max_depth, min_leaf, l2
        self.colsample, self.rng = colsample, rng
        self.feat, self.thr, self.left, self.right = [], [], [], []
        self.is_leaf, self.val = [], []

    def _new(self):
        self.feat.append(-1); self.thr.append(0.0)
        self.left.append(-1); self.right.append(-1)
        self.is_leaf.append(True); self.val.append(0.0)
        return len(self.feat) - 1

    def fit(self, Xb, g, nfeat):
        self.nfeat = nfeat
        self._build(Xb, g, np.arange(len(g)), 0)
        self.feat = np.array(self.feat); self.thr = np.array(self.thr, dtype=float)
        self.left = np.array(self.left); self.right = np.array(self.right)
        self.is_leaf = np.array(self.is_leaf); self.val = np.array(self.val)
        return self

    def _build(self, Xb, g, idx, depth):
        nid = self._new()
        gi = g[idx]
        n, total = len(idx), float(gi.sum())
        self.val[nid] = total / (n + self.l2)
        if depth >= self.max_depth or n < 2 * self.min_leaf:
            return nid
        base = total ** 2 / (n + self.l2)
        m = max(1, int(self.nfeat * self.colsample))
        cand = self.rng.choice(self.nfeat, size=m, replace=False)
        best = (1e-9, -1, -1)
        for f in cand:
            bins = Xb[idx, f]
            maxb = int(bins.max()) + 1
            if maxb < 2:
                continue
            sg = np.bincount(bins, weights=gi, minlength=maxb)
            cnt = np.bincount(bins, minlength=maxb)
            lg, ln = np.cumsum(sg), np.cumsum(cnt)
            rg, rn = total - lg, n - ln
            valid = (ln >= self.min_leaf) & (rn >= self.min_leaf)
            if not valid.any():
                continue
            gain = np.where(valid, lg ** 2 / (ln + self.l2) + rg ** 2 / (rn + self.l2) - base, -np.inf)
            t = int(np.argmax(gain))
            if gain[t] > best[0]:
                best = (float(gain[t]), int(f), t)
        _, f, t = best
        if f < 0:
            return nid
        mask = Xb[idx, f] <= t
        self.is_leaf[nid] = False
        self.feat[nid], self.thr[nid] = f, t
        self.left[nid] = self._build(Xb, g, idx[mask], depth + 1)
        self.right[nid] = self._build(Xb, g, idx[~mask], depth + 1)
        return nid

    def predict(self, Xb):
        n = len(Xb)
        node = np.zeros(n, dtype=np.int64)
        rows = np.arange(n)
        for _ in range(self.max_depth + 1):
            active = ~self.is_leaf[node]
            if not active.any():
                break
            f = self.feat[node]
            vals = Xb[rows, np.where(f >= 0, f, 0)]
            go_left = vals <= self.thr[node]
            nxt = np.where(go_left, self.left[node], self.right[node])
            node = np.where(active, nxt, node)
        return self.val[node]

class HistGBT:
    def __init__(self, n_estimators=250, max_depth=4, lr=0.06, max_bins=64,
                 min_leaf=25, l2=1.0, colsample=0.3, seed=SEED):
        self.n_estimators, self.max_depth, self.lr = n_estimators, max_depth, lr
        self.max_bins, self.min_leaf, self.l2 = max_bins, min_leaf, l2
        self.colsample, self.seed = colsample, seed

    def _bin(self, X, fit=False):
        if fit:
            self.edges = []
            for f in range(X.shape[1]):
                qs = np.quantile(X[:, f], np.linspace(0, 1, self.max_bins + 1)[1:-1])
                self.edges.append(np.unique(qs))
        Xb = np.zeros(X.shape, dtype=np.int64)
        for f in range(X.shape[1]):
            Xb[:, f] = np.digitize(X[:, f], self.edges[f])
        return Xb

    def fit(self, X, y):
        Xb = self._bin(X, fit=True)
        rng = np.random.default_rng(self.seed)
        self.base = float(y.mean())
        pred = np.full(len(y), self.base)
        self.trees = []
        for _ in range(self.n_estimators):
            tree = _Tree(self.max_depth, self.min_leaf, self.l2, self.colsample, rng)
            tree.fit(Xb, y - pred, X.shape[1])
            pred += self.lr * tree.predict(Xb)
            self.trees.append(tree)
        return self

    def predict(self, X):
        Xb = self._bin(X, fit=False)
        pred = np.full(len(X), self.base)
        for tree in self.trees:
            pred += self.lr * tree.predict(Xb)
        return pred

class LinearBaseline:
    def fit(self, X, y):
        self.w, *_ = np.linalg.lstsq(np.hstack([np.ones((len(X), 1)), X]), y, rcond=None)
        return self

    def predict(self, X):
        return np.hstack([np.ones((len(X), 1)), X]) @ self.w

def permutation_importance(model, X, y, cols, seed=SEED):
    rng = np.random.default_rng(seed)
    base = metrics(y, model.predict(X))["r2"]
    imp = {}
    for j, c in enumerate(cols):
        Xp = X.copy()
        Xp[:, j] = rng.permutation(Xp[:, j])
        imp[c] = base - metrics(y, model.predict(Xp))["r2"]
    return imp

def collapse_dummies(imp):
    out = {}
    for cat in F.CATEGORICAL_FEATURES:
        out[cat] = float(sum(v for k, v in imp.items() if k.startswith(cat + "_")))
    for k, v in imp.items():
        if not any(k.startswith(c + "_") for c in F.CATEGORICAL_FEATURES):
            out[k] = float(v)
    return dict(sorted(out.items(), key=lambda kv: kv[1], reverse=True))

SAMPLES = {
    "bengaluru": [
        {"location": "Whitefield", "area_type": "Super built-up Area",
         "availability_status": "Ready To Move", "total_sqft": 1200, "bhk": 2,
         "bath": 2, "balcony": 1},
        {"location": "Electronic City", "area_type": "Super built-up Area",
         "availability_status": "Ready To Move", "total_sqft": 1000, "bhk": 2,
         "bath": 2, "balcony": 1},
        {"location": "Indira Nagar", "area_type": "Built-up Area",
         "availability_status": "Ready To Move", "total_sqft": 1800, "bhk": 3,
         "bath": 3, "balcony": 2},
    ],
}

def _enums(clean_df):
    cat = {c: sorted(clean_df[c].dropna().astype(str).unique().tolist())
           for c in F.PROFILE.categorical}
    num = {c: {"min": float(clean_df[c].min()), "max": float(clean_df[c].max()),
               "median": float(clean_df[c].median())} for c in F.PROFILE.numeric}
    return {"categorical": cat, "numeric_ranges": num}

def run():
    Z = 1.96
    clean_df = F.build_clean_frame()
    X_df, y = clean_df[F.FEATURE_COLUMNS], clean_df[F.TARGET].astype(float)
    Xenc = F.encode_matrix(X_df)
    cols = list(Xenc.columns)
    X, yv = Xenc.to_numpy(), y.to_numpy()
    yl = np.log1p(yv)
    Xtr, Xte, ytr_l, yte_l = train_test_split(X, yl)
    _, _, _, yte = train_test_split(X, yv)

    gbt = HistGBT(n_estimators=220, max_depth=5, lr=0.05, colsample=0.4, min_leaf=15).fit(Xtr, ytr_l)
    test_pred = np.expm1(gbt.predict(Xte))
    res = {"HistGBT(numpy)": metrics(yte, test_pred)}
    res["LinearBaseline"] = metrics(yte, np.expm1(LinearBaseline().fit(Xtr, ytr_l).predict(Xte)))
    sigma_log = float(np.std(yte_l - gbt.predict(Xte)))

    rng = np.random.default_rng(SEED)
    folds = np.array_split(rng.permutation(len(X)), 3)
    cv = []
    for k in range(3):
        te = folds[k]
        tr = np.concatenate([folds[j] for j in range(3) if j != k])
        m = HistGBT(n_estimators=120, max_depth=5, lr=0.05, colsample=0.4, min_leaf=15).fit(X[tr], yl[tr])
        cv.append(metrics(yv[te], np.expm1(m.predict(X[te])))["r2"])
    res["HistGBT(numpy)"]["cv_r2_mean"] = float(np.mean(cv))
    res["HistGBT(numpy)"]["cv_r2_std"] = float(np.std(cv))

    imp = collapse_dummies(permutation_importance(gbt, Xte, np.log1p(yte), cols))

    samples_out = []
    for sp in SAMPLES.get(F.PROFILE.name, []):
        import pandas as pd
        row = F.add_engineered_features(pd.DataFrame([sp]))[F.FEATURE_COLUMNS]
        enc = F.encode_matrix(row).reindex(columns=cols, fill_value=0.0).to_numpy()
        point = float(np.expm1(gbt.predict(enc))[0])
        lp = np.log1p(point)
        samples_out.append({**sp, "predicted_price": int(round(point, -3)),
                            "confidence_low": int(round(np.expm1(lp - Z * sigma_log), -3)),
                            "confidence_high": int(round(np.expm1(lp + Z * sigma_log), -3)),
                            "price_per_sqft": int(point / sp["total_sqft"])})

    out = {"dataset": F.PROFILE.name, "n_train": int(len(Xtr)), "n_test": int(len(Xte)),
           "n_encoded_features": len(cols), "target_mean": float(yv.mean()),
           "metrics": res, "sigma_log": sigma_log,
           "feature_importance": {k: v for k, v in list(imp.items())[:12]},
           "sample_predictions": samples_out}
    rp = os.path.join(os.path.dirname(__file__), "..", "reports", f"{F.PROFILE.name}_metrics.json")
    with open(rp, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    meta = {"model_name": "HistGBT(numpy-sandbox-reference)", "dataset": F.PROFILE.name,
            "note": "Sandbox verification metadata. Running src/train.py overwrites this "
                    "with the sklearn/XGBoost production model.",
            "target_currency": "INR", "n_train": int(len(Xtr)), "n_test": int(len(Xte)),
            "feature_columns": F.FEATURE_COLUMNS, "metrics": res["HistGBT(numpy)"],
            "sigma_log": sigma_log, "confidence_z": Z,
            "feature_importance": {k: v for k, v in list(imp.items())[:15]},
            "enums": _enums(clean_df)}
    mp = os.path.join(os.path.dirname(__file__), "..", "models", "metadata.json")
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    return out

if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
