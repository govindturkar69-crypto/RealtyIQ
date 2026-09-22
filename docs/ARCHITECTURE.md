# RealtyIQ Architecture

## 1. Context

```text
Visitor / customer / administrator
                |
                v
     Next.js 14 web application
                |
        HTTPS JSON / Bearer JWT
                v
       Express API (system boundary)
          |                 |
          v                 v
       MongoDB       FastAPI ML service
 users/listings/...   model + metadata
```

The Express service is the application gateway and persistence owner. The frontend never connects directly to MongoDB or FastAPI. FastAPI is stateless at request time apart from its in-memory loaded model and metadata.

## 2. Repository modules

```text
frontend/
  src/app/               route pages and root providers/layout
  src/components/        domain and reusable presentation components
  src/lib/               API adapter, auth context, schemas, types, calculations
backend-api/
  src/config/            environment and database setup
  src/controllers/       HTTP orchestration
  src/routes/            endpoint composition, auth, validation, limits
  src/models/            Mongoose schemas/indexes
  src/middleware/        auth, role, validation, errors, request IDs
  src/services/          ML HTTP client
  src/lib/               pure query/deal/trend/CSV/geo helpers
  src/validators/        Zod contracts
  src/seed/              destructive demo data load
ml-service/
  app/                   FastAPI application, Pydantic schemas, predictor
  src/                   datasets, features, training, configuration
  data/                  raw and prepared Bengaluru/synthetic CSVs
  models/                checked-in metadata; generated model binary is ignored
  reports/               evaluation evidence
  verify/                lightweight pipeline checks/reference implementation
```

## 3. Runtime component responsibilities

### Frontend

- App Router pages compose server and client components.
- `Providers` supplies theme, authentication, and notifications.
- `src/lib/api.ts` owns fetch behavior, bearer headers, one refresh-and-retry attempt, and API methods.
- `AuthProvider` hydrates tokens from `localStorage`, resolves `/auth/me`, and exposes session actions.
- `ProtectedRoute` handles UX redirects; it does not replace API authorization.
- Domain components own filters, charts, maps, prediction form, calculators, listing cards, and PDF generation.

### Express API

- `app.js` installs trust proxy, request ID, Helmet, CORS, body parsing, logging, health route, API rate limiting, routers, 404, and error middleware.
- Routes attach media-type limits, authentication/role middleware, and Zod validators before controllers.
- Controllers coordinate models, aggregation helpers, and `mlClient`.
- Mongoose models implement persistence, indexes, password-neutral serialization, and listing price-per-square-foot derivation.
- The ML client translates FastAPI validation/unavailability/timeouts into API-facing failures.

### ML service

- FastAPI validates requests, exposes model information, and delegates inference to a singleton `Predictor` loaded at process start.
- The predictor loads `model.joblib` and metadata when present, engineers request features, predicts the log target, reverses the transform, and derives confidence bounds from stored residual sigma.
- Offline training cleans the selected dataset, removes outliers, engineers features, tunes/compares supported estimators, evaluates a held-out split, and writes model/metadata/report output.

## 4. Primary flows

### Authentication and refresh

```text
Login/signup -> Express validates -> bcrypt compare/hash -> MongoDB user
             <- user + access token + refresh token
Browser stores tokens in localStorage/in-memory
401 -> POST /auth/refresh -> verify + stored-token check -> rotate both tokens -> retry once
```

Authenticated middleware verifies access JWT, reloads the current user, denies disabled accounts, and uses the database role. Logout removes the presented refresh token. Password change removes every stored refresh token.

### Prediction

```text
Prediction form -> POST /api/predict -> optional JWT -> FastAPI /predict
                                           |                |
                                           |                v
                                           |         loaded model + metadata
                                           v
                                  persist Prediction (user optional)
                                           |
                                           v
                           result page/sessionStorage/share/PDF
```

Prediction persistence supports account history and admin locality statistics. The public `/api/predict/:id` link exposes a stored result without authentication.

### Listing and admin connection

Both panels operate on the same `Listing` collection. Public/customer pages read listings and derived trends; admins create, patch, delete, or import them. Changes therefore appear in browse results, maps, saved-search counts, comparisons, trends, and inquiries without a synchronization layer.

### Saved-search alerts

The client requests saved searches on page load and navbar polling (60 seconds). Express counts current listing matches and compares them with `lastNotifiedCount`. “Mark seen” stores the current count. There is no scheduler, queue, push, email, or SMS service.

### Inquiry lifecycle

A signed-in user creates an inquiry tied to a listing. Users read their own inquiries; admins read the shared queue and update status. There is no assignment, response body, chat transcript, or outbound delivery channel.

## 5. Data architecture

MongoDB collections are independent documents with Mongoose references:

```text
User 1 ---- * Prediction (optional user)
User 1 ---- * SavedSearch
User 1 ---- * Inquiry * ---- 1 Listing
User * ---- * Listing (favorites array)
User 1 ---- * Listing (createdBy, optional)
```

There are no migrations or database transactions. Deletion behavior is only partly coordinated: self-service account deletion removes the user's predictions, saved searches, and inquiries, but listing deletion does not cascade through favorites/inquiries and account deletion does not rewrite optional listing `createdBy` references. Detailed schema is in [DATABASE.md](DATABASE.md).

## 6. Deployment topology

Production documentation targets:

- Vercel: Next.js frontend.
- Render Node service: Express API.
- Render Docker service: FastAPI ML; image trains a fast Bengaluru model at build time.
- MongoDB Atlas: persistence.

Local `docker-compose.yml` starts MongoDB, ML, and API on ports 27017, 8001, and 8000. Frontend normally runs on 3000 outside Compose.

## 7. Cross-cutting concerns

- **Validation:** Zod in frontend/API and Pydantic in ML.
- **Security:** JWT/bcrypt, server-side roles, Helmet, CORS, rate limiting, body caps, escaped regex, generic production failures.
- **Observability:** request IDs and Morgan/API logs; timed ML logs. No centralized telemetry.
- **Resilience:** bounded ML timeouts; comparison degrades per item. No retries/circuit breaker/queue.
- **Accessibility:** semantic inputs/buttons/labels in most flows, focus handled by native controls. No formal audit.
- **Internationalization:** INR/en-IN formatting is hard-coded; no i18n layer.

## 8. Architecture decisions and constraints

- A gateway API keeps secrets, authorization, persistence, and ML adaptation out of the browser.
- MongoDB aggregation is sufficient for demo listing trends and avoids a separate analytics store.
- Polling/count deltas are the minimal notification mechanism at current scale.
- Client-side PDF, EMI, and ROI calculations avoid server state but are not authoritative financial calculations.
- Approximate locality coordinates support visualization, not address-level geospatial claims.
- Browser bearer tokens in localStorage simplify the SPA but increase the consequence of XSS; an HttpOnly cookie design should be evaluated before handling sensitive production data.

## 9. Known inconsistencies

- Root marketing says Indian cities; current production profile and choices are Bengaluru-specific.
- Checked-in metadata reports `HistGBT(numpy-sandbox-reference)` with R² about 0.739, while the root README presents a Gradient Boosting/XGBoost comparison with higher results. The container retrains and may generate a third runtime truth.
- Historical `docs/PHASE*.md` and root `TESTING.md` contain older feature/test counts. Canonical docs describe the inspected current tree.
- `node-fetch` is declared, but the API ML client uses native Node fetch.

## 10. Evolution triggers

Add a migration framework before incompatible schema changes; a job/queue service before real notification delivery; geocoding/spatial indexes before address-accurate maps; audit/event storage before regulated admin operations; and a shared schema/OpenAPI generator when manual API contract drift becomes recurring.

## 11. Browser proxy and trust boundaries

```text
Browser
  ↓ same-origin /api/*
Next.js frontend-origin proxy
  ↓ fixed server-side upstream
Express API
  ├── authentication
  ├── authorization/RBAC
  ├── CSRF
  ├── MongoDB Atlas
  └── authenticated ML client ── ML_SERVICE_TOKEN ──> FastAPI ML
```

The browser does not directly call the Render API under the canonical contract. Express remains authoritative for authentication, authorization, and CSRF. The ML service is a service-to-service trust boundary authenticated by `ML_SERVICE_TOKEN`; that token and browser JWTs are never exposed to browser JavaScript.

The boundaries are:

- Browser → Next.js proxy: same-origin request handling, cookie forwarding, CSRF header forwarding, bounded request IDs, and no arbitrary upstream selection.
- Next.js proxy → Express: fixed server-side origin, filtered headers, bounded timeout, controlled errors, and private/no-store responses.
- Express → MongoDB: server-side credentials and Mongoose persistence/authorization boundary.
- Express → ML: authenticated service-to-service requests with validated upstream responses.
- Logs/metrics → observability: request IDs and sanitized fields only; no tokens, cookies, credentials, or raw upstream exceptions.
- Deployment/provider boundary: Vercel, Render, and Atlas configuration remains outside browser control and requires independent provider verification.
