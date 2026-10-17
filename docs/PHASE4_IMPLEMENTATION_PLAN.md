# Phase 4 User Portal Audit and Implementation Plan

## 1. Executive Summary

Audit status: COMPLETE (read-only). The User Portal is a functional early-production portal, not an empty shell: visitors can browse, compare, map, inspect trends, and request valuations; authenticated `user` and `admin` accounts can retain predictions, favorite listings, save searches, review derived alerts, and submit inquiries. Admins inherit these capabilities and use a separate operational workspace.

The main Phase 4 opportunity is product quality around the existing flows: a clearer dashboard journey, complete account UX, bounded favorite retrieval, transparent derived-notification behavior, consistent loading/error/empty states, mobile navigation, accessibility polish, and repeatable frontend/regression coverage. No P0 or P1 User Portal issue was confirmed from this source audit. The plan deliberately keeps the browser → Express → MongoDB/FastAPI boundary and does not add a queue, cache, new service, or new notification provider without measured need.

Phase 1 security, Phase 2 hardening, and Phase 3 reliability work are treated as invariants. This document is a plan only; no application behavior is changed by this audit.

## 2. Current User Portal State

| Capability | Current implementation | Maturity / observation |
|---|---|---|
| Authentication and session | Signup, login, `/auth/me`, logout, password change, deletion; `AuthProvider` resolves cookie-backed sessions and the API client uses credentials/CSRF handling. | Core flow exists. There is no dedicated session/security-settings page. |
| Dashboard/account | `/dashboard` shows latest 50 predictions, profile edit, password change, and account deletion. | Useful but combines activity and account-danger actions; no summary cards for favorites, saved searches, or inquiries. |
| Prediction | Three-step form; results page reads the current result from `sessionStorage`, requests feature importance and similar listings, and offers PDF/share/EMI. | Functional. Results are intentionally session-scoped unless a public share is created. Recovery for a missing session is present. |
| Prediction history/share | History is owner-filtered and bounded. New shares use high-entropy expiring tokens; owner/admin can issue or revoke a share; legacy ObjectId links have a grace period. | Security contract is established; user UI does not yet expose a history-item share/revoke management flow. |
| Listings/discovery | Debounced search/filter/sort, bounded pagination, locality options, cards, detail pages, approximate map/heatmap, trends, and recent views. | Core discovery is strong. Local filter state is not fully represented in the URL, and mobile navigation is absent below `md`. |
| Listing detail | Specs, image, deal estimate, locality trend, EMI, ROI scenario, recent views, and authenticated inquiry. | Broad feature coverage; independent trend/deal calls can leave partial sections unavailable. |
| Compare | Search and select two or three listings, then call `/api/compare`; individual ML failure degrades to an `unknown` verdict. | Functional and bounded. The comparison table relies on horizontal overflow on small screens; compare-share UX is not exposed. |
| Favorites | Add/remove and favorite-ID context; `/favorites` renders populated listings. | Owner-scoped and simple. `GET /api/favorites` currently populates the complete favorite array without pagination or a server-side quota. |
| Saved searches | Quota-limited create/delete, one aggregate facet for match counts, new-match delta, and mark-seen. | Correctly documented as read-time polling, not delivery. No edit/duplicate operation or durable notification entity exists. |
| Notifications | Navbar badge polls saved-searches every 60 seconds; `/notifications` combines new saved-search deltas and inquiry statuses. | Useful derived view, not a durable read/unread notification center. |
| Inquiries | Authenticated users create and page their own inquiries; admins view a bounded queue and set `new/contacted/closed`. | Contract and ownership are clear; user-facing detail/status presentation is minimal. |
| Calculators/reports | Client-side EMI, ROI scenario, and PDF valuation report. | Existing informational behavior must remain unchanged; outputs are not lending or investment advice. |
| Admin relationship | `/admin` is a distinct operational route; server-side role checks protect mutations. Admin navigation also exposes user features. | Separation is correct: shared design tokens and API, distinct information density and permissions. |

## 3. Architecture Findings

1. The current service boundary is appropriate and should remain: browser → Express API → MongoDB/FastAPI. Frontend guards are navigation aids; Express remains the authorization boundary.
2. `frontend/src/lib/api.ts` is the correct shared client and already centralizes timeouts, safe response parsing, credentials, CSRF, and one refresh/retry path. New portal work should reuse it rather than add page-local fetch wrappers.
3. Most pages fetch their own data. This is acceptable at current scale, but dashboard/navbar/notification views can make repeated saved-search requests. Measure before introducing an aggregate endpoint or cache.
4. Mongoose models and existing indexes are the schema source of truth. There is no migration framework. Prefer API/query changes and additive fields; any incompatible schema change requires a separately approved migration and rollback plan.
5. The existing role model is intentionally small: `user` and `admin` have protected portal access; `agent` and `broker` authenticate but have no protected panel. Phase 4 must not silently grant them capabilities.

## 4. UX Findings

### Current journey

`signup/login → dashboard → browse/filter → listing detail → predict/results → history/share → favorite/save/compare → notification/inquiry → logout/account management` is represented in the current routes and API contracts.

### Findings

| ID | Finding | Classification | Priority |
|---|---|---|---|
| UX-01 | Dashboard is primarily a prediction-history list plus profile/password/danger-zone forms; it does not summarize the other user activities. | POTENTIAL product/UX gap | P2 |
| UX-02 | Saved searches and notifications use derived match deltas. The UI explains this, but users do not have durable notification read state or a unified action history. | CONFIRMED current limitation, not a security defect | P2 |
| UX-03 | The listing/detail/predict flows have skeletons and error states, but independently loaded sections can finish in different states. | POTENTIAL consistency gap | P2 |
| UX-04 | Results sharing is available from the latest session result; history does not provide a visible share/revoke management affordance. | CONFIRMED capability gap | P2 |
| UX-05 | Empty states generally provide a next action. Profile, password, and account deletion are all in one dashboard, so task grouping could be clearer. | POTENTIAL information-architecture gap | P3 |

## 5. Security Findings

No new P0/P1 vulnerability was identified in the User Portal audit. The following security properties must be preserved:

- Browser auth uses HttpOnly cookies, CSRF protection for state-changing requests, and no persistent auth tokens in localStorage. In-memory bearer compatibility is for non-browser clients.
- Refresh tokens are hashed/rotated with reuse detection; logout, password, role, and status changes invalidate sessions through token-version checks.
- Express enforces role and ownership checks for history, favorites, saved searches, inquiries, and admin routes. Direct frontend navigation is not treated as authorization.
- Prediction shares use high-entropy hashes, expiry, revocation, and a time-limited legacy ObjectId grace path. ObjectIds are not new credentials.
- Anonymous prediction retention, compare non-persistence, saved-search quotas, and request limits remain server-side controls.

Phase 4 security work is therefore UX/verification work: expose only the existing safe share endpoints, avoid copying tokens into durable browser storage, preserve ownership checks in every new caller, and make privacy/retention behavior understandable. Any new endpoint requires the same Express validator/auth/role pattern and regression tests.

## 6. Reliability Findings

Phase 3 provides request IDs, safe API parsing/timeouts, generic production errors, `/health` and `/ready`, structured logging, ML error sanitization, and a frontend root error boundary. Remaining portal reliability work is mostly state handling:

- Some pages intentionally collapse request failures to empty arrays (`favorites`, `saved`, `notifications`, parts of trends/detail), which can make an outage look like “no data.” Add recoverable inline states where user action is meaningful.
- The notification badge and notification page independently load saved searches; a single user navigation can issue multiple reads. Measure and consolidate only if the cost is demonstrated.
- Detail pages load listing, trend, and deal data independently. The base listing should remain usable when ML/trend reads fail, but the UI should label the unavailable section rather than silently omit it.
- There is no frontend automated suite or real MongoDB integration suite, so cross-layer regressions are not currently caught automatically.

## 7. Performance Findings

Confirmed bounded paths include listing pagination (maximum 100), history (50), inquiries (100 per user page/200 admin queue), CSV import (1,000), saved-search quota and one `$facet` count aggregation, and compare selection (2–3).

The main measured-risk candidates are:

1. `backend-api/src/controllers/favorites.controller.js` populates the entire user favorite array for every `/api/favorites` request. A large account can create response and query growth. This is a P2 hardening candidate; first measure actual favorite cardinality and choose pagination or a bounded quota.
2. `frontend/src/components/map/map-view.tsx` requests up to 400 listings and renders markers/heatmap client-side. Keep the existing cap, measure mobile rendering, and avoid increasing it.
3. `backend-api/src/controllers/predict.controller.js` has a database locality fallback using `distinct`; keep it bounded or replace it with an indexed/curated options source only if production data size justifies the change.
4. Navbar polling plus the notifications page can duplicate saved-search reads. Do not add a client cache or new infrastructure until profiling demonstrates a problem.

## 8. Accessibility Findings

The source has semantic headings, native forms, labels in most form sections, keyboard-operable buttons/links, text badges for statuses, and image alt text on listing detail. The following are unverified or known gaps:

- The mobile navbar is hidden below `md` with no keyboard-accessible replacement. This is a confirmed responsive/accessibility gap.
- Icon-only actions such as favorite/remove and saved-search delete need an explicit accessible-name review at runtime; treat any missing name as P1 within the accessibility slice, otherwise P3 polish.
- Comparison tables, charts, and map content need a keyboard/200% zoom review and adjacent text summaries for critical values.
- Focus management for transient search results, toasts, and any future modal must be verified. Do not add a dialog library solely for this audit.
- Reduced-motion behavior is not explicitly implemented; add it only where existing motion affects comprehension or vestibular comfort.

## 9. Mobile Findings

The page grids generally collapse and tables use horizontal overflow, but the primary navigation disappears below the `md` breakpoint. Compare tables, trend charts, maps, and admin-style dense content need phone-width verification for reachable actions, readable labels, and non-clipped controls. A mobile menu is a focused Phase 4 change; it must share existing tokens and links and must not expose admin links to non-admin users.

## 10. API Contract Findings

| Contract area | Current route(s) | Current guarantees | Phase 4 implication |
|---|---|---|---|
| Session/account | `/api/auth/signup`, `/login`, `/refresh`, `/me`, `/password`, `/logout` | Cookie/session security, role/status checks, sanitized user payload | Reuse unchanged; add UI only unless a measured contract gap is found. |
| Listings | `/api/listings`, `/api/listings/:id`, `/api/listings/:id/deal`, `/meta/localities` | Public, validated filters, pagination capped at 100 | Preserve query names; consider URL-synchronised filters without changing server semantics. |
| Prediction | `/api/predict`, `/options`, `/feature-importance`, `/history`, `/:shareToken` | Optional auth submission, bounded history, sanitized ML errors, secure public share | Results/history UI must use existing contracts and never invent an ObjectId share URL. |
| Compare | `/api/compare` | Public, 2–3 IDs, per-item ML degradation | Preserve unknown verdict behavior and rate limits. |
| Favorites | `/api/favorites`, `/ids`, `/:id` | Authenticated owner scope, idempotent add/remove | Candidate for bounded list/pagination; any response-shape change must update types/docs/tests together. |
| Saved searches | `/api/saved-searches`, `/:id/mark-notified` | Owner scope, quota, facet match counts, read-time alerts | Keep polling semantics explicit; edit/duplicate is not currently a contract. |
| Inquiries | `/api/inquiries`, `/admin`, `/admin/:id` | User pagination/ownership, admin status workflow | Improve user status/detail presentation without broadening admin access. |
| Notifications | No dedicated API | Frontend derives saved-search deltas and inquiry statuses | Do not imply push/email/SMS or durable unread state without a separate approved product/API design. |

There is no Express OpenAPI document or generated client. `docs/API.md`, validators, route definitions, and `frontend/src/lib/api.ts` are the current manual contract sources.

## 11. Test Coverage Findings

- Backend uses Node's built-in test runner. Current tracked tests cover schemas, pure helpers, query construction, CSV normalization, app boundaries, trends, security, and ML reliability, but do not prove every MongoDB CRUD/rotation path against a real database.
- ML verification uses standard-library unittest, but the current environment may lack `numpy`/FastAPI dependencies; those checks must be reported BLOCKED if unavailable, not worked around by installing random packages.
- Frontend has no tracked unit, component, accessibility, visual, or end-to-end suite. `npm run lint` and `npm run build` are the current static gates plus manual journeys.
- Phase 4 should add the smallest useful regression coverage around the changes, prioritising API ownership/contract tests and a frontend smoke/E2E strategy only after selecting an approved existing test tool.

## 12. P0/P1/P2/P3 Classification

| Priority | ID | Finding | Evidence | Closure impact |
|---|---|---|---|---|
| P0 | — | No confirmed User Portal P0 finding. | Current routes, middleware, contracts, and Phase 1–3 invariants reviewed. | None. |
| P1 | — | No confirmed User Portal P1 finding. Missing mobile navigation becomes P1 only if release acceptance requires mobile access for all users. | `docs/UI-UX.md` documents the gap; no evidence of an authorization/data-loss defect. | None currently. |
| P2 | P2-01 | Dashboard/account lacks a cohesive activity overview and visible history share/revoke workflow. | `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/results/page.tsx`, `frontend/src/lib/api.ts`. | Improves retention and supportability without changing security. |
| P2 | P2-02 | Notification center is a derived polling view with no durable read/unread entity. | `frontend/src/app/notifications/page.tsx`, `frontend/src/components/layout/navbar.tsx`, `backend-api/src/controllers/savedSearch.controller.js`. | Product limitation; do not solve with unapproved infrastructure. |
| P2 | P2-03 | Favorites list is unbounded at the API response/query level. | `backend-api/src/controllers/favorites.controller.js`, `backend-api/src/routes/favorites.routes.js`. | Performance/privacy hardening; requires contract decision and regression tests. |
| P2 | P2-04 | No automated frontend journey or real database integration coverage. | `docs/TESTING.md`, `frontend/package.json`, `backend-api/package.json`. | Increases regression risk for every portal change. |
| P2 | P2-05 | Independent discovery/detail requests can show silent empty sections on failure. | `frontend/src/app/listings/[id]/page.tsx`, `frontend/src/app/trends/page.tsx`, favorites/saved/notification pages. | Reliability/feedback improvement; retain graceful degradation. |
| P3 | P3-01 | Mobile navigation is absent below `md`. | `frontend/src/components/layout/navbar.tsx`, `docs/UI-UX.md`. | Upgrade to P1 only if mobile is a release-blocking requirement. |
| P3 | P3-02 | Accessibility runtime review is not recorded for icon names, focus, charts, map, zoom, and reduced motion. | `docs/UI-UX.md`; component source review. | Address before calling the portal WCAG-conformant. |
| P3 | P3-03 | Locality fallback and map listing volume need ongoing bounds/measurement. | `backend-api/src/controllers/predict.controller.js`, `frontend/src/components/map/map-view.tsx`. | Hardening only; no speculative redesign. |

## 13. MUST / SHOULD / NICE TO HAVE

### MUST

- Preserve all Phase 1–3 security/reliability invariants and existing API semantics.
- Add a clear, responsive, keyboard-accessible mobile navigation with role-aware links.
- Improve account/dashboard task grouping and explicit loading/error/empty/recovery states.
- Decide and implement a bounded/paginated favorite retrieval contract if measurement confirms the current unbounded path is material.
- Keep saved-search alert semantics visibly described as read-time polling; do not market it as delivery.
- Add focused backend ownership/contract regression tests for any changed endpoint and a repeatable frontend smoke matrix.

### SHOULD

- Add history share/revoke controls using the existing owner/admin endpoints and secure token response.
- Add saved-search edit/duplicate only if product needs it; otherwise keep the current minimal CRUD.
- Preserve listing filter state in URL parameters for reload/shareability.
- Improve inquiry status/detail presentation and partial-failure messaging.
- Measure dashboard/navbar request counts and mobile map/table rendering before optimising.

### NICE TO HAVE

- Richer dashboard summaries and charts.
- Accessible textual summaries for every chart/map view.
- A selected frontend E2E/accessibility tool, if the team accepts its maintenance cost.

Email/SMS/push delivery, real-time chat, recommendation feeds, subscriptions, agent/broker workspaces, predictive forecasts/risk, CMS, and a durable notification service are not Phase 4 necessities and remain out of scope.

## 14. Recommended Implementation Slices

| Slice | Objective and likely files/modules | API/DB impact | Validation / acceptance |
|---|---|---|---|
| 1. Portal baseline and navigation | `frontend/src/components/layout/navbar.tsx`, `frontend/src/app/dashboard/page.tsx`, shared UI primitives, `frontend/src/lib/api.ts` only where existing contracts are reused. Add mobile menu, dashboard quick actions/summary composition, consistent loading/error/empty states. | Prefer none. Add no new service or state store. | Visitor/user/admin links are role-correct at desktop and phone widths; no protected content flashes; dashboard recovery states are actionable. |
| 2. Account and activity UX | `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/results/page.tsx`, optional focused history/share UI components. | Reuse `/auth/*`, `/predict/history`, share/revoke. No schema change. | Profile/password/delete/logout remain secure; a user can understand history and issue/revoke a share without storing credentials or exposing ObjectIds. |
| 3. Favorites and saved searches | `frontend/src/app/favorites/page.tsx`, `frontend/src/app/saved/page.tsx`, listing cards/buttons, `backend-api/src/controllers/favorites.controller.js` only if bounds are approved, `docs/API.md`/types/tests. | Prefer API pagination or a bounded response. No new collection. A quota may be configuration or an additive validation decision. | Owner isolation, idempotent add/remove, quota/error states, and no unbounded favorite response under the chosen contract. |
| 4. Inquiries and derived alerts | `frontend/src/app/notifications/page.tsx`, saved/inquiry pages and types. | Reuse existing endpoints; no durable notification schema unless separately approved. | Saved-search deltas and inquiry status are clearly labeled, mark-seen works, failures are recoverable, and no claim of push/email delivery is made. |
| 5. Discovery, compare, and shared results | listings browser/detail, compare tool, results/shared pages, URL/query helpers. | Preserve existing listing/compare/share contracts. | Filters reload/share correctly, compare remains 2–3 items, ML failure leaves listing comparison usable, secure share links remain the only new public link mechanism. |
| 6. Accessibility and mobile polish | Shared buttons/labels/table/map/chart wrappers and affected pages. | None. | Keyboard navigation, visible focus, accessible names, 200% zoom, phone widths, reduced-motion review, and non-color-only statuses pass manual checks. |
| 7. Regression and release verification | `backend-api/src/test/*`, documentation, manual verification matrix. | None. | Backend tests/lint/build and available ML checks are recorded; changed contracts have tests; Phase 1–3 invariants remain green; diff contains only approved slices. |

## 15. Dependencies Between Slices

Slice 1 precedes all other portal UX work because navigation and shared states are common surfaces. Slice 2 depends on the existing auth/API contract but does not require new backend behavior. Slice 3 depends on a decision about favorite bounds; Slice 4 depends on retaining saved-search delta semantics. Slice 5 can proceed independently after URL state conventions are agreed, but share controls must use the existing secure endpoints. Slice 6 should follow the affected UI changes so the accessibility pass tests final markup. Slice 7 runs continuously and is the release gate.

## 16. Validation Strategy

- Run `backend-api` `npm test` and add focused Node tests for every changed ownership, pagination, or response contract.
- Run `frontend` `npm run lint` and `npm run build`; manually exercise visitor, user, and admin journeys at phone/tablet/desktop widths in both themes.
- Run ML unittest discovery only when dependencies are already available; report missing `numpy`/FastAPI as BLOCKED.
- Verify API response shapes against `docs/API.md`, validators, and `frontend/src/lib/types.ts`.
- Test direct HTTP authorization for user/admin boundaries; do not rely on frontend guards.
- Run `git diff --check` and inspect `git status --short`; preserve pre-existing Phase 1–3 changes and avoid generated artifacts/secrets.

## 17. Regression Protection for Phase 1/2/3

Every Phase 4 slice must retain: HttpOnly/Secure/SameSite browser cookies and CSRF on state changes; hashed refresh tokens, atomic rotation, reuse detection, and token-version invalidation; production JWT/CORS/trusted-proxy fail-closed behavior; server-side RBAC/ownership and last-admin protection; authenticated Express→FastAPI calls, redirect rejection, sanitized ML errors, and private ML deployment assumptions; request IDs, bounded timeouts, `/health`/`/ready`, structured logs, generic production errors, and the root error boundary; anonymous prediction retention and compare non-persistence; high-entropy expiring/revocable shares with legacy grace only; saved-search quotas and bounded aggregates; and the existing API error shapes.

## 18. Explicit Out-of-Scope Items

Do not implement Phase 5 admin redesign, ML model retraining/governance changes, Redis/Kafka/queues/Kubernetes/WebSockets/SSE, email/SMS/push providers, real-time chat, payments/subscriptions, a migration framework, provider-side deployment changes, backup/restore UI, CMS, agent/broker workspaces, recommendation feeds, risk/forecast products, or new listing media/document management. Do not change role semantics, model metrics, retention policy, or seed behavior as incidental portal work.

## 19. Definition of Done

Phase 4 is complete when all MUST items have approved acceptance tests; user/admin/public journeys work at required breakpoints; mobile navigation is keyboard accessible; dashboard/account, favorites/saved/alerts/inquiries, discovery/compare/share, and graceful failure states are coherent; every changed API contract is documented and ownership-tested; backend and frontend gates pass; unavailable ML/Mongo/provider checks are explicitly reported; no Phase 1–3 invariant regresses; no P0/P1 remains; and the worktree contains only the approved changes with no secrets or generated artifacts.

## 20. Final Recommendation

Approve Phase 4 planning and begin with Slice 1 only after this plan is reviewed. Keep the first implementation slice small: role-aware mobile navigation, dashboard information architecture, and shared loading/error/empty states. Defer infrastructure and new notification capabilities until measurement and product approval justify them.

## Audit Evidence and Inspected Files

Repository baseline inspected read-only: commit `657d2436419531d4b877a62adb74bfd7d1e53df4`, branch `main`, with pre-existing Phase 1–3 working-tree changes preserved. Canonical documents inspected:

- `docs/PRD.md`
- `docs/TRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/UI-UX.md`
- `docs/TESTING.md`

Frontend routes/components and shared code inspected:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/favorites/page.tsx`
- `frontend/src/app/saved/page.tsx`
- `frontend/src/app/notifications/page.tsx`
- `frontend/src/app/compare/page.tsx`
- `frontend/src/app/listings/page.tsx`
- `frontend/src/app/listings/[id]/page.tsx`
- `frontend/src/app/predict/page.tsx`
- `frontend/src/app/results/page.tsx`
- `frontend/src/app/r/[id]/page.tsx`
- `frontend/src/app/map/page.tsx`
- `frontend/src/app/trends/page.tsx`
- `frontend/src/components/compare/compare-tool.tsx`
- `frontend/src/components/listings/listings-browser.tsx`
- `frontend/src/components/listings/favorite-button.tsx`
- `frontend/src/components/listings/save-search-button.tsx`
- `frontend/src/components/map/map-view.tsx`
- `frontend/src/components/layout/navbar.tsx`
- `frontend/src/components/protected-route.tsx`
- `frontend/src/components/providers.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth-context.tsx`
- `frontend/src/lib/favorites-context.tsx`
- `frontend/src/lib/recently-viewed.ts`
- `frontend/src/lib/types.ts`

Backend routes/controllers/tests inspected:

- `backend-api/src/routes/index.js`
- `backend-api/src/routes/auth.routes.js`
- `backend-api/src/routes/listing.routes.js`
- `backend-api/src/routes/predict.routes.js`
- `backend-api/src/routes/compare.routes.js`
- `backend-api/src/routes/favorites.routes.js`
- `backend-api/src/routes/savedSearch.routes.js`
- `backend-api/src/routes/inquiry.routes.js`
- `backend-api/src/routes/trends.routes.js`
- `backend-api/src/controllers/auth.controller.js`
- `backend-api/src/controllers/favorites.controller.js`
- `backend-api/src/controllers/savedSearch.controller.js`
- `backend-api/src/controllers/inquiry.controller.js`
- `backend-api/src/controllers/predict.controller.js`
- `backend-api/src/controllers/compare.controller.js`
- `backend-api/src/middleware/auth.js`
- `backend-api/src/middleware/csrf.js`
- `backend-api/src/middleware/rateLimiters.js`
- `backend-api/src/models/User.js`
- `backend-api/src/models/Prediction.js`
- `backend-api/src/models/SavedSearch.js`
- `backend-api/src/models/Inquiry.js`
- `backend-api/src/models/SecurityEvent.js`
- `backend-api/src/test/*`

ML/deployment/configuration inspected:

- `ml-service/app/main.py`
- `ml-service/app/security.py`
- `ml-service/app/schemas.py`
- `backend-api/src/services/ml.service.js`
- `docker-compose.yml`
- `render.yaml`
- `frontend/package.json`
- `backend-api/package.json`
- `ml-service/requirements.txt`

Checks performed: read-only source and documentation inspection; route/component/API inventory; worktree status, branch, and recent commit inspection. No application files, database records, provider settings, dependencies, or Git history were modified. No Phase 4 implementation was started.
