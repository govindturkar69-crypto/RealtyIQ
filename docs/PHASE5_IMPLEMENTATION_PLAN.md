# Phase 5 — Admin Control Center Implementation Plan

Audit date: 2026-09-07  
Audited branch: `main`  
Audited commit: `657d2436419531d4b877a62adb74bfd7d1e53df4`  
Audit mode: read-only; no application, test, configuration, database, Git, or deployment changes were made.

## 1. Executive Summary

The existing Admin Control Center is a real, server-protected operational page rather than a placeholder. It currently combines:

- dashboard totals and top predicted localities;
- ML health/model metadata;
- listing creation, editing, CSV import, and hard deletion;
- a first page of users with role/status controls; and
- a bounded but non-paginated inquiry queue with status updates.

The browser route is separate from the User Portal and the backend enforces admin authorization independently of the frontend guard. Existing Phase 1–4 security boundaries are generally intact.

Phase 5 should therefore be an incremental Admin Control Center hardening and completion effort, not a new platform architecture. The first work must make high-impact admin mutations auditable and concurrency-safe, then expose bounded management workflows, then improve operations visibility and accessibility.

### Findings summary

| ID | Severity | Classification | Finding | Evidence |
|---|---|---|---|---|
| ADM-01 | P1 | Confirmed design risk | Last-active-admin protection is a count-then-save sequence and is not atomic under concurrent role/status changes. | `backend-api/src/controllers/auth.controller.js` `manageUser` counts active admins before saving. |
| ADM-02 | P1 | Confirmed control gap | Administrative listing and inquiry mutations do not record `SecurityEvent` entries. | `listing.controller.js` and `inquiry.controller.js` mutations never call `recordSecurityEvent`. |
| ADM-03 | P2 | Confirmed operational gap | Admin inquiry queue is capped at 200 but has no page, filter, search, or date bounds. | `allInquiries` uses `.limit(200)` only; `adminInquiries` has no query parameters. |
| ADM-04 | P2 | Confirmed operational gap | Security-event retrieval is capped but not paginated or filterable, and there is no admin UI for it. | `listSecurityEvents` uses one `limit` query; `/admin` never calls the endpoint. |
| ADM-05 | P2 | Confirmed data-integrity risk | Listing deletion is a hard delete with no server-side audit event, soft-delete policy, or dependency handling. | `deleteListing` calls `findByIdAndDelete`; `DATABASE.md` documents dangling favorites/inquiries. |
| ADM-06 | P2 | Confirmed validation gap | Admin mutation IDs are not explicitly validated as ObjectIds before Mongoose lookup/update. | `manageUser`, `updateInquiry`, `updateListing`, and `deleteListing` accept `:id` directly. |
| ADM-07 | P2 | Confirmed performance gap | User listing sorts by `createdAt` but the schema has no explicit compound `{ createdAt: -1, _id: -1 }` index. | `User.js` has email index only; `listUsers` sorts by createdAt and _id. |
| ADM-08 | P3 | Confirmed UX/accessibility gap | `/admin` is a large monolithic page with limited retry, pagination, confirmation, table semantics, and action labelling. | `frontend/src/app/admin/page.tsx`. |
| ADM-09 | P3 | Confirmed visibility gap | Admin stats expose only listings, predictions, users, top predicted localities, and ML status. | `adminStats` and `mlStatus` are the only admin dashboard data sources. |
| ADM-10 | P3 | Confirmed audit-model gap | `SecurityEvent.user` is ambiguous for admin actions; the actor is not persisted separately from the target. | `recordSecurityEvent` receives a target user for management events and stores it as `user`. |

No P0 issue was found. No confirmed RBAC bypass, IDOR, token exposure, or user-to-admin escalation was found in the inspected code. Phase 5 must preserve the existing browser → Express → MongoDB/FastAPI boundary.

## 2. Current Admin Architecture

```text
frontend/src/app/admin/page.tsx
  -> frontend/src/lib/api.ts
  -> backend-api/src/routes/*.routes.js
  -> authenticate + requireRole("admin")
  -> backend-api/src/controllers/*.controller.js
  -> Mongoose models and bounded query helpers
  -> MongoDB

Admin ML status:
  /api/trends/admin/ml-status
    -> Express ML client
    -> authenticated FastAPI /health and /model-info
```

### Authorization boundary

- `ProtectedRoute` is a navigation aid only.
- Express `authenticate` verifies the access token, reloads the account role and token version, and rejects disabled/revoked accounts.
- Admin routes use `requireRole("admin")` server-side.
- User-scoped resources remain filtered by `req.user.sub`; admin access to `/api/predict/history` is still the current admin account's history, not an unrestricted prediction export.
- Global CSRF middleware protects cookie-authenticated state-changing requests.

### Current admin files

- Frontend: `frontend/src/app/admin/page.tsx`, `frontend/src/components/protected-route.tsx`, `frontend/src/components/layout/navbar.tsx`, `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`.
- Routes: `backend-api/src/routes/auth.routes.js`, `inquiry.routes.js`, `listing.routes.js`, and `trends.routes.js`.
- Controllers: `auth.controller.js`, `inquiry.controller.js`, `listing.controller.js`, and `trends.controller.js`.
- Middleware: `middleware/auth.js`, `middleware/csrf.js`, `middleware/validate.js`, `middleware/rateLimiters.js`.
- Models: `User.js`, `Inquiry.js`, `Listing.js`, `Prediction.js`, `SecurityEvent.js`.
- Shared helpers: `lib/queryBuilder.js`, `utils/securityEvent.js`, `utils/logger.js`, `services/ml.service.js`.

## 3. Existing Admin Features

| Capability | Current implementation | Verified state | Gap |
|---|---|---|---|
| Dashboard totals | Listing, prediction, and user `countDocuments` | Verified in source | No active-user, inquiry, favorites, saved-search, or security-event metric |
| Top searched localities | Prediction aggregation grouped by locality, top 10 | Verified in source | No date range, stable secondary sort, or index-specific measurement |
| ML status | Authenticated ML `/health` and `/model-info` through Express | Verified in source | No API readiness/database status in admin UI |
| User management | Bounded first page, role and active-status mutation | Verified in source | No search/filter/detail/activity timeline; self-target and concurrency policy need tightening |
| Listing management | Create, patch, CSV import, hard delete | Verified in source | No moderation state, soft delete, audit event, pagination, or safe dependency workflow |
| Inquiry management | Admin reads up to 200, changes status | Verified in source | No pagination, filters, search, audit event, or detail workflow |
| Security events | Backend retrieval endpoint with TTL-backed model | Verified in source | No frontend center, cursor/page model, filters, actor/target model |
| Prediction administration | No admin-wide prediction search/export | Verified in source | Must be explicitly scoped before adding; do not expose share tokens |
| Health/readiness | Public `/health` and `/ready`; admin ML status | Verified in source | Admin-safe operational summary is absent |
| Audit trail | Auth, logout, password, bootstrap, refresh reuse, and user management events | Verified in source | Listing/inquiry mutations and many admin reads are not recorded |

## 4. Admin API Inventory

All rows below are derived from the current route files. “Global” rate limiting means the existing `/api` limiter; there is no admin-specific limiter.

| Endpoint | Method | Authentication | Admin RBAC | CSRF | Validation | Pagination/bounds | Rate limit | Audit event | Data exposed | Risk / recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| `/api/auth/admin/users` | GET | Required | Yes | N/A | None for query | Page/limit, max 100 | Global | No | name, email, role, active, createdAt | P2: add bounded search/filter and compound index |
| `/api/auth/admin/users/:id` | PATCH | Required | Yes | Required | `manageUserSchema` | ID not explicitly validated | Global | Yes | Updated user | P1/P2: atomic last-admin/self-target policy and ObjectId validation |
| `/api/auth/admin/security-events` | GET | Required | Yes | N/A | Numeric limit normalized | Max 200, no page/filter | Global | No | event, user, IP, user-agent, metadata | P2: paginate/filter, minimize sensitive fields, add UI |
| `/api/inquiries/admin` | GET | Required | Yes | N/A | None for query | Hard max 200 | Global | No | inquiry, user name/email, listing summary | P2: bounded page/filter/search/date contract |
| `/api/inquiries/admin/:id` | PATCH | Required | Yes | Required | `updateInquirySchema` | ID not explicitly validated | Global | No | Updated inquiry | P2: ObjectId validation, idempotence, audit event |
| `/api/listings` | POST | Required | Yes | Required | `createListingSchema` | Body capped by JSON middleware | Global | No | New listing | P2: audit event, duplicate-click protection |
| `/api/listings/:id` | PATCH | Required | Yes | Required | `updateListingSchema` | ID not explicitly validated | Global | No | Updated listing | P2: audit event, concurrency/version policy |
| `/api/listings/:id` | DELETE | Required | Yes | Required | None | ID not explicitly validated | Global | No | Success only | P1/P2: safe deletion standard, audit, dependency policy, preferably soft delete |
| `/api/listings/import` | POST | Required | Yes | Required | CSV rows validated; 5 MiB/1000 rows | Bounded | Global | No | Import count | P2: audit event, preview/idempotence and partial-failure policy |
| `/api/trends/admin/stats` | GET | Required | Yes | N/A | None | Fixed aggregation limit 10 | Global | No | totals and top localities | P3: explicit metric definitions and bounded date filters |
| `/api/trends/admin/ml-status` | GET | Required | Yes | N/A | None | ML client timeouts | Global | No | safe model/health metadata | P3: combine with safe readiness summary without secrets |
| `/api/predict/history` | GET | Required | User/admin | N/A | None | Current account's latest 50 | Global | No | Own predictions only | Preserve owner scope; do not turn into unrestricted admin export without approval |

### API controls that are already sound

- Admin authorization is enforced on the server, not only in the frontend.
- State-changing cookie requests pass global CSRF protection.
- Management fields are allowlisted by Zod schemas; arbitrary mass assignment is not accepted by the current schemas.
- Global body and CSV limits, bounded pagination helpers, stable ordering, and generic error handling are present.

## 5. Admin Frontend Inventory

| Page/component | Purpose | API dependency | Auth requirement | Current state | UX/accessibility gap | Performance/security risk | Phase 5 priority |
|---|---|---|---|---|---|---|---|
| `frontend/src/app/admin/page.tsx` | Combined control center | stats, ML status, users, listings, inquiries | Admin | Functional monolith | No section-level navigation, dense tables, partial retry, limited status announcements | Five independent initial requests; no cancellation or pagination UI | P1 |
| `ProtectedRoute` | Client route guard | `/api/auth/me` via auth context | Admin for `/admin` | Correct navigation aid | Protected content depends on loading state; server remains authority | No security risk when backend guards remain | P2 |
| `frontend/src/lib/api.ts` admin methods | API contract wrapper | All admin endpoints | Cookie/session | Existing methods are thin wrappers | No typed admin response models for several endpoints | No client-side request cancellation on admin loads | P2 |
| Admin stats cards/table | Totals and top localities | `/api/trends/admin/stats` | Admin | Data-backed | Metrics lack time range/definition labels | Aggregation scans/counts whole collections | P3 |
| ML status card | Model/operator status | `/api/trends/admin/ml-status` | Admin | Safe bounded metadata | No retry affordance or readiness distinction | Calls two ML endpoints per page load | P3 |
| Listings manager | CRUD/import/delete | `/api/listings*` | Admin | Functional | No pagination, delete pending state, or detailed confirmation | Hard delete and no audit event | P1 |
| Users table | Role/status changes | `/api/auth/admin/users*` | Admin | Functional first page | No search, page controls, confirmation, or activity detail | Concurrent admin mutation policy incomplete | P1 |
| Inquiry table | Status workflow | `/api/inquiries/admin*` | Admin | Functional bounded queue | No filters, pagination, detail, retry for initial load | Queue truncation after 200 | P2 |
| Security-event center | Intended audit visibility | `/api/auth/admin/security-events` | Admin | No page/component exists | Entire workflow missing | Sensitive metadata requires minimization | P1 |

The Admin Control Center is structurally separate from the User Portal. Phase 5 should keep separate navigation, layout density, permissions, and information architecture while reusing only primitives/tokens.

## 6. Security Audit

### Confirmed protections

- `authenticate` reloads the current role and `tokenVersion`; disabled accounts and revoked tokens are rejected.
- Admin routes consistently use `requireRole("admin")`.
- Cookie-authenticated mutations require CSRF proof.
- User-scoped reads filter by `req.user.sub`.
- `manageUserSchema` allowlists only `role` and `isActive`.
- Existing session invalidation increments `tokenVersion` on password, logout, and role/status changes.
- Security-event writes are best effort and do not break normal application requests.
- Errors are sanitized through the shared error handler and structured logger.

### Findings and required direction

1. **ADM-01 / P1 — Last-admin race and self-target policy.** The current count-then-save check prevents an obvious single-request removal of the last active admin, but concurrent requests can observe the same count and then both remove admin access. The implementation plan should use a transaction or an atomic guarded update where the deployment's MongoDB capability permits it, and should define whether an administrator may modify their own role/status. A safe default is to reject self-demotion/self-disable and require another active admin for any change to an admin account.
2. **ADM-02 / P1 — Incomplete administrative audit trail.** Listing create/update/delete/import and inquiry status changes do not call `recordSecurityEvent`. Phase 5 must record actor, target, action, outcome, request ID, and a redacted change summary without passwords, tokens, raw request bodies, or secrets.
3. **ADM-05 / P2 — Hard deletion.** Listing deletion can leave favorite IDs and inquiry references. Phase 5 must not silently expand deletion; it should establish a soft-delete or dependency-aware deletion policy, explicit confirmation, idempotent handling, audit event, and post-action verification before enabling broader destructive workflows.
4. **ADM-06 / P2 — Identifier validation.** Admin mutation routes should reject malformed IDs with 400 before Mongoose conversion. This is primarily error-safety and DoS hardening, not an observed authorization bypass.
5. **ADM-10 / P2 — Actor/target ambiguity.** Existing security events can identify the target user but not reliably the administrator who performed the action. Additive actor/target fields should be introduced only with a backward-compatible read strategy.

No evidence was found of a current privilege-escalation bypass, cross-user data access, token exposure, or CSRF bypass in the inspected admin routes.

## 7. Authorization/RBAC Audit

| Area | Current behavior | Assessment |
|---|---|---|
| Frontend admin route | `ProtectedRoute role="admin"` redirects non-admins | Navigation aid only; correctly backed by server checks |
| Admin API | `authenticate` + `requireRole("admin")` on admin endpoints | PASS |
| User/admin protected portal | `user` and `admin` allowed; agent/broker have no protected panel | Preserve contract |
| User resources | Predictions, favorites, saved searches, inquiries query by current user | PASS by source/tests |
| Admin user mutation | Admin can set allowlisted role/status for any target | Requires self-target and concurrency policy |
| Last-admin protection | Single-request count check | Insufficient under concurrent writes |
| Listing ownership | Listings are admin-managed shared resources | Requires audit/deletion policy, not user ownership |
| Prediction administration | No unrestricted admin prediction endpoint | Safer current default; preserve unless explicitly scoped |
| Security events | Admin-only retrieval | PASS authorization; improve privacy/pagination |

Phase 5 must not grant `agent` or `broker` new panel permissions implicitly and must not use frontend checks as authorization.

## 8. User Management Audit

Current user administration provides a bounded first page sorted by newest creation date and exposes name, email, role, active state, and creation time. It supports role and active-state mutations.

Missing or incomplete capabilities:

- no server-side search/filter/sort contract;
- no last-activity/session timeline;
- no user detail view;
- no confirmation or reason capture for role/status changes;
- no explicit self-target policy;
- no atomic last-admin invariant;
- no per-action result/audit history in the UI;
- no admin deletion endpoint, which is safer than adding one without a deletion policy;
- no explicit compound index for the current sort.

Recommended Phase 5 behavior:

- keep email read-only;
- expose only bounded, allowlisted filters;
- show role/status/created date and safe activity metadata;
- require explicit confirmation for role changes and disable/reactivate actions;
- reject self-demotion/self-disable by default;
- record actor/target/action/outcome;
- preserve token-version invalidation;
- never expose password hashes, refresh tokens, JWTs, or raw session material.

## 9. Inquiry Management Audit

The current admin queue is correctly admin-protected and returns populated user/listing summaries, but it is an operationally thin queue:

- `.limit(200)` is a hard response cap rather than pagination;
- no status, listing, user, text, or date filters;
- no query validation or ObjectId validation for status updates;
- stable newest-first ordering exists;
- status values are allowlisted;
- status updates are idempotent at the document level but have no duplicate-click or audit event;
- the UI has a pending status control but no detail drawer, filter bar, page controls, or action history;
- user email and message are exposed to admins, which is necessary for support but should be minimized in list views and protected in exports.

Phase 5 should add bounded pagination/filtering first, then improve the UI. Do not add chat, outbound messaging, or durable notification infrastructure under this phase.

## 10. Security Event Audit

### Current schema and behavior

`backend-api/src/models/SecurityEvent.js` stores:

- event type;
- optional `user` reference;
- request ID;
- IP address;
- truncated user-agent;
- metadata object; and
- a configurable TTL on `createdAt`.

Indexes exist on `type`, `user`, and `requestId`; the current retrieval sorts by `createdAt` and caps the result at 200.

Recorded event families include signup, login success/failure, logout, password change, admin user update, bootstrap, and refresh-token reuse. Persistence is best effort and logs only a safe error type if persistence fails.

### Gaps

- no separate actor and target identity for administrative actions;
- no explicit severity/action taxonomy;
- no pagination, date/type/actor filters, or stable secondary sort in retrieval;
- no frontend security-event center;
- listing and inquiry administrative mutations are not recorded;
- metadata is an open object and requires a documented redaction contract;
- IP and user-agent are sensitive operational data and need least-privilege presentation;
- no admin-read audit event, which is optional but should be considered for sensitive event exports.

### Phase 5 policy

Keep TTL retention and best-effort behavior. Add only the minimum additive fields needed for actor/target/action/outcome correlation. Redact secrets, tokens, passwords, cookies, raw request bodies, connection strings, and ML credentials. Do not expose raw logs or infrastructure diagnostics to ordinary admins.

## 11. Admin Dashboard / Analytics Audit

| Metric | Classification | Evidence | Phase 5 treatment |
|---|---|---|---|
| Total listings | VERIFIED DATA | `Listing.countDocuments()` | Keep; label as current total |
| Total predictions | VERIFIED DATA | `Prediction.countDocuments()` | Keep; document retention/anonymous scope |
| Total users | VERIFIED DATA | `User.countDocuments()` | Keep |
| Top predicted localities | VERIFIED DATA | bounded aggregation over `Prediction` | Keep with stable sort/date scope |
| Active users | UNAVAILABLE | no activity model/field | Do not invent; add only if activity definition is approved |
| Inquiry total/status counts | UNAVAILABLE | no admin stats query | Add only with bounded aggregation if operationally required |
| Favorites/saved searches | UNAVAILABLE | no admin aggregation | Avoid unless a measured admin need exists |
| Security-event totals | UNAVAILABLE | endpoint exists but dashboard does not aggregate | Prefer audit-center filters over vanity totals |
| API readiness | DERIVED DATA | `/ready` connection state | Add safe status only; no diagnostics |
| ML health/model metadata | VERIFIED DATA | authenticated `mlStatus` | Keep, distinguish liveness/readiness |

The current counts are whole-collection reads with no date window. No measured bottleneck justifies Redis, queues, a warehouse, or another analytics service. First use bounded queries, indexes, and explicit date windows.

## 12. System Health / Operations

Current safe surfaces:

- Express `/health`: process liveness only;
- Express `/ready`: Mongoose connection-state readiness only;
- admin ML status: authenticated ML health/model information through Express.

Not currently exposed in the admin UI:

- API readiness;
- database readiness explanation beyond ready/not-ready;
- request/error-rate summary;
- security-event health;
- last successful ML probe time.

Phase 5 may add an operator-safe status strip using these bounded signals. It must not expose environment variables, secrets, database URLs, raw stack traces, internal network addresses, or raw logs.

## 13. Listing Administration Audit

Listing CRUD and CSV import already exist and are admin-only. Validation is allowlisted and CSV input is capped at 5 MiB/1000 rows. Images are URL fields; there is no file-upload pipeline.

Current gaps:

- deletion is hard and can leave dangling favorites/inquiries;
- no moderation/visibility state;
- no server-side audit event;
- no page/search/filter in the admin table;
- no optimistic concurrency/version check;
- no import preview or idempotency contract;
- malformed IDs are not explicitly rejected before Mongoose;
- delete action has browser confirmation but no pending state or accessible label.

Phase 5 should not add a generalized CMS or media service. A minimal moderation/soft-delete policy is sufficient if product approval is given.

## 14. Prediction Administration Audit

There is no admin-wide prediction browser, export, or user-filtered prediction endpoint. Admins can access their own history through the same owner-scoped route and can use owner/admin share controls for records they own.

This is a privacy-preserving current limitation. Phase 5 should only add prediction administration if a concrete support/compliance requirement is approved. Any future endpoint must be paginated, date-bounded, user-filtered, omit share tokens/hashes, and preserve prediction retention and ownership rules.

## 15. Frontend UX, Responsive, and Accessibility Audit

### Current strengths

- `/admin` is visually and structurally distinct from the User Portal.
- Tables use horizontal overflow containers.
- Loading skeletons exist for major sections.
- Inquiry load failure has a retry state.
- Shared buttons, labels, cards, and theme tokens are reused.
- Server-side admin checks prevent frontend-only authorization reliance.

### Gaps to address in Phase 5

- one long monolithic page lacks section-level navigation and deep links;
- users/listings/inquiries do not expose page controls;
- initial stats/users/listings failures use toast-only feedback or empty arrays;
- listing deletion uses native `confirm` without explicit target detail, pending state, or accessible button name;
- role/status changes have no confirmation, reason, or visible pending state;
- several admin form labels are not explicitly associated with IDs;
- tables lack captions and explicit `scope` attributes;
- dense tables need deliberate phone-width review rather than overflow alone;
- no security-event page exists;
- no screen-reader or 200% zoom verification has been performed.

The visual language should remain operational/data-dense and separate from the customer portal. Shared tokens and primitives are appropriate; shared page shells or permission logic are not.

## 16. Performance Audit

Evidence-backed risks:

- admin page starts five independent requests on mount;
- users and inquiries are bounded by response caps but lack page/filter query contracts;
- stats performs multiple collection counts plus a prediction aggregation;
- user sort lacks a matching compound index;
- security-event sort lacks a createdAt compound index;
- no N+1 query was found in the current admin controllers; inquiry population is performed by Mongoose population in one query path;
- ML status performs two bounded upstream calls and uses existing timeouts;
- no polling was introduced by the admin page.

Preferred remedies are pagination, allowlisted filters, compound MongoDB indexes, bounded aggregation, request cancellation, and section-level loading—not new infrastructure.

## 17. Admin Data Privacy Audit

| Data | Classification | Current exposure | Recommendation |
|---|---|---|---|
| User name/email/role/status | Necessary for account administration | Admin user table | Keep; minimize exports and protect all admin routes |
| User created date | Necessary/optional | User table | Keep |
| User last activity | Unavailable | Not exposed | Do not invent without an approved activity definition |
| Inquiry message | Necessary for support | Admin queue | Keep in detail view; truncate list presentation if needed |
| Inquiry user email | Necessary for contact workflow | Admin queue | Keep only for authorized admins; avoid broad exports |
| Prediction inputs/results | Sensitive | Not admin-wide today | Preserve owner scope; add only with explicit need and field allowlist |
| Share token/hash | Should not be exposed | Not returned by admin routes | Never expose |
| Security-event IP/user-agent | Sensitive operational data | Admin event endpoint | Restrict, redact/minimize, document retention |
| JWT/refresh/CSRF/ML secrets | Should not be exposed | Not returned by admin routes | Never expose or log |
| Raw stack traces/infrastructure URLs | Should not be exposed | Sanitized | Preserve generic errors |

## 18. Destructive Action Safety Audit

Current high-impact actions:

- hard-delete listing;
- disable account;
- role change/promote to admin;
- CSV import of up to 1000 listings;
- self-service account deletion.

Current protections vary. Listing deletion has a browser confirmation; user role/status changes do not. Backend authorization and CSRF are present, but mutation auditing and concurrency policy are incomplete.

### Approval gate classification

| Operation | Risk | Required future gate |
|---|---|---|
| Inquiry status update | Low | Pending-state protection and audit event |
| Listing create/edit | Medium | Validate, show target, audit event |
| CSV import | Medium/High | Preview/count confirmation, bounded input, audit event |
| Account reactivation | Medium | Explicit target confirmation and audit event |
| Account disable | High | Explicit target/reason confirmation, self/last-admin guard, session invalidation |
| Role change to admin or from admin | High/Critical | Explicit confirmation, self/last-admin guard, atomic authorization, audit event |
| Listing deletion | Critical | Soft-delete/dependency review, explicit target confirmation, audit event, recovery policy |

### Safe deletion evidence standard

Any future destructive operation must establish: exact target, authorization, administrative scope, dependency impact, soft-delete feasibility, audit event, confirmation, recovery/backup consideration, idempotency/duplicate-click protection, and post-action verification. No deletion was performed during this audit.

## 19. Git Tracking vs Filesystem Removal

No files were deleted, untracked, ignored, or removed from Git during this audit. Generated `.next` and Python cache artifacts are build/runtime outputs and were not treated as source changes. Removing a file from the filesystem, removing it from Git tracking, and deleting a Git-tracked source file are distinct operations; none was performed. Existing dirty Phase 1–4 work was preserved.

## 20. Findings Severity and Phase 5 Scope

### P0 — Critical blocker

None confirmed.

### P1 — High priority

- ADM-01: atomic last-admin/self-target role-status policy.
- ADM-02: audit events for listing/inquiry administrative mutations.
- Safe deletion and role/status confirmation standards must be established before expanding destructive controls.

### P2 — Medium

- ADM-03: paginated/filterable inquiry administration.
- ADM-04: paginated/filterable security-event retrieval and UI.
- ADM-05: listing deletion dependency/soft-delete policy.
- ADM-06: explicit ObjectId validation on admin mutation routes.
- ADM-07: indexes matching admin sort/filter access patterns.
- ADM-10: actor/target distinction in security events.

### P3 — Low

- ADM-08: admin UI hierarchy, retry, pending, table semantics, and responsive/accessibility polish.
- ADM-09: additional operational metrics and readiness display where data is real and bounded.

### P4 — Enhancements

- Admin activity timeline, saved views, exports, and richer analytics only after measured need and privacy review.

### In scope for Phase 5

1. Secure admin action contract and auditability.
2. Bounded user management.
3. Bounded inquiry administration.
4. Security-event center.
5. Safe listing moderation/deletion workflow.
6. Evidence-backed dashboard/health visibility.
7. Admin accessibility, responsive behavior, testing, and documentation.

### Explicitly out of scope

- agent/broker portals;
- chat, outbound email/SMS, durable notifications;
- prediction warehouse/export without an approved privacy requirement;
- Redis, Kafka, queues, Kubernetes, service mesh, or microservices;
- raw log viewer for normal admins;
- generalized CMS/media management;
- subscription billing or unrelated User Portal redesign.

## 21. Phase 5 Slice Plan

| Slice | Name and objective | Likely files/areas | DB/API changes | Security/performance/accessibility impact | Tests, dependencies, risk, rollback, done |
|---|---|---|---|---|---|
| 1 | Admin API contract and bounds. Add explicit ID/query schemas, page/filter/sort allowlists, stable ordering, and typed response contracts. | Admin routes/controllers, validators, `queryBuilder.js`, API types/docs | Add bounded query parameters; consider User/SecurityEvent/Inquiry indexes only where query shape justifies them | Reduces DoS/data exposure; avoids unbounded queues; no new service | Extend `app.test.js`, schema/discovery tests, controller tests; depends on current contracts; rollback by retaining old response fields; done when every admin read/mutation rejects malformed/unbounded input deterministically |
| 2 | Privileged mutation safety and audit. Enforce self/last-admin policy atomically where supported, add ObjectId checks, idempotent pending semantics, and actor/target audit events. | `auth.controller.js`, listing/inquiry controllers, `SecurityEvent.js`, `securityEvent.js`, validators, auth tests | Additive actor/target/action/outcome fields and compatible indexes only if needed; no destructive migration | Highest security impact; preserves cookies, CSRF, tokenVersion, RBAC; bounded writes | Authorization/ownership/concurrency/security tests; isolated Mongo required for transaction/index verification; rollback via feature flag/compatibility fields; done when concurrent admin tests pass and every privileged mutation is auditable |
| 3 | User Management workspace. Add search/filter/page, role/status confirmation, safe detail/activity view, and clear pending/error states. | `frontend/src/app/admin/*`, shared table/dialog primitives, `api.ts`, types | Reuse Slice 1 API; no new collection | Keeps email read-only, hides session material, preserves server RBAC; bounded rendering | Frontend component tests if available, browser keyboard/responsive tests, admin runtime; depends on Slices 1–2; rollback route to current table; done when page/confirmation/audit flows work |
| 4 | Inquiry Administration workspace. Add bounded filters, pagination, detail/status workflow, retry/empty states, and audit visibility. | Admin inquiry components, API client/types, inquiry controller/validator | Reuse Inquiry indexes or add measured compound indexes | Limits response exposure and queue growth; no chat/delivery infrastructure | API validation/ownership/admin tests, browser regression; depends on Slice 1–2; rollback to current queue; done when all statuses and filters are bounded and audited |
| 5 | Listing moderation and safe lifecycle. Establish visibility/soft-delete or explicit dependency-aware hard-delete policy, import preview, pagination, and audit. | Listing controller/model/validators, admin listing components, docs | Additive `deletedAt`/visibility only if approved; index and backfill strategy required; no destructive migration | Prevents dangling references and accidental deletion; preserves public listing semantics through an explicit filter | Isolated DB dependency tests, delete/idempotence/import tests, UI confirmation tests; high risk; rollback by disabling deletion path and preserving records; done when dependency and recovery evidence exists |
| 6 | Security and audit center. Add paginated event retrieval, privacy-minimized filters, actor/target display, retention explanation, and safe export decision. | SecurityEvent model/controller/route, admin UI, logger/docs | TTL remains; additive indexes/fields only; no raw-log storage | Improves detection while preventing token/secret exposure | Security-event redaction, RBAC, pagination, TTL/index tests; depends on Slice 2; rollback to endpoint-only view; done when authorized admins can investigate without sensitive leakage |
| 7 | Admin operations dashboard. Add real metric definitions, bounded date windows, readiness/ML status, loading/error/empty states, and no-fake-metric policy. | `trends.controller.js`, admin dashboard components, API/types | Aggregations/indexes only when measured; no analytics store | Keeps operational visibility safe and cheap; no caching/infrastructure until measured | Aggregation/query-plan checks, API tests, runtime ML/DB checks; depends on prior API bounds; rollback to current totals; done when every metric is classified and bounded |
| 8 | Admin UX, accessibility, regression, and documentation closure. | Admin components, shared UI primitives, docs/API/DATABASE/SECURITY/TESTING/UI-UX | None unless previous slices require documented additive migration | Keyboard, focus, table semantics, responsive data density, and separate admin IA | Full backend/frontend/ML/browser/DB matrix; provider/runtime dependencies explicit; rollback per slice; done when acceptance checklist passes and no Phase 1–4 regression exists |

No slice requires Redis, Kafka, queues, Kubernetes, or a new microservice. MongoDB indexes, bounded queries, and the existing Express/FastAPI boundary are sufficient unless measurement proves otherwise.

## 22. Test Strategy

### Unit and schema tests

- Extend `backend-api/src/test/authSchemas.test.js` for admin query/action schemas, self-target rules, and ObjectId validation.
- Extend `backend-api/src/test/discovery.test.js` for bounded admin filters and stable sorting.
- Add focused controller/helper tests for audit payload redaction, actor/target mapping, and deletion policy.

### Authorization and ownership

- Non-admin cannot read or mutate any `/admin` endpoint.
- User cannot mutate another user's role/status, inquiry, prediction, favorite, or saved search.
- Admin prediction access remains owner-scoped unless a separately approved endpoint is tested.
- Disabled/revoked admin sessions fail after status/role changes.

### Database/query tests

- Verify index definitions and bounded aggregation pipelines against an isolated MongoDB test database.
- Test concurrent last-admin changes using a transaction or atomic update strategy selected during implementation.
- Verify TTL and actor/target-compatible SecurityEvent documents without dropping production data.

### Frontend/runtime

- Test admin page loading, empty, error, retry, pending, confirmation, and duplicate-click states.
- Keyboard test role/status dialogs, deletion confirmation, pagination, table navigation, and focus restoration.
- Verify 320/375/390/430/768/1024/1280px layouts and 200% reflow where browser tooling permits.
- Verify no admin secrets/tokens appear in DOM, URLs, local/session storage, or logs.

### Regression commands

- `backend-api`: `npm test`
- `frontend`: `npm run lint`, `npx tsc --noEmit`, `npm run build`
- `ml-service`: AST parse and `python -m unittest discover -s verify -p "test_*.py"` when dependencies are available
- repository: `git diff --check`
- runtime: isolated MongoDB, authenticated API, ML service, browser, and admin test account

Do not create frontend test infrastructure or install a new framework unless an existing test capability is insufficient and separately approved.

## 23. Documentation Plan

Phase 5 implementation should update only the relevant canonical documents:

- `docs/API.md`: admin endpoints, filters, pagination, mutation responses, audit semantics, deletion policy.
- `docs/DATABASE.md`: any additive fields/indexes, TTL/retention, soft-delete/backfill and rollback plan.
- `SECURITY.md`: admin action authorization, actor/target audit, self/last-admin policy, privacy rules.
- `TESTING.md` and `docs/TESTING.md`: isolated admin runtime and regression matrix.
- `docs/UI-UX.md`: separate Admin Control Center information architecture and responsive/accessibility rules.
- `DEPLOYMENT.md`: provider/runtime requirements only if new environment configuration is actually introduced.
- A focused admin workflow document only if the final UI requires operational runbooks.

No documentation was edited during this audit except the explicitly authorized plan artifact.

## 24. Provider / Runtime Dependencies

| Verification type | Required dependency |
|---|---|
| Code-verifiable | Route authorization, schemas, bounds, redaction, token/cookie preservation, error handling, static diff review |
| Local-runtime-verifiable | Backend process, isolated MongoDB, frontend dev/build server, local ML service or safe stub, admin test account |
| Provider-verifiable | Render environment variables, Render service-to-service connectivity, Vercel origin, MongoDB Atlas indexes/permissions, production-like TLS/proxy behavior |
| Manual-only | Screen reader, real-device touch, 200% zoom, operational confirmation wording, deletion/recovery runbook approval |

Production credentials, real users, Atlas production data, and destructive seed commands must not be used for Phase 5 verification.

## 25. Security Boundary and Acceptance Criteria

Every Phase 5 slice must preserve:

- HttpOnly, Secure, SameSite cookies;
- CSRF protection on cookie-authenticated mutations;
- refresh-token hashing, rotation, reuse detection, and token-version invalidation;
- server-side RBAC and ownership checks;
- hashed, expiring, revocable share tokens;
- rate limits and bounded request/query sizes;
- SecurityEvent TTL/retention and redaction;
- sanitized errors and structured logs;
- authenticated Express → FastAPI ML calls;
- fail-closed production CORS and configured `TRUST_PROXY`.

Phase 5 is complete only when:

1. Every admin read is authenticated, bounded, stable, and privacy-reviewed.
2. Every high-impact admin mutation is validated, CSRF-protected, auditable, and idempotent.
3. Self/last-admin behavior is explicit and concurrency-safe.
4. Listing deletion has a documented dependency/recovery policy.
5. User, inquiry, listing, security-event, and operations workflows have loading/error/empty/pending states.
6. Admin UX remains distinct from the User Portal and works at target breakpoints.
7. Backend tests, frontend lint/typecheck/build, ML checks where available, diff checks, isolated DB checks, and browser checks pass or are explicitly marked blocked.
8. No Phase 1–4 security or functionality regression exists.

## 26. Audit Boundary

This document is an audit-derived implementation plan only. Phase 5 features, schema changes, API changes, tests, documentation updates beyond this artifact, database operations, deployments, commits, and pushes were not performed.
