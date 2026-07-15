"""Dependency-free pipeline tests (numpy/pandas only). Run: python verify/test_pipeline.py"""
import os, sys, math
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
os.environ["DATASET"] = "bengaluru"
import datasets as D
import features as F

passed = failed = 0
def check(name, cond):
    global passed, failed
    if cond: passed += 1; print(f"  PASS  {name}")
    else: failed += 1; print(f"  FAIL  {name}")

print("== total_sqft parser ==")
p = D._parse_sqft
check("plain '1200' -> 1200", p("1200") == 1200)
check("range '1133 - 1384' -> midpoint", abs(p("1133 - 1384") - 1258.5) < 0.1)
check("'34.46Sq. Meter' -> ~371 sqft", abs(p("34.46Sq. Meter") - 34.46*10.7639) < 1)
check("'1Grounds' -> 2400 sqft", p("1Grounds") == 2400)
check("garbage -> NaN", math.isnan(p("abc")))
check("empty -> NaN", math.isnan(p(np.nan)))

print("== clean() invariants ==")
raw = F.load_raw()
clean = F.clean(raw)
req = ["total_sqft", "bhk", "bath", "price"]
check("no NaN in required cols", clean[req].isna().sum().sum() == 0)
check("all price > 0", (clean["price"] > 0).all())
check("bath <= bhk + 2", (clean["bath"] <= clean["bhk"] + 2).all())
check("sqft per bhk >= 300", (clean["total_sqft"] / clean["bhk"] >= 300).all())
check("location rare-grouped (<= ~250)", clean["location"].nunique() <= 260)
check("price is INR (median > 1e6)", clean["price"].median() > 1_000_000)

print("== feature engineering ==")
eng = F.add_engineered_features(clean)
check("sqft_per_bhk present & finite", np.isfinite(eng["sqft_per_bhk"]).all())
check("bath_per_bhk present & finite", np.isfinite(eng["bath_per_bhk"]).all())

print("== build_dataset contract ==")
X, y = F.build_dataset()
check("X has exactly FEATURE_COLUMNS", list(X.columns) == F.FEATURE_COLUMNS)
check("no NaN in X numeric", X[F.NUMERIC_FEATURES].isna().sum().sum() == 0)
check("y all positive", (y > 0).all())
check("rows X == rows y", len(X) == len(y))
check("outlier removal shrank rows", len(X) < len(raw))

print(f"\nRESULT: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
