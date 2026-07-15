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
   - **Environment variable:** `DATASET = bengaluru`
4. Create. First build takes ~5–10 min (it installs deps and **trains the model**).
5. When live, copy its URL, e.g. `https://realtyiq-ml.onrender.com`. Test `/health` in the browser.

> Free Render services sleep after ~15 min idle and take ~30s to wake — normal for a demo.

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
4. Create and wait for `MongoDB connected` in the logs. Test `https://realtyiq-api.onrender.com/health`.
5. **Seed the cloud database once:** Render dashboard → the API service → **Shell** →
   run `npm run seed`. (Or temporarily run it locally with the Atlas `MONGODB_URI`.)

> Tip: `render.yaml` at the repo root can create both Render services automatically via
> **New → Blueprint** instead of doing steps 2–3 by hand.

---

## 4. Frontend on Vercel
1. Go to https://vercel.com → sign up with GitHub → **Add New → Project** → your repo.
2. Settings:
   - **Root Directory:** `frontend`
   - Framework: Next.js (auto-detected)
3. **Environment Variable:** `NEXT_PUBLIC_API_URL = https://realtyiq-api.onrender.com`
4. Deploy. You'll get a URL like `https://realtyiq.vercel.app`.

---

## 5. Wire the last connection
1. Copy your Vercel URL.
2. Back in Render → realtyiq-api → set `CORS_ORIGIN` to that Vercel URL → **Manual Deploy / Save**
   (so the browser is allowed to call the API).
3. Open your Vercel URL → sign up / log in (`demo@realtyiq.dev` / `Demo@12345`) → make a prediction.

---

## Post-deploy checklist
- [ ] `/health` works on both Render services.
- [ ] Frontend loads listings (DB seeded, CORS correct).
- [ ] A prediction returns a price (frontend → API → ML all wired).
- [ ] `NODE_ENV=production` set (enables fail-fast secret checks + generic errors).
- [ ] JWT secrets are strong and **not** the dev defaults.
- [ ] Atlas password rotated if it was ever shared.

## Notes
- Free tiers sleep when idle; the first request after a nap is slow. Fine for a demo/portfolio.
- For a custom domain, add it in Vercel and update `CORS_ORIGIN` on Render to match.
