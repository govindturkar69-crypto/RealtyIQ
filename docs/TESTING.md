# RealtyIQ Testing and Verification

## 1. Current test inventory

### Backend API

The backend uses Node's built-in `node:test` runner (`npm test` → `node --test`). Tracked tests cover:

| File | Scope |
|---|---|
| `src/test/app.test.js` | Health response and protected-route boundaries |
| `src/test/authSchemas.test.js` | Authentication/update validation schemas |
| `src/test/deal.test.js` | Deal threshold calculation |
| `src/test/geo.test.js` | Deterministic/fallback locality coordinates |
| `src/test/listingCsv.test.js` | CSV parsing and row normalization |
| `src/test/queryBuilder.test.js` | Listing filters, sorting, pagination/query construction |
| `src/test/trends.test.js` | Trend/ranking aggregation pipeline construction |

These are mostly pure/schema tests with a small HTTP integration surface. They do not prove real MongoDB CRUD, JWT rotation persistence, ML proxy behavior, CSV database insertion, last-admin protection, or full account cleanup.

### ML service

`ml-service/verify/test_pipeline.py` uses standard-library `unittest` for dataset/profile pipeline behavior. `verify/numpy_reference.py` is a reference/evidence implementation, not the FastAPI production model itself.

### Frontend

The tracked browser suite uses Playwright for deterministic local smoke and proxy
verification. No frontend unit, component, accessibility, or visual-regression suite is
tracked; those areas still rely on lint/build and manual flows.

### Current audit status

The canonical documentation audit was static and did not run builds, servers, training, databases, or tests because the task prohibited operations that could create artifacts. Do not infer a passing state from this document. Historical phase/root documents report older run counts and are not current verification evidence.

## 2. Prerequisites

- Node.js 18+ and npm.
- Python 3.11 recommended and dependencies from `ml-service/requirements.txt`.
- MongoDB local/Compose or an isolated Atlas database.
- Environment files created from each `.env.example`; never commit real values.
- For full prediction tests, a trained model artifact and running ML service.

Use a disposable database for seed/admin/delete tests. `npm run seed` deletes users and listings.

## 3. Safe verification commands

Run from each service directory:

```bash
# backend-api
npm test

# ml-service (lightweight verification)
python -m unittest discover -s verify -p "test_*.py"

# frontend
npm run lint
npm run build
```

Training/inference smoke setup:

```bash
cd ml-service
python src/train.py --dataset bengaluru
python -m uvicorn app.main:app --app-dir app --port 8001
```

API setup, with MongoDB and ML already available:

```bash
cd backend-api
npm run seed
npm start
```

Frontend setup:

```bash
cd frontend
npm run dev
```

Builds, lint, training, installs, and framework commands can create caches/artifacts. Run them only when repository/task constraints allow it, then inspect `git status --short`.

## 4. API smoke matrix

### Service and auth

- `GET :8000/health` returns success and a request ID/header behavior as expected.
- `GET :8001/health` distinguishes `model_loaded` from process health.
- Signup rejects invalid email/short password and duplicate email.
- Login rejects wrong credentials and disabled account.
- Access token reaches `/api/auth/me`; refresh token rotates once and old token is rejected.
- Password change rejects wrong current password and invalidates prior refresh sessions.
- Logout succeeds locally even if server revocation call fails.

### Role boundaries

Test with `user`, `agent`, `broker`, and `admin` accounts:

- Customer roles cannot call any admin endpoint even by direct HTTP request.
- Admin can perform listing/user/inquiry actions.
- A stale access-token role is superseded by the database role.
- Disabled account access is denied.
- Last active admin cannot be demoted, disabled, or deleted.
- Agent and broker accounts can authenticate but must be denied protected user/admin panel APIs until dedicated permissions are defined.

### Listings and CSV

- Filters combine correctly, regex text is escaped, and pagination caps at 100.
- Create/update recalculates `pricePerSqft`.
- Detail/not-found/invalid-ID behavior is consistent.
- CSV rejects wrong media type, empty/malformed/over-1000 rows and invalid enums/numbers; valid import uses defaults and semicolon image parsing.
- Delete implications for favorites/inquiries are inspected because no database cascade exists.

### Prediction and analytics

- Valid prediction traverses Express → FastAPI and is stored with/without user as appropriate.
- Invalid ML input maps to API 400; unavailable ML to 502; timeout to 504.
- Options work when ML is online and locality fallback works when it is offline.
- History is owner-filtered and limited to 50.
- Public share ID returns the intended stored result and 404 for missing ID.
- Compare requires 2–3 IDs and degrades individual ML failure to unknown.
- Deal boundary cases exactly at/around ±7% are verified.
- Trend month/locality filters and ranking minimum-three rule are verified against known fixtures.

### User activity

- Favorites add idempotently and remove cleanly.
- Saved search is owner-scoped; count delta cannot go negative; mark-seen updates the baseline.
- Inquiry validates listing/message, user sees only own records, and admin status accepts only three states.

## 5. Frontend manual matrix

Verify at small phone, tablet, and desktop widths in both themes:

1. Landing links and marketing claims match available features.
2. Navbar variants for visitor/customer/admin and logged-out state.
3. Prediction step validation, locality loading/failure, result recovery, share, PDF, and similar listings.
4. Listing filter debounce/reset/pagination, favorite state, saved-search creation, comparison selection, and detail calculators/inquiry.
5. Dashboard profile/password/delete and prediction history.
6. Notification badge polling, saved counts/mark-seen, inquiry status display.
7. Admin listing create/edit/delete/import, user roles/status, inquiry status, stats, and ML offline/online states.
8. Keyboard traversal, visible focus, labels, error announcements, contrast, zoom, chart text meaning, and no color-only status.

Known expected failure/gap: there is no mobile navigation menu even though desktop nav hides below `md`.

## 6. Data and ML verification

- Confirm raw Bengaluru CSV has expected schema before training.
- Confirm cleaning handles sqft ranges/units, BHK extraction, missing values, locality grouping, bathroom and sqft/BHK filters, and outliers.
- Prevent train/test leakage: transformations and model selection must be fit/evaluated appropriately.
- Reproduce metrics from a clean environment and record dependency versions, dataset checksum, random seed, split, training mode, model identity, and timestamp.
- Validate confidence interval coverage, not only point metrics.
- Test unknown/`other` locality and numeric boundary behavior through the deployed predictor.
- Compare the runtime `/model-info` with checked-in metadata. Currently checked-in evidence is the numpy sandbox reference and may differ from a container-trained model.

## 7. Missing automated coverage priorities

Add the smallest useful checks in this order:

1. Real API integration tests with isolated MongoDB for auth rotation/roles/ownership/admin protection.
2. Contract test between Express prediction adapter and FastAPI schemas.
3. Frontend end-to-end tests for login role redirect, prediction, saved search, and admin boundary.
4. CSV import and deletion integrity tests against MongoDB.
5. Accessibility checks for navigation/forms/dialogs and a mobile navigation regression.
6. Reproducible ML training/evaluation job with artifact/metric comparison.

## 8. Release gate

- Relevant automated commands passed in the current commit and their output is recorded.
- Cross-service smoke paths passed with configured dependencies.
- No secrets, local databases, caches, build outputs, or unintended model binaries are staged.
- `git diff --check` is clean and `git status --short` contains only intended files.
- Contract/schema/role/model behavior changes update the corresponding canonical documentation.
- Known failures are reported explicitly; never describe an unexecuted test as passing.

## 9. Proxy and readiness verification

The Commit 1 proxy foundation covers same-origin `/api/*` path mapping, exact query preservation, HTTP method/body preservation, application-header filtering, Cookie and CSRF-header forwarding, bounded request-ID validation, timeout-to-`504`, upstream-failure-to-`502`, relative-redirect safety, private/no-store caching, and absence of token exposure. Commit `877d06cae666eefac6a7fd62b1662b93ca318d56` (`fix: preserve proxy cookies on upstream errors`) adds regression coverage for sanitized `Set-Cookie` preservation on successful, `4xx`, and `5xx` responses plus unsafe-attribute filtering.

The Commit 2 readiness checks cover:

- connected → `200 { "status": "ready" }`
- connecting → `503 { "status": "not_ready" }`
- disconnecting → `503 { "status": "not_ready" }`
- disconnected → `503 { "status": "not_ready" }`
- uninitialized → `503 { "status": "not_ready" }`

Verified local commands and results:

```text
frontend: npm run lint                 PASS
frontend: npx tsc --noEmit             PASS
frontend: npm run build                PASS
backend-api: node --test src/test/app.test.js   5 passed
backend-api: npm test                  106 passed
frontend: npm run test:e2e              4 passed
```

Local verification includes the complete four-test Playwright suite, proxy regression
coverage, and deterministic teardown across two consecutive runs. The supplied v1.0.0
release verification also records successful GitHub Actions, provider/deployment, and
production browser checks; those are supplied release evidence and were not independently
rerun during this documentation change.
