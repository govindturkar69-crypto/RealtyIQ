# Deployment Guide (Phase 5)

Deploy RealtyIQ live: **MongoDB Atlas** (database) → **Render** (ML service + API) →
**Vercel** (frontend). All three have free tiers. Order matters — deploy bottom-up.

## Architecture in production
```
Vercel (frontend)  →  Render: realtyiq-api (Express)  →  Render: realtyiq-ml (FastAPI)
                              ↓
                       MongoDB Atlas
```

---

## 0. Push to GitHub first
Both Render and Vercel deploy from a GitHub repo, so publish the project first
(see the GitHub steps you ran, or `git push`). Confirm `.env` files are **not** in the
repo — they're gitignored.

---

## 1. MongoDB Atlas (database)
1. Create a free M0 cluster at https://www.mongodb.com/cloud/atlas (Mumbai region is fine).
2. **Database Access** → add a user (letters/numbers password).
3. **Network Access** → Allow access from anywhere (`0.0.0.0/0`) — Render's IPs are dynamic.
4. **Connect → Drivers** → copy the connection string, insert `/realtyiq` before the `?`:
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/realtyiq?retryWrites=true&w=majority`
   Keep it for step 3.

---

## 2. ML service on Render (deploy this before the API)
1. Go to https://render.com → sign up with GitHub.
2. **New → Web Service** → pick your repo.
3. Settings:
   - **Root Directory:** `ml-service`
   - **Runtime:** Docker
   - **Dockerfile Path:** `ml-service/Dockerfile.txt`
   - **Instance Type:** Free
   - **Environment variables:** `NODE_ENV=production`, `DATASET=bengaluru`, an explicit
     `ALLOWED_ORIGINS` allowlist, and a unique `ML_SERVICE_TOKEN` (at least 32 random characters).
4. Create. First build takes ~5–10 min (it installs deps and **trains the model**).
5. When live, copy its URL, e.g. `https://realtyiq-ml.onrender.com`, for the API's
   `ML_SERVICE_URL`. `/health` is the only intentionally public probe; all other ML
   endpoints require `ML_SERVICE_TOKEN`.

> Free Render services sleep after ~15 min idle and take ~30s to wake — normal for a demo.

> Provider action: this repository cannot guarantee Render private networking. Prefer a
> Render private service/internal URL for ML where your plan supports it; otherwise keep
> the web service reachable only with the shared service token and do not expose that token
> to the browser.

---

## 3. Express API on Render
1. **New → Web Service** → same repo.
2. Settings:
   - **Root Directory:** `backend-api`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. **Environment variables:**
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | your Atlas string from step 1 |
   | `ML_SERVICE_URL` | the realtyiq-ml URL from step 2 |
   | `CORS_ORIGIN` | your Vercel URL (fill after step 5, then redeploy) |
   | `JWT_ACCESS_SECRET` | a long random string |
   | `JWT_REFRESH_SECRET` | a different long random string |
   | `ML_SERVICE_TOKEN` | the same unique service token configured on the ML service |
4. Create and wait for `MongoDB connected` in the logs. Test `https://realtyiq-api.onrender.com/health`.
5. **Do not run seed or CLI account scripts against this Render/Atlas service.**
   `npm run seed`, `npm run bootstrap-admin`, `seed-users.js`, and `set-password.js`
   fail closed for production-capable targets. Production administrator provisioning,
   if required, is a separately approved break-glass operation; it is not a generic
   deployment step. Use the CLI only with an explicitly allowlisted disposable target
   and the required runtime credentials/confirmation markers.

> Tip: `render.yaml` at the repo root can create both Render services automatically via
> **New → Blueprint** instead of doing steps 2–3 by hand.

---

## 4. Frontend on Vercel
1. Go to https://vercel.com → sign up with GitHub → **Add New → Project** → your repo.
2. Settings:
   - **Root Directory:** `frontend`
   - Framework: Next.js (auto-detected)
3. **Environment Variable:** `PROXY_UPSTREAM_API_ORIGIN` set server-side to the fixed Express API origin; never use a `NEXT_PUBLIC_*` variable for the proxy destination.
4. Deploy. You'll get a URL like `https://realtyiq.vercel.app`.

---

## 5. Wire the last connection
1. Copy your Vercel URL.
2. Back in Render → realtyiq-api → set `CORS_ORIGIN` to that Vercel URL → **Manual Deploy / Save**
   (so the browser is allowed to call the API).
3. Open your Vercel URL → sign up or log in with an account you created → make a prediction.

---

## Post-deploy checklist
- [ ] `/health` works on both Render services.
- [ ] Frontend loads listings (DB seeded, CORS correct).
- [ ] A prediction returns a price (frontend → API → ML all wired).
- [ ] `NODE_ENV=production` set (enables fail-fast secret checks + generic errors).
- [ ] JWT secrets are strong and **not** the dev defaults.
- [ ] `ML_SERVICE_TOKEN` is set to the same strong value on API and ML, and the ML URL is
      not publicly reachable (or is protected by the service token).
- [ ] Atlas password rotated if it was ever shared.

## Notes
- Free tiers sleep when idle; the first request after a nap is slow. Fine for a demo/portfolio.
- For a custom domain, add it in Vercel and update `CORS_ORIGIN` on Render to match.

## Canonical browser and readiness contract

Browser traffic uses `Frontend origin → /api/* → Next.js proxy → Express API`. The proxy destination is the server-only `PROXY_UPSTREAM_API_ORIGIN`; do not configure a browser-side `NEXT_PUBLIC_API_URL` for this contract and do not allow request input to select an upstream.

Render health checks are:

- API: `/ready` — MongoDB Mongoose driver readiness (`200 ready`, `503 not_ready`); no query or ML request is issued.
- API liveness: `/health` — Express process liveness only.
- ML: `/health` — FastAPI process/model liveness; protected ML routes still require `ML_SERVICE_TOKEN`.

The proxy, readiness contract, and local verification are implemented. Production runtime, provider revisions/configuration, Playwright, CI, and production ML artifact identity remain unverified.
