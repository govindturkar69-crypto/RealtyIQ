# RealtyIQ — Real Estate Price Prediction (SaaS)

Production-style real-estate valuation platform with an ML core.

> **Build status:** Phases 1–5 complete — ML service, Express backend, Next.js frontend
> (core + advanced features: trends, compare, map, deal indicator, saved searches, PDF,
> admin) on the Kaggle Bengaluru dataset. Phase 5 (deploy polish) remains. See `TESTING.md`
> to run it all; `docker compose up` for the backend stack.

## Monorepo layout
```
real-estate-price-prediction/
├── ml-service/     # FastAPI + model training (Phase 1 — done)
├── backend-api/    # Express: auth, listings, predict proxy, compare, trends (Phase 2 — done)
├── frontend/       # Next.js 14 app — landing, predict, results, listings, auth (Phase 3 — done)
└── docs/
```

## Architecture (text diagram)
```
Next.js (Vercel) ──HTTP──> Express API (Render) ──HTTP──> FastAPI ML service (Render)
      │                          │                                │
   React Query               MongoDB Atlas                   model.joblib
   shadcn/ui            (users, listings,                (RF / GBR / XGBoost,
   Recharts / Leaflet    predictions, saved searches)      best via GridSearchCV)
```

See `ml-service/README.md` to run Phase 1 and `docs/PHASE1.md` for details.

> **Docker note:** build files are named `Dockerfile.txt` (Windows blocks extensionless
> files extracted from zips). `docker-compose.yml` already points to them. If you build a
> service directly, run `docker build -f Dockerfile.txt .`


## Security
See `SECURITY.md` for the audit and hardening. Before deploying, set strong unique `JWT_*` secrets + a TLS Mongo URI and rotate any previously committed secret.

## Deploy
See `DEPLOYMENT.md` for live deployment (MongoDB Atlas + Render + Vercel, all free tier).
