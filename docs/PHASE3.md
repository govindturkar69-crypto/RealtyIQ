# Phase 3 — Next.js Frontend (core pages)

## Delivered
- **Landing** — hero, how-it-works (3 steps), trust stats, CTAs, responsive + dark mode.
- **Predict** — 3-step React Hook Form + Zod flow with per-step live validation; locality/
  area-type/availability dropdowns loaded from the ML `/options` endpoint.
- **Results** — predicted price, 95% confidence-range bar (from real model output),
  feature-importance bar chart (Recharts), and similar listings in the locality.
- **Listings** — filter (search, locality, type, BHK, price range), sort, pagination,
  skeleton loaders, responsive card grid.
- **Listing detail** — image, spec grid, and a locality price-trend line chart from `/trends`.
- **Auth** — login/signup (validated), JWT access+refresh in localStorage with auto-refresh,
  `<ProtectedRoute>` guard; **dashboard** shows the user's prediction history.
- Shared: navbar (auth-aware) + footer + theme toggle, shadcn-style UI primitives, sonner toasts.

## Wiring
Every page calls a real backend endpoint via `src/lib/api.ts`. Added a backend proxy
`GET /api/predict/options` (ML enums) for the form dropdowns.

## Verification in this environment
- npm registry blocked → could not run `next dev`/`tsc`. Authored carefully; **all 86
  internal `@/` imports resolve across 36 files** (structural check).
- Build locally with `npm install && npm run build`.

## Phase 4 (next)
Trends analytics dashboard, comparison tool, Leaflet map + heatmap, "good deal" indicator,
saved-search alerts, PDF export, admin dashboard. Backend endpoints for these already exist.
