import os
import sys
import argparse

ap = argparse.ArgumentParser()
ap.add_argument("--dataset", default=os.getenv("DATASET", "bengaluru"))
args = ap.parse_args()
os.environ["DATASET"] = args.dataset
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import features as F

df = F.build_clean_frame()
out = os.path.join(os.path.dirname(__file__), f"{F.PROFILE.name}_clean.csv")
df.to_csv(out, index=False)
print(f"{F.PROFILE.name}: wrote {len(df)} cleaned rows -> {out}")
