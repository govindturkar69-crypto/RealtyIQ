# RealtyIQ Technical Requirements Document

## 1. System boundary

RealtyIQ is a monorepo containing three independently started services and MongoDB:

| Layer | Runtime | Responsibility |
|---|---|---|
| `frontend` | Node.js / Next.js 14 | App Router UI, browser state, client PDF/calculators/maps |
| `backend-api` | Node.js 18+ / Express 4 | Public API, authentication, authorization, persistence, aggregation, ML proxy |
| `ml-service` | Python 3.11 / FastAPI | Model loading, validation, inference, metadata/options |
| MongoDB | MongoDB 7 locally / Atlas in deployment | Users, listings, predictions, saved searches, inquiries |

See [ARCHITECTURE.md](ARCHITECTURE.md) for flows and [API.md](API.md) for contracts.

## 2. Required technologies

### Frontend

- Next.js `14.2.5`, React 18, strict TypeScript, App Router.
- Tailwind CSS with CSS-variable theme tokens and `next-themes`.
- React Hook Form + Zod for user forms.
- Recharts for charts, Leaflet/react-leaflet/leaflet.heat for maps, jsPDF for reports.
- Framer Motion and React Three Fiber/Drei/Three for presentation effects.
- One browser API adapter in `src/lib/api.ts`; token state is in memory and `localStorage` (`riq_at`, `riq_rt`).

### API

- Express 4 ES modules and Mongoose 8.
- Zod request validation; JWT access/refresh tokens; bcryptjs password hashing.
- Helmet, CORS, express-rate-limit, Morgan, request IDs, centralized 404/error handling.
- Native `fetch`/AbortController for ML calls (Node 18+). `node-fetch` is installed but current ML client uses the runtime implementation.

### ML

- FastAPI, Pydantic 2, Uvicorn, pandas, numpy, scikit-learn, XGBoost, joblib.
- Bengaluru is the default dataset profile; a synthetic profile is retained for pipeline verification.
- Training compares model candidates on a log-transformed target and persists `models/model.joblib` plus `models/metadata.json`.
- Container builds perform fast Bengaluru training before starting Uvicorn.

## 3. Configuration contract

| Service | Variable | Default / requirement |
|---|---|---|
| Frontend | `NEXT_PUBLIC_API_URL` | Empty in browser (same-origin `/api` rewrite); example `http://localhost:8000` |
| API | `PORT` | `8000` |
| API | `NODE_ENV` | `development`; production activates fail-fast secret checks/generic errors |
| API | `CORS_ORIGIN` | `http://localhost:3000` |
| API | `MONGODB_URI` | Local development fallback; required explicitly in production |
| API | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Development fallbacks; strong distinct values required in production |
| API | `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | `15m`, `7d` |
| API | `ML_SERVICE_URL` | `http://localhost:8001` |
| API | rate-limit variables | API: 15 min/200; auth: 1 min/5 |
| ML | `PORT` | Container/start convention `8001` |
| ML | `DATASET` | `bengaluru` |
| ML | `ALLOWED_ORIGINS` | `*` unless configured |

Secrets must never be committed. `.env.example` files document names only.

## 4. Interface and data requirements

- Browser requests target Express `/api`; only Express may access MongoDB or call FastAPI.
- JSON is the default media type with a 1 MiB Express body cap. Listing import is `text/csv` with a 5 MiB route cap.
- Express must retain `{ error, details?, requestId }` for failures. FastAPI retains `{ detail }` for errors.
- Dates are MongoDB/JSON ISO timestamps. Identifiers are MongoDB ObjectId strings.
- All protected operations require `Authorization: Bearer <accessToken>`.
- Authorization must use the current database user and status, not only claims in an old access token.
- API schema changes require synchronized changes to backend validator/controller, frontend types/client/caller, and canonical docs.

## 5. Persistence requirements

- Mongoose schemas and indexes in `backend-api/src/models` are the schema source of truth.
- Derived listing `pricePerSqft` is calculated by model middleware from price and size.
- Prediction input/output and model identity are retained for history/analytics.
- Refresh tokens are stored per account, capped at five, and rotated.
- No migration system exists. Incompatible schema changes require an explicit migration/rollback plan before implementation.
- Seed deletes all users and listings, then creates demo/admin accounts and up to 600 listings. It does not clear predictions, saved searches, or inquiries; this can leave dangling historical references and must be considered before use.

## 6. Security requirements

- Validate request bodies, params, and queries at trust boundaries.
- Hash passwords; never return `passwordHash` or stored refresh tokens.
- Rotate refresh tokens and revoke stored sessions on password change.
- Rate-limit API traffic and use the stricter limiter for login/signup/refresh.
- Keep admin authorization server-side and protect the last active admin.
- Escape user search text before constructing MongoDB regular expressions.
- Restrict production CORS to the configured web origin and use long random JWT secrets.
- Do not log tokens, passwords, connection strings, or inquiry personal data unnecessarily.

Current limitations: browser tokens live in `localStorage` (XSS exposure), no CSRF model is needed for bearer headers but XSS prevention is critical, no audit log exists, and no documented automated backup/restore or retention policy exists.

## 7. Reliability and performance requirements

- `/health` is dependency-light for Express; FastAPI health reports whether its model is loaded.
- ML client timeouts: prediction 8 s, options/importances 5 s, health/info 3 s.
- Return 502 for unreachable ML and 504 for ML timeout; do not hang API requests.
- Listing queries paginate and cap `limit` at 100; saved-search counts run ordinary Mongo queries and may need redesign if volume grows.
- Trends and admin statistics use MongoDB aggregation and indexed fields where available.
- Render free-tier cold starts are an accepted demo constraint, not an SLO.

## 8. Build and deployment requirements

- Local orchestration: `docker-compose.yml` starts MongoDB, ML, and API; frontend starts separately.
- Render blueprint deploys the ML Docker service and Node API; MongoDB Atlas is external.
- Vercel deploys `frontend` with `NEXT_PUBLIC_API_URL` pointing to the API.
- Deploy in dependency order: database → ML → API/seed → frontend → production CORS update.
- The repository names Dockerfiles `Dockerfile.txt`; deployment config must continue to reference that exact filename unless renamed consistently.

## 9. Verification requirements

- Backend: Node built-in test suite plus syntax/start checks in a configured environment.
- ML: standard-library unittest verification; train/inference smoke test when ML behavior changes.
- Frontend: lint, production build, and manual responsive/authenticated flows. No frontend automated suite currently exists.
- Contract changes need at least one end-to-end smoke path across the affected services.
- Documentation-only work may use static inspection and must not claim commands passed unless actually run.

## 10. Technical unknowns and debt

- No CI workflow pins and runs the verification matrix.
- No Express OpenAPI schema or generated client prevents contract drift.
- No telemetry, tracing backend, audit events, alerting, backup test, or capacity target is defined.
- Agent and broker values remain assignable but currently have no protected panel; define their permissions before enabling either role.
- Checked-in ML metadata is explicitly a numpy sandbox reference; README model tables describe another training result. A reproducible authoritative model artifact/evaluation run must be selected.
- `ALLOWED_ORIGINS=*` is the ML default, although the ML service is normally private behind Express.
