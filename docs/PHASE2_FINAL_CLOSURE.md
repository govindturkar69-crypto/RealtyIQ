# RealtyIQ Phase 2 Final Closure

## 1. Executive Verdict

**PHASE 2 CLOSED — CODE COMPLETE, PROVIDER VERIFICATION REQUIRED**

The current working tree contains the expected Phase 1 and Phase 2 security
implementation. No confirmed Phase 2 code vulnerability or closure blocker was
found. Production sign-off still depends on provider-side checks that cannot be
verified from this repository checkout.

Phase 3 was not started.

## 2. Scope

This closure audit covered browser authentication and CSRF, JWT and refresh
sessions, RBAC and ownership enforcement, ML service authentication and error
handling, prediction/compare abuse controls, saved-search quotas, public share
tokens, anonymous retention, SecurityEvent persistence, TTL indexes, CORS and
trusted proxy configuration, secret/bootstrap hygiene, Docker/Render/Vercel
configuration, the historical intermittent ML 429, and regression behavior.

The audited repository base is commit `657d2436419531d4b877a62adb74bfd7d1e53df4`.
The working tree includes uncommitted Phase 1/Phase 2 changes; those changes
were included in this audit.

## 3. Security Controls Verified

| Area | Status | Evidence |
|------|--------|----------|
| Browser authentication | PASS | `backend-api/src/utils/authCookies.js` sets HttpOnly access/refresh cookies; `frontend/src/lib/api.ts` uses `credentials: "include"` and removes legacy persisted auth keys. |
| Production cookie security | PASS | Production cookies are Secure and SameSite=None; development uses Lax. |
| CSRF | PASS | `backend-api/src/middleware/csrf.js` requires a matching header for unsafe requests carrying auth cookies; backend tests cover rejection and legitimate flow. |
| Logout/password/session invalidation | PASS | `auth.controller.js` increments `tokenVersion` and clears refresh state for logout, password changes, role changes, status changes, and reuse detection. |
| Refresh-token storage | PASS | `User.js` stores hashed refresh tokens with hidden fields; `auth.controller.js` performs atomic rotation and reuse invalidation. |
| JWT configuration | PASS | `config/env.js` rejects missing, weak, placeholder, repeated, or equal production secrets and requires expiration settings. |
| Frontend secret exposure | PASS | No JWT, ML token, password, or secret is exposed through `NEXT_PUBLIC_*`; auth tokens are not stored in browser storage. |
| Admin RBAC | PASS | Admin routes use `authenticate` and `requireRole("admin")`; user routes enforce user/admin roles server-side. |
| Ownership / IDOR | PASS | User-scoped queries filter by authenticated user; prediction sharing uses owner/admin checks; favorites, inquiries, and saved searches are user-scoped. |
| ML authentication | PASS | FastAPI protected endpoints use `require_service_auth`; Express sends the service bearer credential and rejects redirects. |
| ML error handling | PASS | `services/ml.service.js` sanitizes non-JSON and upstream failures; FastAPI returns generic internal errors. |
| ML CORS/networking | PROVIDER VERIFICATION REQUIRED | `ml-service/app/main.py` defaults `ALLOWED_ORIGINS` to `*`; Render networking and the deployed environment must be confirmed. Protected endpoints still require the service token. |
| Prediction/compare abuse controls | PASS | Prediction and compare routes use the bounded prediction limiter; anonymous compare results are not persisted. |
| Saved-search quota | PASS | Server-side per-user quota is enforced; list matching uses one bounded MongoDB `$facet` aggregation. |
| Share tokens | PASS | High-entropy tokens are hashed, expiring, revocable, and legacy ObjectId links are grace-period limited. |
| Anonymous retention | PASS | Anonymous prediction records receive short expiry; Prediction TTL indexes enforce retention. |
| Security events | PASS | Authentication, logout, password, admin, bootstrap, and refresh-reuse events are persisted best-effort with protected admin retrieval. |
| TTL/index support | PASS | Prediction, saved-search, and SecurityEvent indexes were verified in the controlled local MongoDB runtime check. |
| Production CORS | PASS | Express rejects empty/wildcard production CORS configuration. |
| Trusted proxy | PASS | `TRUST_PROXY` is runtime-configured and validated as a non-negative integer; no fixed trust-proxy behavior is hard-coded. |
| Secret/bootstrap hygiene | PASS | No published admin password or fixed production secret exists; bootstrap requires explicit runtime credentials and is non-destructive. |
| Destructive startup behavior | PASS | Server startup only connects to MongoDB; destructive seed behavior is explicit CLI-only behavior. |

## 4. Automated Verification

| Check | Status | Result |
|------|--------|--------|
| Backend `npm test` | PASS | 31 tests passed, 0 failed. |
| Frontend `npm run lint` | PASS | No ESLint warnings or errors. |
| Frontend `npm run build` | PASS | Production build completed; only non-fatal webpack cache snapshot warnings appeared. |
| ML Python syntax validation | PASS | AST parsing passed for `app/main.py`, `app/security.py`, and `src/config.py`. |
| ML unit tests | BLOCKED | Host Python 3.14 lacks `numpy` and `fastapi`; tests cannot import. No random dependency installation was performed during closure. |
| Docker Compose configuration | PASS | `docker compose config --quiet` passed with ephemeral runtime values; only the existing obsolete `version` warning appeared. |
| Docker runtime | BLOCKED | Docker CLI is installed, but the Docker daemon is not running. |
| Secret/default scans | PASS | No published credentials or production secret values were found. |
| Browser auth-storage scan | PASS | No auth token persistence in localStorage/sessionStorage. |
| `git diff --check` | PASS | No whitespace errors; Git emitted only existing line-ending/config warnings. |

## 5. Runtime Verification

| Test | Status | Evidence |
|------|--------|----------|
| Signup/login and cookies | PASS | Covered by the controlled local MongoDB runtime harness previously run against the Phase 2 tree. |
| CSRF enforcement | PASS | Backend HTTP regression test and runtime harness passed. |
| Refresh rotation/reuse rejection | PASS | Controlled runtime harness passed rotation, replay rejection, and account invalidation. |
| Logout/password invalidation | PASS | Controlled runtime harness passed. |
| Ownership/RBAC isolation | PASS | Controlled runtime harness verified cross-user denial and admin-only access. |
| Prediction/history/share behavior | PASS | Controlled runtime harness verified prediction, ownership, high-entropy sharing, revocation, and legacy grace handling. |
| Saved-search quota and matching | PASS | Controlled runtime harness passed quota behavior; aggregation implementation is present in source. |
| SecurityEvent persistence/retrieval | PASS | Controlled runtime harness verified event creation and admin authorization. |
| Production Render API/ML request | PROVIDER/RUNTIME VERIFICATION REQUIRED | This checkout has no deployed service credentials or provider runtime access. |
| Production browser HTTPS/cookies | PROVIDER/RUNTIME VERIFICATION REQUIRED | Requires the deployed Vercel and Render origins. |

## 6. Provider Verification

### Render API

Repository configuration is present for `NODE_ENV`, database URI, ML URL,
ML token, CORS origin, JWT secrets, and `TRUST_PROXY`. The actual configured
values, deployed revision, HTTPS behavior, and startup logs require Render
access. Confirm that the deployed revision is
`657d2436419531d4b877a62adb74bfd7d1e53df4` or includes the audited changes.

### Render ML

The Dockerfile uses Python 3.11 and requires the service token in production.
`/health` is intentionally public; `/predict`, `/localities`, `/model-info`,
and `/feature-importance` are protected. Confirm the deployed token is present,
the service uses HTTPS, and private/internal networking is enabled where the
Render plan supports it. Confirm `ALLOWED_ORIGINS` is explicitly restricted in
the provider environment rather than relying on the source default wildcard.

### Vercel

Confirm `NEXT_PUBLIC_API_URL` uses HTTPS and points to the audited API. Confirm
no server secret is configured as a `NEXT_PUBLIC_*` variable. Exercise login,
refresh, logout, and CSRF-protected state changes in a real browser.

### MongoDB Atlas

Confirm TLS, least-privilege credentials, narrow network access, backups/PITR,
restore testing, connection limits/timeouts, and the expected TTL/compound
indexes. No Atlas connection or production data operation was performed.

## 7. Remaining Risks / Conditions

1. Render provider verification is required for the deployed commit, runtime
   secrets, exact ML URL, HTTPS, trusted proxy hop count, and health checks.
2. Render ML networking and `ALLOWED_ORIGINS` must be verified. The service-token
   boundary is implemented, but the repository cannot enforce provider-private
   networking.
3. Vercel-to-Render browser cookie/CSRF behavior requires one deployed HTTPS
   browser check.
4. MongoDB Atlas operational controls require provider verification.
5. ML unit tests remain blocked on this host because the available Python 3.14
   environment lacks the pinned runtime dependencies; the production Dockerfile
   uses Python 3.11.

These are verification conditions, not confirmed repository vulnerabilities.

## 8. Historical Issues

The prior intermittent error:

`ML service unreachable: Unexpected token 'T', "Too Many Requests" is not valid JSON`

is classified as an **INTERMITTENT / PROVIDER-LEVEL INVESTIGATION ITEM**.

Current source evidence:

- Express calls `POST ${ML_SERVICE_URL}/predict` and sends the service token in
  `backend-api/src/services/ml.service.js`.
- FastAPI protects `/predict` in `ml-service/app/main.py` and
  `ml-service/app/security.py`.
- FastAPI contains no rate limiter.
- Express prediction limiting occurs before the ML call and returns its own
  application response.
- Current Express code treats non-JSON upstream responses generically instead
  of exposing JSON parse errors.

The absence of provider logs or deployed runtime access prevents attribution of
the historical 429 to Render ingress, another upstream gateway, or a stale
deployment. No code change was justified by that historical symptom alone.

## 9. Files Changed During Final Closure

`docs/PHASE2_FINAL_CLOSURE.md` — this report only.

No source or production configuration changes were required.

## 10. Git Safety

- Branch: `main`
- HEAD: `657d2436419531d4b877a62adb74bfd7d1e53df4`
- Worktree: already contains the uncommitted Phase 1/Phase 2 implementation changes.
- No commit performed.
- No push performed.
- No destructive Git operation performed.
- No database seed, deletion, migration, or production-data operation performed.

## 11. Final Recommendation

**Phase 2 is formally closed at the repository-code level. Phase 3 may begin
only after the documented provider-level conditions are satisfied.**

