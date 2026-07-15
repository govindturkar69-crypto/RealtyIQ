# RealtyIQ — Frontend (Next.js 14) · Phase 3

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn-style UI. Talks to the
Express backend (Phase 2), which proxies the FastAPI ML service (Phase 1).

## Stack
Next.js 14 · React 18 · TypeScript · Tailwind CSS · React Hook Form + Zod ·
Recharts · sonner (toasts) · next-themes (dark mode) · lucide-react.

## Pages (core)
| Route | What it does |
|-------|--------------|
| `/` | Landing: hero, how-it-works, trust stats, CTAs |
| `/predict` | Multi-step form (RHF + Zod, live validation), dropdowns from ML `/options` |
| `/results` | Predicted price + 95% confidence bar, feature-importance chart, similar listings |
| `/listings` | Browse: filters, sort, pagination, skeleton loaders, card grid |
| `/listings/[id]` | Detail: image, specs, locality price-trend chart |
| `/login`, `/signup` | JWT auth with validation |
| `/dashboard` | Protected: your prediction history |
| `/trends` | Analytics: locality price trend + ₹/sqft ranking |
| `/compare` | Compare 2–3 listings: specs + listed vs predicted + deal verdict |
| `/map` | Leaflet map with price heatmap overlay |
| `/saved` | Protected: saved searches with new-match alerts |
| `/admin` | Role-guarded: stats + listing management |

Everything is wired to real backend endpoints — the confidence range and
feature-importance chart come from actual model output, listings/trends from the DB.

## Run locally
```bash
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                       # http://localhost:3000
```
Requires the backend (`:8000`) and ML service (`:8001`) running — see repo root
`docker compose up`, or start each service manually.

## Notes
- **Auth:** access + refresh tokens in `localStorage`; `api.ts` auto-refreshes on 401.
  Protected routes use a client `<ProtectedRoute>` guard.
- **Dark mode** via `next-themes`; toasts via `sonner`; charts via `recharts`.
- Advanced features (trends, compare, map, deal indicator, saved-search alerts, PDF export,
  admin) are implemented — see `docs/PHASE4.md`. Extra deps: leaflet, react-leaflet, leaflet.heat, jspdf.
