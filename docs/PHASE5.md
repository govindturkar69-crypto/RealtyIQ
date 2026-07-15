# Phase 5 — Deployment & Repository

## Delivered
- **`DEPLOYMENT.md`** — full guide to deploy on MongoDB Atlas + Render (ML + API) + Vercel (frontend), free tier, bottom-up order.
- **`render.yaml`** — Render blueprint that provisions both backend services with env vars (secrets auto-generated, DB/URLs set in dashboard).
- **`ml-service/Dockerfile.txt`** — now binds to Render's `$PORT` (shell-form CMD).
- **`LICENSE`** (MIT) and a comprehensive root **`.gitignore`** (keeps `.env`, `node_modules`, build output, and model artifacts out of git).

## Production behaviour (already built in)
- Backend fails fast if secrets are missing and `NODE_ENV=production`.
- Generic error messages + correlation IDs in production.
- CORS restricted to the configured frontend origin.
- Frontend reads the API URL from `NEXT_PUBLIC_API_URL`.

## Deploy order
Atlas (DB) → Render `realtyiq-ml` → Render `realtyiq-api` (seed once) → Vercel frontend →
set `CORS_ORIGIN` on the API to the Vercel URL.
