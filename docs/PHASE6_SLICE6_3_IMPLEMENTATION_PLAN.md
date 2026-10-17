# Phase 6 — Slice 6.3 Implementation Plan

## 1. Executive summary

The current Favorites, Saved Searches, Inquiries, and derived Notifications flows are authenticated, owner-scoped, CSRF-protected, and bounded in their primary read paths. The notification page already loads saved-search and inquiry sources independently, so a failure in one source does not hide the other.

The audit found four implementation-worthy P2 reliability/resource issues and several non-blocking P3 consistency concerns:

1. Favorites have no server-side cardinality quota; the embedded `User.favorites` array and `/api/favorites/ids` response can grow without a product bound.
2. Saved-search quota enforcement is a count-then-insert race and can be exceeded by concurrent requests.
3. Favorites, saved-search, inquiry, and notification UIs trust TypeScript casts instead of validating response shapes at runtime; malformed successful JSON can crash rendering or produce invalid state.
4. Inquiry mutations have only the global API limiter and no account-aware duplicate/cooldown control; repeated inquiries are explicitly allowed by the current contract.

No P0/P1 issue or confirmed authentication, CSRF, RBAC, ownership, Mongo-operator-injection, or cross-user data exposure issue was found.

## 2. Baseline

- Branch: `main`
- HEAD: `b0657e5fcb7ac87b2dc9d0df017edae7510786ac`
- Worktree: intentionally dirty with 117 status entries at audit start; all existing changes are protected.
- Backend tests: `66/66` passed (`backend-api/npm test`).
- Frontend ESLint: passed (`frontend/npm run lint`).
- No production/shared database was accessed.
- No application, test, configuration, or documentation file was modified by the audit. This plan is the only new file permitted by the audit request.

## 3. Current architecture

### Favorites

- Favorites are embedded `Listing` ObjectIds on `User` (`backend-api/src/models/User.js`).
- `GET /api/favorites` uses one bounded aggregation to filter active listings, slice the embedded array, and count the visible IDs, followed by one bounded listing query (`backend-api/src/controllers/favorites.controller.js:8-44`).
- `GET /api/favorites/ids` returns the complete embedded array (`favorites.controller.js:47-50`).
- Add uses an active-listing existence check followed by atomic `$addToSet`; remove uses `$pull` scoped by the authenticated user (`favorites.controller.js:52-72`).
- The frontend provider loads IDs once per authenticated user and serializes each mutation through a per-ID pending set (`frontend/src/lib/favorites-context.tsx:20-44`).

### Saved Searches

- Saved searches are owned documents with a strict filter object, a `lastNotifiedCount`, and a per-user index (`backend-api/src/models/SavedSearch.js`, `backend-api/src/validators/savedSearch.schema.js`).
- `GET /api/saved-searches` returns all searches for the current user and computes match/new-match counts in one `$facet` aggregation. The configured quota defaults to 20 (`savedSearch.controller.js:8-19`, `config/env.js:61`).
- Create checks `countDocuments` and then performs `create` as separate operations (`savedSearch.controller.js:22-28`).
- Delete and mark-notified filter by both `_id` and `req.user.sub`, preserving ownership.
- There is no edit endpoint; the UI supports create, delete, view, and mark-seen (`frontend/src/app/saved/page.tsx`).

### Inquiries

- Protected routes require `authenticate` and `requireRole("user", "admin")`; admin queue/status routes add the admin role check (`backend-api/src/routes/inquiry.routes.js`).
- Creation validates a message length of 10–1000, validates the listing ObjectId, and requires an active listing (`inquiry.controller.js:11-15`).
- User reads are filtered by `user`, paginated to a maximum of 100, populated with listing summary, and sorted by `createdAt DESC, _id DESC` (`inquiry.controller.js:18-25`).
- Admin reads and status changes are bounded, status-allowlisted, ObjectId-validated, and successful status changes emit a redacted SecurityEvent (`inquiry.controller.js:32-50`).
- No duplicate-inquiry prevention or user-specific inquiry limiter exists; this is documented behavior, not an accidental API bypass.

### Notifications

- There is no Notification collection or delivery service. Notifications are a derived view of saved-search match deltas and inquiry status records (`docs/API.md`, `docs/DATABASE.md`).
- The notifications page has independent loading, error, retry, and empty states for each source (`frontend/src/app/notifications/page.tsx:20-74`).
- The navbar polls saved-search counts once immediately and every 60 seconds (`frontend/src/components/layout/navbar.tsx:36-44`). The shared API timeout is 15 seconds, so normal requests cannot overlap the 60-second interval.

## 4. Confirmed findings

### P2 — unbounded favorite cardinality and ID response

- **Files:** `backend-api/src/controllers/favorites.controller.js:47-71`, `backend-api/src/models/User.js:15`, `frontend/src/lib/favorites-context.tsx:26-37`.
- **Behavior:** Any authenticated account can add unlimited distinct listing IDs. `$addToSet` prevents duplicates but does not cap array length. `/api/favorites/ids` returns the entire array, and each mutation returns the entire array again.
- **Impact:** A user can grow a single User document and force increasingly large reads/responses. The practical MongoDB document limit is the eventual ceiling, not an application quota. This is a resource-abuse and reliability risk, not an IDOR.
- **Verification:** Repeatedly add unique active listing IDs while observing `User.favorites` size and response payload size; no quota check exists in the current code.
- **Recommended fix:** Add a bounded `FAVORITES_MAX` runtime setting and enforce it atomically in the update predicate (or introduce a separately indexed favorite collection only if measured scale requires it). Keep `$addToSet` semantics and return the existing response shape.
- **Slice ownership:** Slice 6.3.

### P2 — saved-search quota check is raceable

- **File:** `backend-api/src/controllers/savedSearch.controller.js:22-28`.
- **Behavior:** Concurrent requests can both observe a count below `env.savedSearchLimit` and then both insert.
- **Impact:** The documented per-account quota can be exceeded, increasing the number of `$facet` branches and repeated listing scans performed for that account.
- **Verification:** Issue concurrent create requests for one account against an isolated transaction-capable test database and count resulting documents.
- **Recommended fix:** Make quota admission atomic using the existing MongoDB transaction capability or a single-account quota/write anchor. Fail closed if the required transaction capability is unavailable; do not add Redis or a distributed lock.
- **Slice ownership:** Slice 6.3.

### P2 — frontend response casts can crash or corrupt workflow state

- **Files:** `frontend/src/app/favorites/page.tsx:31-33`, `frontend/src/lib/favorites-context.tsx:26-37`, `frontend/src/app/saved/page.tsx:38-40`, `frontend/src/app/notifications/page.tsx:31-42`, `frontend/src/components/layout/navbar.tsx:38-40`.
- **Behavior:** API results are cast to `Paginated<Listing>`, `{ ids: string[] }`, or `{ items: ...[] }` without runtime validation. The shared client only validates that the body is parseable JSON.
- **Impact:** A successful but malformed response can make Favorites render access `data.items.length`, make Saved render call `.map` on a non-array, or leave notification/badge state inconsistent. This reproduces the same class of contract failure previously found in Results.
- **Verification:** Return valid JSON with missing/wrong `items` or `ids` fields from an isolated API stub and exercise each page/provider.
- **Recommended fix:** Add small Zod schemas for paginated listings, favorite IDs, saved-search items, and inquiry items; route invalid payloads to the existing recoverable error/retry states. Preserve the existing API response shapes.
- **Slice ownership:** Slice 6.3.

### P3 — inquiry spam/duplicate policy is not account-aware

- **Files:** `backend-api/src/routes/inquiry.routes.js:10-14`, `backend-api/src/middleware/rateLimiters.js:4-9`, `backend-api/src/controllers/inquiry.controller.js:11-15`.
- **Behavior:** Inquiry creation inherits only the global IP/API limiter. Repeated valid inquiries for the same listing are accepted; the database has no duplicate/cooldown constraint.
- **Impact:** A user can generate repeated inquiry records and notification work. The global limiter provides a coarse bound, so this is a hardening concern rather than a confirmed bypass.
- **Recommended fix:** Decide an explicit product policy first; if anti-spam is required, add a bounded account-aware limiter and/or a short duplicate cooldown without changing historical inquiry records.
- **Slice ownership:** Slice 6.3, but non-blocking until product policy is approved.

## 5. P3 consistency and performance findings

- `removeFavorite`, saved-search delete/mark-notified, and user inquiry pagination do not use explicit Zod parameter schemas. Mongoose CastError handling still returns controlled 400 responses, and ownership filters remain intact; this is consistency hardening, not a confirmed security issue.
- `GET /api/favorites` preserves the embedded-array order rather than applying a database sort. It is stable for a given user document but has no timestamp-based ordering contract.
- Saved-search counts use one aggregation with up to `SAVED_SEARCH_MAX` `$facet` branches. This avoids application-level N+1 requests and is bounded at the default quota of 20, but can become CPU-heavy with many regex filters; production-scale measurement should precede redesign.
- Navbar polling recomputes all saved-search counts every 60 seconds. The 15-second request timeout prevents normal overlap, but a request-generation/in-flight guard would make the badge resilient to unusual browser/runtime behavior.
- There is no durable notification retention model because notifications are intentionally derived; adding a collection, worker, queue, or delivery service is unnecessary for this slice.

## 6. Existing protections verified

- All four route families are behind authentication; user/admin role boundaries are enforced.
- User favorites, saved searches, and inquiries are owner-filtered. Admin inquiry access is separate and role-protected.
- Favorite additions require a valid, active listing; inquiry creation rejects malformed, missing, and archived listings.
- Saved-search filters are strict, bounded, and reject unknown fields/operators. Listing query construction escapes regex metacharacters.
- Inquiry status is an allowlist; admin IDs are ObjectId-validated; reads and queue queries are paginated and deterministically ordered.
- State-changing requests pass through global CSRF middleware and the global API limiter; no route bypass was found.
- User responses do not select password/token fields. Inquiry/admin results expose only the intended user/listing summaries.
- Admin inquiry status mutations emit redacted normalized SecurityEvents. Favorites/saved-search mutations currently do not emit events; no requirement or existing event contract was found that makes this a confirmed defect.
- Notifications preserve the Slice 6.1 independent-source behavior: one failed source renders its own retry state while the other source remains visible.

## 7. Proposed implementation slices

### Slice 6.3a — bounded favorites

- **Files:** `backend-api/src/config/env.js`, `backend-api/src/controllers/favorites.controller.js`, `backend-api/src/test/*` focused favorite tests, `docs/API.md`, `docs/DATABASE.md`; minimal frontend message/type adjustment if needed.
- **Objective:** Enforce a documented cardinality bound atomically while preserving add/remove/list response contracts and active-listing filtering.
- **Security:** Keep user ownership, CSRF, ObjectId handling, and `$addToSet`.
- **Acceptance:** duplicate adds remain idempotent; the first request over the cap receives a controlled validation response; `/ids` and mutations cannot return unbounded data; archived listings remain excluded from listing results.

### Slice 6.3b — atomic saved-search quota

- **Files:** `backend-api/src/controllers/savedSearch.controller.js`, transaction/helper module only if an existing shared helper is insufficient, focused tests, `docs/API.md`/`docs/DATABASE.md`.
- **Objective:** Make the existing quota invariant hold under concurrent creation.
- **Security:** preserve owner filters and strict saved-search schema; fail closed if transactions are unavailable.
- **Acceptance:** concurrent isolated tests never exceed the configured quota; normal create/delete/mark-notified behavior remains compatible.

### Slice 6.3c — runtime contract validation and stale-state safety

- **Files:** `frontend/src/lib` schema helper, `frontend/src/app/favorites/page.tsx`, `frontend/src/lib/favorites-context.tsx`, `frontend/src/app/saved/page.tsx`, `frontend/src/app/notifications/page.tsx`, `frontend/src/components/layout/navbar.tsx`, focused verification fixtures/tests.
- **Objective:** Treat all four workflow response shapes as untrusted and route malformed payloads to controlled error/retry states.
- **Security:** no token/browser-storage changes; retain shared client credentials, CSRF, timeout, refresh, and safe parsing.
- **Acceptance:** malformed JSON remains a client error; valid JSON with wrong `items`/`ids` shape never crashes a page or provider; partial notification failures remain independent; rapid navigation does not let stale responses overwrite current state.

### Slice 6.3d — inquiry anti-spam policy (conditional)

- **Files:** `backend-api/src/middleware/rateLimiters.js`, `backend-api/src/routes/inquiry.routes.js`, focused tests, API/security docs.
- **Objective:** Only if product approves a duplicate/cooldown policy, add a bounded account-aware inquiry limiter without introducing infrastructure.
- **Acceptance:** rate-limited responses are safe and documented; existing inquiry ownership, admin queue, history, and status semantics remain unchanged.

## 8. Exact likely file set

Backend:

- `backend-api/src/config/env.js`
- `backend-api/src/controllers/favorites.controller.js`
- `backend-api/src/controllers/savedSearch.controller.js`
- `backend-api/src/controllers/inquiry.controller.js` (only if anti-spam policy or explicit param validation is approved)
- `backend-api/src/routes/favorites.routes.js`
- `backend-api/src/routes/savedSearch.routes.js`
- `backend-api/src/routes/inquiry.routes.js`
- `backend-api/src/middleware/rateLimiters.js` (conditional)
- focused backend tests under `backend-api/src/test/`

Frontend:

- `frontend/src/lib/` runtime schemas/types
- `frontend/src/app/favorites/page.tsx`
- `frontend/src/lib/favorites-context.tsx`
- `frontend/src/app/saved/page.tsx`
- `frontend/src/app/notifications/page.tsx`
- `frontend/src/components/layout/navbar.tsx`

Documentation:

- `docs/API.md`
- `docs/DATABASE.md`
- `docs/TESTING.md`
- `SECURITY.md` only if the anti-abuse contract materially changes.

## 9. API and database strategy

- Preserve all existing response shapes and status semantics unless a new quota error is required.
- Do not create a Notification collection or delivery infrastructure.
- Do not migrate existing favorites, saved searches, inquiries, or notification data.
- A favorites cap can be enforced on the embedded array with an atomic update predicate; a separate collection is a measured-scale fallback, not the default.
- Saved-search quota admission should reuse transaction support already required for admin mutations; no Redis, queue, worker, or distributed lock.
- No index should be added speculatively. Measure saved-search facet cost and favorite document growth before adding or redesigning indexes.

## 10. Security and reliability test strategy

Backend focused tests:

- unauthenticated and cross-user favorites/saved-search/inquiry/notification access is rejected;
- malformed ObjectIds and Mongo-style operators are controlled;
- favorite duplicates are idempotent and quota enforcement is atomic;
- saved-search concurrent creation never exceeds quota;
- archived/nonexistent listings reject new favorites/inquiries;
- inquiry pagination/status/admin boundaries remain unchanged;
- rate-limit behavior is safe if the conditional anti-spam slice is approved.

Frontend focused checks:

- malformed/missing/wrong-type `items` and `ids` payloads show recoverable states;
- favorites, saved, and notification loading/empty/error/retry states remain intact;
- notification source failures remain independent;
- navbar polling does not create duplicate timers or stale badge overwrites;
- session expiry continues through the shared refresh/error path.

Runtime verification must use an isolated MongoDB database; quota concurrency requires a transaction-capable replica set. Never use production/shared data.

## 11. Browser verification checklist

1. Add, duplicate-add, remove, and reload favorites.
2. Reach the favorite cap and verify a safe error without corrupting the page.
3. Open Favorites with empty, archived, malformed, and API-error responses.
4. Create, delete, view, and mark-seen saved searches.
5. Verify quota behavior with concurrent requests in an isolated test environment.
6. Open Notifications with both sources healthy, either source failing, and both failing.
7. Confirm each failed source has its own retry and the healthy source remains visible.
8. Let the navbar badge poll across a timeout and route transition; confirm no duplicate timers or stale count.
9. Submit an inquiry, retry after failure, and verify archived/nonexistent listings are rejected safely.
10. Verify user/admin boundaries and session-expiry recovery in a real browser.

## 12. Risks and rollback

- A favorites quota is user-visible; choose a documented limit and return a controlled validation error. Roll back by disabling the runtime cap, not by deleting references.
- Transactional saved-search creation requires replica-set support. If unavailable, fail closed for the create mutation rather than silently weakening the quota.
- Runtime schemas must be tolerant of legacy nullable fields and preserve existing API shapes. Roll back by removing caller validation; no database rollback is required.
- Anti-spam policy can change user expectations; keep it conditional until product approval.
- All changes are additive and can be reverted as a single slice without data deletion.

## 13. Out of scope

- Slice 6.2 discovery/compare/map changes.
- Slice 6.4 prediction/history/share UX.
- Slice 6.5 broad accessibility/mobile review.
- Slice 6.6 final regression/E2E closure.
- Durable notifications, push/email/SMS delivery, workers, queues, Redis, Kafka, WebSockets, new services, or a new database.
- Listing lifecycle changes, admin redesign, SecurityEvent schema redesign, or unrelated performance work.

