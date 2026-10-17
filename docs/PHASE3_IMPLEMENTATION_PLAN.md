# RealtyIQ Phase 3 Implementation Plan

## 1. Executive Summary

Phase 3 should improve reliability and diagnosis without changing the current
Vercel → Express → MongoDB/FastAPI architecture. Phase 1 and Phase 2 security
controls are present and must remain unchanged.

The repository has a solid baseline: centralized Express errors, request IDs,
bounded API inputs, bounded ML timeouts, generic production failures, FastAPI
exception sanitization, and useful frontend loading/error states. The highest
value remaining work is small and local:

1. Make ML failure classes explicit, including 429, 5xx, malformed success
   bodies, connection failures, and timeouts.
2. Propagate a validated request ID from Express to FastAPI and include it in
   service logs/errors.
3. Add a lightweight API readiness endpoint that reports MongoDB readiness
   separately from liveness.
4. Add browser request timeouts and safe non-JSON response parsing.
5. Bound the remaining high-cardinality admin/user reads and add focused
   regression tests and operational documentation.

No Redis, queue, broker, distributed tracing platform, Kubernetes, or new
service is justified by the current architecture or measured requirements.

## 2. Current Reliability State

### API

- All controllers use `asyncHandler`, and Express has centralized 404/error
  middleware (`backend-api/src/utils/asyncHandler.js`,
  `backend-api/src/middleware/errorHandler.js`).
- Mongo startup has a 10-second server-selection timeout
  (`backend-api/src/config/db.js:5-9`), but there is no separate readiness
  endpoint or explicit connection-state reporting after startup.
- API JSON is capped at 1 MiB, CSV import at 5 MiB, and listing pagination is
  capped at 100.
- `GET /api/auth/admin/users` is not paginated
  (`backend-api/src/controllers/auth.controller.js`), and user inquiry reads
  are not explicitly limited (`backend-api/src/controllers/inquiry.controller.js`).
  These are bounded by authorization but can grow with data volume.
- The server catches startup failures, but there are no explicit process-level
  `unhandledRejection`/`uncaughtException` policies. Render's process manager
  remains the restart boundary.

### ML communication

- `backend-api/src/services/ml.service.js` uses `AbortController` timeouts:
  prediction 8 seconds, metadata calls 5 seconds, health/info 3 seconds.
- Redirects are rejected and the service token is attached server-side.
- Non-422 upstream failures are currently collapsed to a generic 502. A 429
  loses `Retry-After`, 5xx is not distinguished, and a malformed JSON body on
  a successful HTTP response can continue as `{}` and fail later in a
  controller.
- There is no automatic retry. This is currently safer than retrying inference
  blindly, especially during provider throttling.
- FastAPI has no application rate limiter and logs method/path/status/duration,
  but it does not receive the Express request ID.

### Frontend

- `frontend/src/lib/api.ts` performs one refresh-and-retry on 401 and sends
  credentials/CSRF headers correctly.
- Browser fetches have no AbortController timeout.
- Non-JSON API responses are parsed with `JSON.parse` without a fallback,
  causing a client-side `SyntaxError` for proxy/plain-text failures such as a
  429 body.
- Pages generally expose loading, empty, or toast error states. There is no
  root `error.tsx` boundary or shared transport-error classification.

## 3. Current Observability State

- Express emits a request ID (`backend-api/src/middleware/requestId.js`) and
  returns it as `X-Request-Id`.
- Morgan records HTTP method/path/status/latency; the application logger emits
  timestamped text lines with levels.
- FastAPI logs method/path/status/duration and sanitized exceptions.
- The Express request ID is not forwarded to FastAPI, so one browser request
  cannot currently be followed reliably through both services.
- Logs do not include a consistent service field or a structured event shape.
- Current logging does not intentionally include passwords, JWTs, refresh
  tokens, service tokens, cookies, or database credentials.

## 4. Current Error Handling State

| Failure | Current behavior | Risk | Recommended behavior |
|--------|------------------|------|-----------------------|
| Validation | 400 with validation details and request ID | Low | Preserve current contract. |
| Authentication | 401; frontend attempts one refresh | Low | Preserve; classify refresh failure for UX/logging. |
| Authorization | 403 | Low | Preserve server-side RBAC. |
| CSRF | 403 JSON response | Low | Preserve. |
| Rate limit | Express 429 JSON | Medium | Preserve status; expose bounded retry metadata if useful. |
| MongoDB failure | Central 500/generic production response | Medium | Add readiness state and dependency error classification without leaking internals. |
| ML timeout | 504 after bounded abort | Low | Preserve; add request ID and duration context. |
| ML connection failure | 502 generic | Medium | Preserve status but distinguish connection failure in logs/metrics. |
| ML 429 | Currently converted to generic 502 | High | Preserve upstream throttling semantics internally, safely map to a stable API response, and honor bounded `Retry-After` without automatic retry. |
| ML 5xx | Currently generic 502 | Medium | Classify as upstream failure in logs and return stable API error. |
| Malformed ML response | Non-JSON failure becomes generic 502; malformed 2xx can become `{}` | High | Validate response shape/content type and return a controlled 502. |
| Unexpected server error | Generic 500 in production, stack logged internally | Low | Preserve. |

## 5. Current Timeout State

| Boundary | Current state | Assessment |
|----------|---------------|------------|
| Browser → API | No client timeout | Add a conservative shared timeout with AbortError classification; do not retry non-idempotent writes. |
| API → MongoDB | `serverSelectionTimeoutMS: 10000` at initial connect | Add readiness/observability first; only add socket/query limits after measurements. |
| API → ML prediction | 8 seconds | Existing bounded timeout is reasonable for a synchronous inference request; preserve initially. |
| API → ML metadata/health | 3–5 seconds | Existing bounded values are appropriate; preserve. |
| ML → external service | None | No external network dependency is present. |

## 6. Current Retry State

- The frontend has exactly one refresh attempt after a 401.
- There are no server-side retries.
- Automatic prediction retries are **not recommended initially**: inference is
  resource-consuming, provider 429s should not be amplified, and retrying at
  the controller could duplicate persisted prediction records.
- If a future measured transient-failure rate justifies retrying ML, limit it to
  one retry, only for connection/timeout errors, with backoff and only before
  persistence. That is not part of the initial Phase 3 scope.

## 7. Health/Readiness State

- Express `/health` is dependency-light and always reports API status
  (`backend-api/src/app.js:30`). It is suitable as a liveness probe but does
  not prove MongoDB readiness.
- FastAPI `/health` reports model-loaded state and is intentionally public
  (`ml-service/app/main.py:38-41`).
- Render uses `/health` for both services (`render.yaml:10`, `26`).
- There is no separate `/ready` endpoint.

Recommended smallest design:

- Keep `/health` cheap and unchanged for liveness.
- Add `GET /ready` in Express that reports MongoDB connection readiness using
  Mongoose connection state, without running a query or calling ML.
- Optionally add a clearly documented ML readiness check only for operator/admin
  diagnostics; do not make liveness depend on a sleeping Render ML service.

## 8. Dependency Failure Behavior

| Dependency failure | Current behavior | Phase 3 direction |
|--------------------|------------------|-------------------|
| MongoDB down at startup | Startup fails after connection timeout | Keep fail-fast startup; expose readiness state after startup. |
| MongoDB unavailable later | Requests reach generic error middleware | Add consistent dependency classification/log context; avoid inventing cached data. |
| ML down | Prediction returns generic 502 | Add explicit upstream-unavailable classification and request ID. |
| ML slow | Prediction returns 504 after 8 seconds | Preserve timeout; expose a stable frontend message. |
| ML 429 | Generic 502 today | Detect 429, preserve bounded retry metadata, and do not auto-retry. |
| ML 500 | Generic 502 today | Detect/classify upstream 5xx and keep internal details private. |
| API unavailable | Browser fetch can hang until platform/network timeout | Add browser timeout and transport error classification. |
| Refresh fails | In-memory tokens are cleared and request fails | Preserve; show a consistent signed-out/session-expired state. |

## 9. Findings

| ID | Severity | Area | Finding | Evidence | Risk |
|----|----------|------|---------|----------|------|
| P1-01 | P1 | ML reliability | ML 429/5xx/content-type failures are not represented distinctly; malformed successful bodies are not schema-validated. | `backend-api/src/services/ml.service.js:11-19` | Provider throttling and upstream corruption become ambiguous 502/500 failures and are harder to diagnose. |
| P1-02 | P1 | Observability | Request IDs stop at Express and are not forwarded to FastAPI. | `backend-api/src/middleware/requestId.js`; `backend-api/src/services/ml.service.js:8-10`; `ml-service/app/main.py:25-31` | Cross-service incident tracing is incomplete. |
| P1-03 | P1 | Readiness | Express `/health` does not distinguish liveness from MongoDB readiness. | `backend-api/src/app.js:30`; `backend-api/src/config/db.js:5-9`; `render.yaml:26` | Render can route traffic to an API that cannot serve database-backed requests. |
| P1-04 | P1 | Frontend transport | Browser API calls have no timeout and parse every response as JSON. | `frontend/src/lib/api.ts:29-49` | Plain-text gateway failures and hung requests produce poor recovery behavior. |
| P1-05 | P1 | Resource bounds | Admin users and personal inquiries are read without explicit pagination/limits. | `backend-api/src/controllers/auth.controller.js`; `backend-api/src/controllers/inquiry.controller.js` | Response size and query latency grow with data volume. |
| P2-01 | P2 | Logging | Logs are text-formatted and lack a consistent service/event schema. | `backend-api/src/utils/logger.js`; Morgan setup in `backend-api/src/app.js`; ML logger in `ml-service/app/main.py` | Searching and alerting are manual, though request IDs exist locally. |
| P2-02 | P2 | Frontend resilience | No root error boundary or shared error classification exists. | No `frontend/src/app/error.tsx`; page-level catches are inconsistent. | Route-level failures can render poorly and messages vary. |
| P2-03 | P2 | Database diagnostics | MongoDB connection state and query timeout behavior are not exposed operationally. | `backend-api/src/config/db.js` | Incident diagnosis is slower; do not add broad query timeouts without measurement. |
| P3-01 | P3 | Operations | No centralized metrics/alerting/trace backend or CI workflow is present. | Repository inventory and `docs/TRD.md` | Useful later, but not justified for the current small architecture. |

No P0 finding was identified.

## 10. Proposed Phase 3 Changes

### Change 1 — Harden the ML client contract (P1-01)

- **Problem:** 429, 5xx, timeout, connection, redirect, non-JSON, and malformed
  success responses are not consistently classified.
- **Likely files:** `backend-api/src/services/ml.service.js`,
  `backend-api/src/utils/ApiError.js`, focused tests under
  `backend-api/src/test/`.
- **Solution:** Validate the expected prediction/metadata shape, inspect status
  and content type, preserve a bounded upstream status classification, capture
  `Retry-After` as safe metadata, and keep client-facing messages generic.
- **Why:** Directly addresses the historical 429 symptom without assuming its
  provider cause.
- **Risk:** Low; existing API error contract remains `{ error, requestId }`.
- **Testing:** Mock 200 JSON, malformed 200, non-JSON 429, JSON 429, 500,
  timeout, connection refusal, and redirect responses.
- **Rollback:** Revert the isolated ML client/test change; no schema or data
  migration.

### Change 2 — Propagate request correlation (P1-02)

- **Problem:** Express and FastAPI logs cannot be joined reliably.
- **Likely files:** `backend-api/src/middleware/requestId.js`,
  `backend-api/src/services/ml.service.js`, `ml-service/app/main.py`,
  `ml-service/app/security.py` only if dependency injection needs request
  context, plus tests/docs.
- **Solution:** Validate or generate a bounded request ID, send it as
  `X-Request-Id` to ML, and include it in FastAPI logs/responses without
  logging credentials.
- **Why:** Small, architecture-native improvement; no tracing platform needed.
- **Risk:** Low; preserve the public error contract and header name.
- **Testing:** Assert outbound header propagation and matching service log/error
  context with a test client or mocked fetch.
- **Rollback:** Remove the outbound header/log additions; no data impact.

### Change 3 — Add lightweight readiness (P1-03)

- **Problem:** `/health` is liveness-only while Render needs a dependency-aware
  readiness signal.
- **Likely files:** `backend-api/src/app.js`, `backend-api/src/config/db.js`,
  `render.yaml`, `DEPLOYMENT.md`, backend tests.
- **Solution:** Add `/ready` based on Mongoose connection state; keep `/health`
  cheap and public. Configure Render API health checking only after provider
  behavior is confirmed.
- **Why:** Prevents traffic routing to an API that cannot reach MongoDB without
  coupling liveness to ML cold starts.
- **Risk:** Medium operational risk if the provider uses the wrong endpoint.
- **Testing:** Unit-test connection-state mapping and HTTP status; verify startup
  and a local Mongo outage without destructive data operations.
- **Rollback:** Revert the endpoint/provider path; `/health` remains available.

### Change 4 — Add browser transport timeouts and safe parsing (P1-04)

- **Problem:** Browser requests can hang and plain-text proxy failures cause
  JSON parse exceptions.
- **Likely files:** `frontend/src/lib/api.ts`, `frontend/src/lib/auth-context.tsx`,
  focused frontend tests if a test runner is introduced later, and `docs/TESTING.md`.
- **Solution:** Use one shared AbortController timeout, parse JSON only when
  appropriate, fall back to status text, and keep the existing single refresh
  attempt. Do not retry writes after timeout.
- **Why:** Improves user-visible recovery without UI redesign or new dependencies.
- **Risk:** Medium; timeout values must be chosen from existing backend/ML
  bounds and verified against slow Render cold starts.
- **Testing:** Mock JSON, text, empty, 401/refresh, timeout, and network-error
  responses.
- **Rollback:** Revert the adapter-only change.

### Change 5 — Bound high-cardinality reads (P1-05)

- **Problem:** Admin users and personal inquiries can grow without explicit
  response limits.
- **Likely files:** `backend-api/src/controllers/auth.controller.js`,
  `backend-api/src/controllers/inquiry.controller.js`, corresponding routes,
  validators, API docs, and tests.
- **Solution:** Add validated page/limit parameters with conservative defaults
  and maximums; preserve current default ordering and admin/user permissions.
- **Why:** Prevents gradual response/memory growth using existing pagination
  patterns.
- **Risk:** Medium API contract change; frontend callers must accept pagination.
- **Testing:** Bounds, default behavior, authorization, and large-data fixtures.
- **Rollback:** Temporarily retain the old response shape behind a narrow
  compatibility path or revert before rollout; no database migration.

### Change 6 — Minimal structured operational logging (P2-01)

- **Problem:** Logs contain useful fields but are not consistently structured.
- **Likely files:** `backend-api/src/utils/logger.js`, request/error middleware,
  `ml-service/app/main.py`, deployment documentation, and tests.
- **Solution:** Emit one-line JSON or stable key/value events with service,
  request ID, route, status, duration, and error class; explicitly exclude
  cookies, authorization, tokens, passwords, and request bodies.
- **Why:** Makes provider log search practical without introducing telemetry
  infrastructure.
- **Risk:** Low-to-medium log format change; verify Render log readability.
- **Testing:** Snapshot/sanitization checks for representative success and error
  events.
- **Rollback:** Revert logger formatting while retaining request IDs.

### Change 7 — Frontend route-level failure boundary (P2-02)

- **Problem:** No shared fallback exists for unexpected rendering errors.
- **Likely files:** `frontend/src/app/error.tsx`, possibly shared UI primitives.
- **Solution:** Add a minimal accessible retry/sign-out-safe error boundary; do
  not redesign existing pages.
- **Why:** Prevents blank/broken route experiences.
- **Risk:** Low.
- **Testing:** Build and a focused throw/recovery smoke test.
- **Rollback:** Remove the route boundary.

## 11. Explicitly NOT Doing

- Redis, Kafka, RabbitMQ, queues, Kubernetes, or new microservices.
- A distributed tracing platform; request IDs are sufficient at this scale.
- Automatic retries for prediction writes or ML 429 responses.
- Transactions everywhere or a migration framework for additive reliability work.
- A database/ML-dependent liveness probe.
- UI redesign, new product workflows, or model changes.
- Broad query-timeout changes without measured production evidence.
- Centralized metrics infrastructure before basic log/request correlation is in
  place.

## 12. Testing Plan

### P1 tests

1. Backend ML client contract tests for 200, malformed 200, 429, 5xx, timeout,
   connection refusal, and redirect responses.
2. Request-ID propagation test from Express mock fetch to ML request headers.
3. `/health` versus `/ready` tests for connected/disconnected Mongo states.
4. Pagination/limit tests for admin users and inquiries, including authorization.
5. Frontend API adapter tests for text responses, empty responses, 401 refresh,
   timeout, and network failure.
6. Preserve all current backend tests, frontend lint/build, and Phase 2 runtime
   regression harnesses.

### Operational checks

- Local API with MongoDB available and unavailable.
- Local ML available, slow, stopped, malformed, and throttled through mocks.
- One controlled cross-service smoke path with a shared request ID.
- Render deployment health/readiness verification after provider configuration.

## 13. Documentation Plan

Update only after implementation:

- `DEPLOYMENT.md`: `/health` versus `/ready`, request-ID troubleshooting,
  Render log locations, ML failure classes, and rollback steps.
- `docs/API.md`: stable error/status behavior for ML timeout, unavailable,
  throttled, and malformed responses; any new readiness endpoint.
- `docs/ARCHITECTURE.md`: request-ID propagation and dependency failure flow.
- `docs/TRD.md`: final timeout/error contracts and readiness semantics.
- `docs/TESTING.md`: failure-injection and operational smoke procedures.

## 14. Implementation Order

1. Baseline Phase 2 regression verification and capture current API contracts.
2. Implement and test the ML client contract (Change 1).
3. Add request-ID propagation and sanitization (Change 2).
4. Add `/ready` and deployment documentation (Change 3).
5. Add browser timeout/safe parsing behavior (Change 4).
6. Bound admin/user high-cardinality reads (Change 5).
7. Run backend/frontend/ML checks and local failure-injection tests.
8. Add minimal structured logging (Change 6) if provider log format review
   confirms it is useful.
9. Add the frontend route boundary (Change 7) as a separate low-risk slice.
10. Perform provider/runtime verification and only then close Phase 3.

Dependencies:

- Change 2 should follow Change 1 so ML error logs use the finalized error
  classification.
- Change 3 must precede changing Render's health-check path.
- Change 4 depends on the finalized API error/status contract.
- Change 5 requires synchronized frontend/API response-shape tests.
- Changes 6–7 are independent of database schema and can be deferred.

## 15. Expected Result

After the P1 work, RealtyIQ should:

- distinguish ML timeout, unavailable, throttled, malformed, and upstream-5xx
  failures without leaking internals;
- correlate a browser/API request through Express and FastAPI with one safe ID;
- expose cheap liveness and dependency-aware readiness separately;
- prevent browser requests from hanging indefinitely or crashing on plain-text
  gateway responses;
- keep administrative and inquiry responses bounded;
- retain all Phase 2 authentication, authorization, CSRF, retention, token,
  and ML-boundary protections unchanged.

