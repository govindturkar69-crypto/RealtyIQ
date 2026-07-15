# Phase 4 — Advanced / Differentiator Features

All wired end-to-end to real backend endpoints and live data.

## Delivered
- **Trends analytics dashboard** (`/trends`) — locality-selectable average-price line
  chart over time + top-localities ₹/sqft bar chart, from `/api/trends` & `/api/trends/ranking`.
- **Property comparison tool** (`/compare`) — search and pick 2–3 listings, side-by-side
  specs with **listed vs ML-predicted price** and a deal verdict per property (`/api/compare`).
  Deep-linkable via `?ids=`.
- **Interactive map** (`/map`) — Leaflet map with per-listing markers (colour-banded by
  ₹/sqft) and a **price heatmap overlay** (`leaflet.heat`); popups link to detail pages.
- **"Is this a good deal?" indicator** — new `GET /api/listings/:id/deal` predicts the
  listing's value and flags under/over/fairly priced; shown as a `DealBadge` on the detail page.
- **Saved searches + in-app alerts** — save current filters (`/listings` → Save search);
  `/saved` lists them with live match counts and a **"N new" badge** since last seen, plus
  view/mark-seen/delete.
- **PDF report export** — "Download PDF report" on the results page generates a branded
  valuation PDF client-side with jsPDF.
- **Admin dashboard** (`/admin`, role-guarded) — totals (listings, predictions, users),
  most-searched localities table, and a listing-management table with delete.

## Backend additions
- `GET /api/listings/:id/deal` (predict + verdict for a single listing).
- Admin stats now include user count.

## New dependencies (frontend)
`leaflet`, `react-leaflet`, `leaflet.heat`, `jspdf` (+ `@types/leaflet`).

## Verification in this environment
- Backend: 15/15 `node:test` still green; modified files pass `node --check`.
- Frontend: 298 named imports resolve, all route files export defaults, no client-hook
  directive issues. (npm/`next build` runs on your machine.)

## Disclosed
- Map coordinates are approximate per-locality (`backend-api/src/seed/geo.js`).
- Saved-search alerts are in-app match-count deltas; no SMTP/email is wired.
- Trend time-axis is seeded across 24 months; aggregation is computed live.
