# RealtyIQ — Backend API (Express) · Phase 2

Node/Express API for auth, listings, predictions, comparison, saved searches and
price trends. Proxies the FastAPI ML service (Phase 1) for valuations and logs
prediction history per user in MongoDB.

## Stack
Express 4 · MongoDB/Mongoose 8 · JWT (access + refresh) · bcryptjs · Zod validation
· helmet · CORS · morgan logging · express-rate-limit.

## Layout
```
backend-api/src/
├── config/      env.js, db.js
├── models/      User, Listing, Prediction, SavedSearch
├── middleware/  auth (JWT + roles), validate (Zod), errorHandler, notFound
├── lib/         queryBuilder, deal, trends   (pure, unit-tested)
├── services/    ml.service.js  (proxy to FastAPI /predict, /feature-importance)
├── controllers/ auth, listing, predict, compare, savedSearch, trends
├── routes/      one router per resource + index
├── seed/        seed.js (from ml-service/data/bengaluru_clean.csv) + geo.js
├── test/        node:test unit tests for lib/*
└── app.js, server.js
```

## Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/signup` · `/login` · `/refresh` | – | JWT access+refresh |
| GET/POST | `/api/auth/me` · `/logout` | Bearer | session |
| GET | `/api/listings` | – | filter, sort, paginate |
| GET | `/api/listings/:id` | – | detail |
| POST/PATCH/DELETE | `/api/listings` | admin | CRUD |
| POST | `/api/predict` | optional | proxy ML + log history |
| GET | `/api/predict/feature-importance` | – | model explainability |
| GET | `/api/predict/history` | Bearer | user's predictions |
| POST | `/api/compare` | – | 2–3 listings: listed vs predicted + deal verdict |
| GET/POST/DELETE | `/api/saved-searches` | Bearer | filters + match counts |
| GET | `/api/trends` · `/trends/ranking` | – | price trends, locality ranking |
| GET | `/api/trends/admin/stats` | admin | admin dashboard stats |

## Run locally
```bash
cp .env.example .env         # set MONGODB_URI, JWT secrets, ML_SERVICE_URL
npm install
npm run seed                 # loads ~600 listings + admin/demo users from cleaned CSV
npm start                    # http://localhost:8000
npm test                     # runs lib unit tests (no DB needed)
```
Or `docker compose up` from the repo root (Mongo + ML + API).

Seed logins: `admin@realtyiq.dev / Admin@12345`, `demo@realtyiq.dev / Demo@12345`.

## Notes on realness
- **Trends over time:** the Bengaluru dataset has no timestamps, so the seed assigns
  each listing a `listedDate` spread across the last 24 months. The `/api/trends`
  aggregation is a **real MongoDB pipeline** over that seeded data — the time axis is
  synthetic-by-seed and documented, not fabricated at request time.
- **Deal verdict, filters, pagination, trend pipelines** are pure functions in `lib/`,
  covered by `npm test` (15 passing assertions).
- **Map coordinates** are approximate per-locality (see `seed/geo.js`), clearly illustrative.

> Note: the build file is `Dockerfile.txt` (renamed so Windows does not block it from the zip).
> `docker compose` references it directly; for a manual build use `docker build -f Dockerfile.txt .`
