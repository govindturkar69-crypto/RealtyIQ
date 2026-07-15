# Phase 2 — Express Backend API

## Delivered
- **Auth:** signup / login / refresh / logout / me. bcryptjs hashing, JWT access
  (15m) + refresh (7d) with server-side refresh-token tracking and rotation.
- **Listings:** public filter/sort/paginate + detail; admin-only create/update/delete.
- **Predict:** proxies FastAPI `/predict`, returns confidence range, logs every
  prediction to MongoDB per user; `/feature-importance`; `/history`.
- **Compare:** 2–3 listings, fetches ML prediction for each, returns listed vs
  predicted + "good deal" verdict (under/over/fair).
- **Saved searches:** CRUD, live match counts + new-match delta (in-app alert basis).
- **Trends:** real MongoDB aggregation — price & price/sqft by month, locality ranking,
  admin stats (totals, most-searched localities, avg predicted price).
- **Cross-cutting:** Zod validation middleware, centralized error handler, helmet,
  CORS, morgan request logging, express-rate-limit.
- **Seed:** ~600 realistic listings from `ml-service/data/bengaluru_clean.csv` with
  per-locality geo, 24-month listedDate spread, admin + demo users.

## Verification in this environment
- npm registry blocked → dependencies not installable here, so the server/DB were not
  run live. **Every file passes `node --check`.**
- Core business logic (query building, pagination, deal verdict, trend/ranking
  pipelines, geo) is dependency-free and covered by **`node --test` (15 passing)**.
- To run fully: `docker compose up` (Mongo + ML + API) or `npm install && npm run seed && npm start`.

## Disclosed
- Trend time-axis is seeded across 24 months (dataset has no timestamps); aggregation
  itself is real. In-app "email-style" alerts are match-count deltas (no SMTP wired).
