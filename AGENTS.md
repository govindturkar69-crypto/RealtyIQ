# RealtyIQ Repository Guide

## Scope

RealtyIQ is a three-service real-estate valuation application:

- `frontend/`: Next.js 14 App Router client.
- `backend-api/`: Express/Mongoose system of record and API gateway.
- `ml-service/`: FastAPI inference service and offline training pipeline.
- `docs/`: canonical product and engineering documentation. `PHASE*.md` files are historical delivery notes, not current specifications.

Read the relevant canonical document before changing behavior: [PRD](docs/PRD.md), [TRD](docs/TRD.md), [architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [API](docs/API.md), [UI/UX](docs/UI-UX.md), and [testing](docs/TESTING.md).

## Working rules

- Preserve the service boundary: browser → Express API → MongoDB/FastAPI. The browser must not access MongoDB or the ML service directly.
- Enforce authorization in Express. Frontend route guards are navigation aids, not security controls.
- Reuse existing validators, middleware, API client methods, UI primitives, and model helpers before adding abstractions or dependencies.
- Keep API errors compatible with `{ error, details?, requestId }`; ML errors use FastAPI's `{ detail }` shape.
- Validate every external input with the existing Zod/Pydantic patterns.
- Never commit `.env` files, credentials, generated build output, `node_modules`, virtual environments, or newly trained binary model artifacts unless explicitly intended.
- Do not silently change model metrics, confidence semantics, role permissions, seed credentials, or saved-search alert semantics; these are user-visible contracts.
- Treat `ml-service/models/metadata.json` and `ml-service/reports/bengaluru_metrics.json` as checked-in evidence. They currently describe the numpy sandbox reference, while a real training run overwrites metadata with the selected sklearn/XGBoost model.

## Local commands

Run commands from the service directory.

```bash
# ML service
pip install -r requirements.txt
python src/train.py --dataset bengaluru
python -m uvicorn app.main:app --app-dir app --port 8001

# API (MongoDB and ML service required for full behavior)
npm install
npm run seed
npm test
npm start

# Frontend
npm install
npm run lint
npm run build
npm run dev
```

`npm run seed` is destructive for the `users` and `listings` collections. Do not run it against a database containing data that must be retained.

## Change verification

- Backend logic: `npm test`; add or update a focused `node:test` case.
- ML pipeline/API: `python -m unittest discover -s verify -p "test_*.py"`; retraining is a separate, potentially expensive verification step.
- Frontend: `npm run lint` and `npm run build`; manually exercise affected responsive and authenticated states.
- Cross-service changes: verify the request/response schema in all callers and update `docs/API.md`, `docs/DATABASE.md`, or both when the contract changes.
- Before handoff, inspect `git diff --check` and `git status --short`. Do not overwrite unrelated user changes.

## Known constraints

- The production UI and seed data are Bengaluru-focused even though some copy says “Indian cities.”
- Map coordinates are approximate deterministic locality coordinates, not geocoded addresses.
- Saved-search notifications are polled match-count deltas, not push/email/SMS delivery.
- ROI and EMI tools are client-side scenarios, not lending or investment advice.
- There are no MongoDB migrations, transactions, OpenAPI documentation for Express, frontend automated tests, end-to-end tests, CI workflow, backup/restore feature, blog/CMS, subscription billing, or real-time chat.
