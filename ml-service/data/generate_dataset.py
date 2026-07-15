import argparse
import os
import numpy as np
import pandas as pd

RNG_SEED = 42
CITY_LOCALITIES = {
    "Nagpur": {"Dharampeth": 7200, "Ramdaspeth": 8100, "Civil Lines": 9500,
               "Manish Nagar": 5200, "Wardha Road": 5600, "Besa": 4300,
               "Hingna": 3600, "Kalmna": 3100},
    "Pune": {"Koregaon Park": 14500, "Kalyani Nagar": 13200, "Baner": 11200,
             "Hinjewadi": 8600, "Wakad": 9100, "Kothrud": 10800,
             "Hadapsar": 7400, "Wagholi": 5800},
    "Mumbai": {"Bandra West": 42000, "Andheri West": 29000, "Powai": 26500,
               "Chembur": 22000, "Goregaon": 19500, "Malad": 17000,
               "Mira Road": 11500, "Panvel": 9500}}
PROPERTY_TYPES = ["Apartment", "Villa", "Plot"]
FURNISHING = ["Unfurnished", "Semi-Furnished", "Furnished"]
FURNISHING_MULT = {"Unfurnished": 1.0, "Semi-Furnished": 1.06, "Furnished": 1.13}
TYPE_MULT = {"Apartment": 1.0, "Villa": 1.28, "Plot": 0.72}

def generate(n_rows, seed=RNG_SEED):
    rng = np.random.default_rng(seed)
    cities = rng.choice(list(CITY_LOCALITIES), size=n_rows, p=[0.34, 0.36, 0.30])
    rows = []
    for city in cities:
        locality = rng.choice(list(CITY_LOCALITIES[city]))
        base = CITY_LOCALITIES[city][locality]
        ptype = rng.choice(PROPERTY_TYPES, p=[0.72, 0.13, 0.15])
        if ptype == "Plot":
            bhk = bathrooms = floor_no = total_floors = age = 0
            furnishing = "Unfurnished"
            parking = int(rng.integers(0, 2))
            gym = pool = security = 0
            area = float(np.clip(rng.normal(2400, 900), 800, 6000))
        else:
            bhk = int(rng.choice([1, 2, 3, 4, 5], p=[0.14, 0.40, 0.30, 0.12, 0.04]))
            bathrooms = int(np.clip(bhk - rng.integers(0, 2), 1, 6))
            total_floors = int(np.clip(rng.normal(14 if city == "Mumbai" else 8, 5), 1, 45))
            floor_no = int(np.clip(rng.integers(0, total_floors + 1), 0, total_floors))
            age = int(np.clip(rng.exponential(7), 0, 45))
            furnishing = rng.choice(FURNISHING, p=[0.42, 0.38, 0.20])
            parking = int(rng.choice([0, 1, 2], p=[0.25, 0.55, 0.20]))
            gym = int(rng.random() < (0.55 if city == "Mumbai" else 0.32))
            pool = int(rng.random() < (0.30 if ptype == "Villa" else 0.15))
            security = int(rng.random() < 0.68)
            area = float(np.clip(bhk * rng.normal(560, 90) + rng.normal(0, 120), 320, 6500))
        schools = float(np.clip(rng.normal(6.5, 1.8), 1, 10))
        hospitals = float(np.clip(rng.normal(6.2, 1.9), 1, 10))
        psf = base * TYPE_MULT[ptype] * FURNISHING_MULT[furnishing]
        psf *= 1.0 - min(age, 40) * 0.006
        if total_floors > 0:
            psf *= 1.0 + 0.05 * (floor_no / total_floors) - 0.03 * (floor_no == 0)
        psf *= 1.0 + 0.018 * (schools - 6.5) + 0.015 * (hospitals - 6.2)
        psf *= 1.0 + 0.03 * gym + 0.045 * pool + 0.02 * security + 0.015 * parking
        psf *= float(np.exp(rng.normal(0, 0.09)))
        rows.append({"city": city, "locality": locality, "property_type": ptype,
                     "area_sqft": round(area, 1), "bhk": bhk, "bathrooms": bathrooms,
                     "floor_no": floor_no, "total_floors": total_floors, "age_years": age,
                     "furnishing": furnishing, "parking": parking, "gym": gym, "pool": pool,
                     "security": security, "schools_score": round(schools, 2),
                     "hospitals_score": round(hospitals, 2), "price": int(round(psf * area, -3))})
    df = pd.DataFrame(rows)
    dup = rng.choice(df.index, size=int(n_rows * 0.01), replace=False)
    df = pd.concat([df, df.loc[dup]], ignore_index=True)
    nulls = rng.choice(df.index, size=int(len(df) * 0.015), replace=False)
    df.loc[nulls, "furnishing"] = np.nan
    return df.sample(frac=1.0, random_state=seed).reset_index(drop=True)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=6000)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "housing_raw.csv"))
    a = ap.parse_args()
    df = generate(a.rows)
    df.to_csv(a.out, index=False)
    print(f"Wrote {len(df)} rows to {a.out}")
