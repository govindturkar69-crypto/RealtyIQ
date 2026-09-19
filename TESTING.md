# RealtyIQ — Local Testing Guide

How to run and verify the full stack (ML service, backend API, frontend) on your
machine, with expected output at each step. Two paths: **Docker (one command)** or
**manual (four terminals)**.

Ports: ML `8001` · Backend `8000` · Frontend `3000` · MongoDB `27017`.

---

## Prerequisites
- Node.js 18+ and npm
- Python 3.10+ and pip
- MongoDB — either a local install, MongoDB Atlas connection string, or Docker
- (Optional) Docker Desktop for the one-command path

---

## Path A — Docker (fastest)

From the project root:
```bash
docker compose up --build
```
This starts Mongo, trains the ML model inside the ml-service image, and launches the
backend. Then run the frontend separately:
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Open http://localhost:3000. Seed the database once (in another terminal):
```bash
docker compose exec -e NODE_ENV=development \
  -e REALTYIQ_DISPOSABLE_DB=true \
  -e REALTYIQ_DISPOSABLE_DB_CONFIRM=DISPOSABLE_REALTYIQ_DATABASE \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
  -e BOOTSTRAP_ADMIN_PASSWORD='<unique 16+ character password>' backend-api npm run seed
```

> Docker build files are named `Dockerfile.txt`; compose already references them.

---

## Path B — Manual (four terminals)

### Terminal 1 — ML service (FastAPI)
```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python src/train.py --dataset bengaluru
uvicorn app.main:app --app-dir app --port 8001
```
Expected during training (numbers will be close to these):
```
RandomForest: CV R2=0.7x  Test R2=0.7x
GradientBoosting: CV R2=0.7x  Test R2=0.7x
XGBoost: CV R2=0.7x  Test R2=0.7x
Best model: XGBoost -> .../models/model.joblib
```
Verify it's up:
```bash
curl http://localhost:8001/health
# {"status":"ok","model_loaded":true,"model_name":"XGBoost"}

curl -X POST http://localhost:8001/predict -H "Content-Type: application/json" -d '{
  "location":"Whitefield","area_type":"Super built-up Area",
  "availability_status":"Ready To Move","total_sqft":1200,"bhk":2,"bath":2,"balcony":1}'
# {"predicted_price":<int>,"confidence_low":<int>,"confidence_high":<int>,
#  "confidence_interval_pct":95,"price_per_sqft":<int>,"currency":"INR","model_name":"XGBoost"}
```

### Terminal 2 — MongoDB (skip if using Atlas)
```bash
# local install:
mongod --dbpath /your/data/dir
# or Docker:
docker run -d -p 27017:27017 --name realtyiq-mongo mongo:7
```

### Terminal 3 — Backend API (Express)
```bash
cd backend-api
cp .env.example .env
# edit .env: set MONGODB_URI, JWT secrets, ML_SERVICE_URL=http://localhost:8001
npm install
npm run seed        # disposable DB only; requires target markers + BOOTSTRAP_ADMIN_*
npm start
```
Expected:
```
... MongoDB connected: ...
... backend-api listening on :8000 (development)
```
Seed output:
```
Seeded listings and the operator-supplied admin (plus an optional demo account).
```
Verify:
```bash
curl http://localhost:8000/health
# {"status":"ok","service":"backend-api","ts":...}

curl "http://localhost:8000/api/listings?limit=2"
# {"items":[...2 listings...],"page":1,"limit":2,"total":600,"totalPages":300}

curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"your-user@example.com","password":"your-password"}'
# {"user":{...},"accessToken":"eyJ...","refreshToken":"eyJ..."}

curl "http://localhost:8000/api/trends/ranking"
# {"ranking":[{"locality":"...","avgPricePerSqft":<int>,"listings":<int>}, ...]}
```

### Terminal 4 — Frontend (Next.js)
```bash
cd frontend
cp .env.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```
Open http://localhost:3000 and click through:
- **/** landing → **/predict** (fill the 3-step form) → **/results** (price + confidence bar + feature chart)
- **/listings** (filter/sort/paginate) → click a card → **/listings/[id]** (specs + trend chart)
- **/signup** or **/login** (with a locally created account) → **/dashboard** (prediction history)

---

## Automated test suites (no services needed)

**ML pipeline** (numpy/pandas only):
```bash
cd ml-service
python verify/test_pipeline.py       # -> "RESULT: 19 passed, 0 failed"
python verify/numpy_reference.py     # prints real R2/MAE/RMSE, writes reports/bengaluru_metrics.json
```

**Backend logic**:
```bash
cd backend-api
npm test                             # -> "# tests 15 / # pass 15 / # fail 0"
```

**Frontend production build** (also type-checks):
```bash
cd frontend
npm install && npm run build         # should complete with no type errors
```

---

## Seed credentials
Credentials are never published. Supply `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD` at runtime; optional demo credentials use
`SEED_DEMO_EMAIL` and `SEED_DEMO_PASSWORD`.

---

## Troubleshooting
- **Windows blocks `.js`/`.py` files from a zip:** extract/copy via PowerShell then
  `Get-ChildItem <folder> -Recurse | Unblock-File`. Explorer drag-copy re-applies the mark.
- **Frontend can't reach API / CORS error:** ensure backend `.env` `CORS_ORIGIN=http://localhost:3000`
  and frontend `.env.local` `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- **`/predict` returns 502/504:** the ML service isn't running or `ML_SERVICE_URL` is wrong.
- **`model_loaded:false`:** run `python src/train.py --dataset bengaluru` first.
- **Empty listings / trends:** run `npm run seed` in backend-api.
- **Mongo connection timeout:** check `MONGODB_URI` and that MongoDB is running/reachable.
