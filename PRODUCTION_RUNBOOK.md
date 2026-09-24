# Production Runbook

## System Overview

```text
Browser
  → same-origin Next.js /api/*
  → Next.js frontend proxy
  → Express API
  → MongoDB Atlas
  → authenticated FastAPI ML service
```

The browser uses one canonical API boundary. Express owns authentication,
authorization, validation, persistence, and the ML integration.

## Production Components

- **Vercel:** serves the Next.js frontend and frontend-origin `/api/*` proxy.
- **Render API:** runs the Express API and connects to MongoDB and ML.
- **Render ML:** runs FastAPI inference and exposes a public liveness probe plus
  protected inference/metadata routes.
- **MongoDB Atlas:** stores users, listings, predictions, saved searches,
  inquiries, and security events.

Provider configuration, deployment revisions, backups, networking, and runtime
secrets are provider responsibilities. Repository documentation describes the
contract but does not replace provider verification.

## Canonical Browser Traffic

Browser requests use relative `/api/*` paths. The proxy reads the fixed,
server-only `PROXY_UPSTREAM_API_ORIGIN`; it is never selected by request input.
`NEXT_PUBLIC_API_URL` is not the canonical browser API mechanism.

Application paths preserve the `/api` prefix. The proxy maps `/api/health` to
API `/health` and `/api/ready` to API `/ready`.

## Health and Readiness

- API `/health` is public process liveness.
- API `/ready` is public readiness and returns ready only when the Mongoose
  driver is connected. It performs no database query and does not call ML.
- ML `/health` is the public ML process/model liveness probe.

Liveness answers whether a process can serve a probe. Readiness answers whether
the API's required database connection state is available for traffic.

## Authentication and Session Operations

Access and refresh cookies are HttpOnly and Secure in production. SameSite is
configured by the backend environment. The CSRF cookie is intentionally
readable so the frontend can send its value in `X-CSRF-Token` on state-changing
requests. Express validates the session, CSRF token, ownership, and RBAC.

Logout revokes the presented session and clears the session cookies. Never copy
cookies or tokens into logs, support tickets, screenshots, or documentation.

## Proxy Operations

The proxy preserves methods, bodies, query strings, approved cookies and CSRF
headers, and bounded request IDs. It preserves safe response status and headers,
sanitizes `Set-Cookie`, uses `Cache-Control: private, no-store`, and applies a
15-second timeout. Upstream failures are returned as controlled errors; no
automatic retry is used for authenticated state-changing requests.

## Monitoring and Request IDs

Capture the request ID from a failing response or server log and use it to
correlate the frontend, API, and ML portions of one request. Logs must remain
sanitized. No external monitoring provider is assumed by this runbook.

## Common Failure Investigation

| Symptom | Likely boundary | Safe investigation | Do not change blindly |
|---|---|---|---|
| `API proxy is not configured` | Vercel environment | Check the production variable is present and redeploy the intended revision | Do not switch browsers back to a direct Render URL |
| Application route returns 404 | Proxy/API prefix | Check `/api/*` prefix preservation and the deployed revision | Do not remove `/api` from backend routes |
| `401` | Session or authorization | Check cookies, `/api/auth/me`, logout state, and request ID | Do not expose JWTs or disable auth |
| `403` | CSRF or RBAC | Check the CSRF bootstrap/header and account role | Do not disable CSRF or role checks |
| `429` | Rate limiting | Check request frequency and limiter logs | Do not remove limits to clear a single test |
| `/ready` returns `503` | MongoDB readiness | Check provider status and API logs | Do not turn readiness into an unconditional `200` |
| ML timeout or cold start | Render ML boundary | Check ML `/health`, request ID, and service latency | Do not expose the ML token or add unbounded retries |
| Database failure | Atlas/API boundary | Check Atlas status, connectivity, and API logs | Do not run destructive repair commands |

## Safe Deployment Procedure

1. Identify the approved Git tag and exact commit.
2. Confirm the intended Vercel, Render API, Render ML, and Atlas targets.
3. Verify required environment variable names are configured without exposing values.
4. Deploy through the provider-supported workflow for the approved revision.
5. Confirm the deployment revision before smoke testing.

Normal operations must not force-push, rewrite production Git history, or clean
unrelated worktree files.

## Post-Deployment Verification

Check, in order:

1. Frontend page load and fatal console errors.
2. Frontend `/api/health` and `/api/ready`.
3. CSRF bootstrap and authenticated session restoration.
4. One protected request and one valid prediction.
5. Prediction history/detail persistence after refresh.
6. Admin authorization when an approved admin account is available.
7. ML `/health` and protected-route behavior.

Provider deployment and production browser checks are evidence gates, not claims
made merely because a build completed.

## Incident Handling

Identify affected services, capture request IDs and timestamps, preserve logs,
check provider health, and record the exact deployed revision. Avoid destructive
changes while evidence is being collected. Escalate provider or data issues to
the responsible operator.

## Data Safety

Treat production database changes as controlled operations. Do not run seed,
repair, migration, deletion, or restore commands without an approved target,
backup/recovery evidence, and an explicit data-impact review.

## Secret Handling

Environment variable names such as `MONGODB_URI`, JWT secrets,
`ML_SERVICE_TOKEN`, and `PROXY_UPSTREAM_API_ORIGIN` may be referenced by name
only. Values belong in the provider's secret configuration and must never be
committed or logged.
