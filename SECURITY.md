# Security Audit & Hardening

Audit run against the "5 Security Checks Before You Launch" checklist
(Gitleaks · Bearer · ECC Production Audit · Trail of Bits · ECC Security Review).
Below is what was found and what was changed.

## 1 — Secret Leak Prevention (Gitleaks)
**Found:** No hardcoded real secrets anywhere. Every match in a scan was a variable
or field name (e.g. `password` params, `verifyAccessToken`), not a value. `.env` is
gitignored in all packages; `.env.example` files ship placeholders only; the only
browser-exposed var, `NEXT_PUBLIC_API_URL`, is a public URL. One weakness: the backend
silently fell back to a **known dev JWT secret** when unset.
**Fixed:**
- `config/env.js` now **refuses to start in production** if `MONGODB_URI`,
  `JWT_ACCESS_SECRET`, or `JWT_REFRESH_SECRET` is missing, and **rejects the insecure
  dev-default secret** in production.
- Dev fallbacks are kept only for local development.
- **Action for you:** the JWT secrets used locally were generated for dev. Before
  deploying, set fresh unique secrets in your host's env and **rotate** any secret that
  was ever committed.

## 2 — Personal Data Flow Audit (Bearer)
**Found & status:**
- **Passwords** are hashed with **bcrypt** (cost 10); never stored/returned in plaintext. ✔
- **API responses** never leak `passwordHash` or `refreshTokens` — `User.toJSON()` strips them. ✔
- **Logs** contain no user PII (request logger records method/path only; no bodies). ✔
- **Response filtering / IDOR** — every user-scoped query filters by the authenticated
  user id; no endpoint accepts a user id from the client to return another user's data. ✔
- **Data deletion** was missing.
**Fixed:**
- Added `DELETE /api/auth/me` — removes the user and all associated data
  (predictions, saved searches), wired to a **"Delete my account"** button in the dashboard.
**Known trade-off (documented, not silently ignored):** JWTs are stored in `localStorage`
for simplicity, which is readable by JavaScript (XSS-exposed). For a production launch,
move to `httpOnly`, `secure`, `sameSite` cookies. Documented here as a deliberate,
project-scope decision.

## 3 — Pre-Deploy Production Audit (ECC)
**Fixed / verified:**
- **Env validation:** fail-fast in production (see Check 1).
- **Debug code:** no `/test`, `/debug`, `/seed-data`, or backdoor HTTP endpoints exist
  (seeding is a CLI script, not a route); logging goes through a level-based logger, not stray `console.log`.
- **Error handling:** 5xx responses return a **generic message + a `requestId`
  correlation id**; stack traces and internals are logged server-side only (never sent to the client).
- **Security headers:** `helmet` configured explicitly — **HSTS** (1 year, includeSubDomains,
  preload), **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**,
  **Referrer-Policy: no-referrer**, CSP (helmet default), and `x-powered-by` disabled.
- **Rate limiting:** global API limiter **plus a strict auth limiter** (5 failed
  attempts/min/IP on login, signup, refresh; successful logins don't count).
- **CORS:** restricted to `CORS_ORIGIN` (not `*`); warns if left open in production.
- **DB security:** MongoDB Atlas uses TLS by default; use an Atlas URI (or TLS-enabled
  Mongo) in production and never expose the DB port publicly.

## 4 — Deep Security Audit (Trail of Bits)
- **Auth/authorization:** all protected routes use `authenticate`; admin-only routes use
  `requireRole("admin")`. **No IDOR** — user-scoped resources are matched on
  `{ _id, user }`. ✔
- **JWT:** short-lived access token (15m) + refresh token with server-side tracking and
  **rotation on refresh** and **revocation on logout**. ✔
- **Payments:** none in this app (N/A).
- **Input handling:** every route validated with **Zod**; Mongo queries use typed/validated
  input (no string-concatenated queries → no SQL/NoSQL injection); user-supplied search
  terms are **regex-escaped** before use. No user input is rendered as raw HTML. ✔

## 5 — Attacker's Perspective (ECC Security Review)
- **ID manipulation:** changing an id in a URL cannot return another user's private data —
  private collections are always filtered by the authenticated user. ✔
- **Auth bypass:** protected endpoints reject missing/invalid/expired tokens. ✔
- **Brute force:** mitigated by the auth rate limiter. ✔
- **Info disclosure:** generic errors + correlation ids; no stack traces to clients. ✔

## Summary of code changes
| File | Change |
|------|--------|
| `config/env.js` | Fail-fast prod secret validation; reject weak defaults |
| `middleware/rateLimiters.js` | New — global + strict auth rate limiters |
| `middleware/requestId.js` | New — correlation id per request |
| `app.js` | Explicit helmet headers, requestId, `x-powered-by` off |
| `middleware/errorHandler.js` | Correlation id in responses; generic 5xx in prod |
| `controllers/auth.controller.js` + `routes/auth.routes.js` | Account deletion; auth rate limiting |
| `frontend … dashboard`, `lib/api.ts` | Delete-account flow |
| `.env.example` | Auth rate-limit knobs |

> No AI audit replaces a professional security review. For real money or sensitive data
> at scale, get a human security assessment before launch.
