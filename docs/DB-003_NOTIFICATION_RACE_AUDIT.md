# DB-003 Notification Acknowledgement Race Audit

## 1. Scope

This is a read-only, measurement-only audit of updates to
`SavedSearch.lastNotifiedCount`. No application code, schema, index,
configuration, or production data was changed. The audit covers the backend
acknowledgement endpoint, frontend callers/polling, MongoDB concurrency
behavior, security boundaries, and the existing test/documentation evidence.

## 2. Repository Baseline

- Branch: `main`
- HEAD: `e14d13acadf25c2fb33b328ce5819c5a8fc4954f`
- `origin/main`: `e14d13acadf25c2fb33b328ce5819c5a8fc4954f`
- Worktree status: intentionally dirty with 114 pre-existing tracked or untracked entries.
- No files were staged, committed, reset, cleaned, stashed, reverted, or discarded by this audit.

## 3. Current Write Path

There is one application acknowledgement writer:

1. `POST /api/saved-searches/:id/mark-notified` in
   `backend-api/src/routes/savedSearch.routes.js:12`.
2. The route is behind `authenticate` and `requireRole("user", "admin")`
   (`savedSearch.routes.js:8`), the global API rate limiter, and global CSRF
   protection for cookie-authenticated unsafe methods.
3. `backend-api/src/controllers/savedSearch.controller.js:78-84`
   (`markNotified`) reads with:
   `{ _id: req.params.id, user: req.user.sub }`.
4. It counts active listings with
   `Listing.countDocuments(buildActiveListingQuery(saved.filters))`
   (`savedSearch.controller.js:82`). `buildActiveListingQuery` adds
   `{ deletedAt: null }`, so archived listings are excluded.
5. It assigns the result to `saved.lastNotifiedCount` and calls
   `saved.save()` (`savedSearch.controller.js:82-83`). The write is
   unconditional after the read/count; it has no compare-and-swap predicate,
   explicit session, or transaction.

`backend-api/src/models/SavedSearch.js:8` defines `lastNotifiedCount` as a
Number with default `0`; timestamps are enabled at line 10 and Mongoose's
default `__v` version key remains present. No `optimisticConcurrency` option
or application-level version predicate is configured. The repository search
found no other `lastNotifiedCount` writer, `$set`/`$inc` acknowledgement update,
bulk write, replacement write, or background SavedSearch writer. Account
deletion removes whole SavedSearch documents but does not acknowledge them.

## 4. Race Condition Analysis

The current sequence permits the following interleaving:

1. Request A reads the same saved-search document and later observes listing
   count `X`.
2. Request B reads the document and observes count `Y`.
3. B assigns `lastNotifiedCount = Y` and saves.
4. A assigns `lastNotifiedCount = X` from its older observation and saves.

Because the saves are not conditional on a version/updated timestamp, the last
database write wins. A stale count can therefore overwrite a newer count. The
Mongoose version key does not provide a documented scalar compare-and-swap
contract here; default versioning is not configured as optimistic concurrency
for this schema.

The effect is limited to the derived acknowledgement anchor. It cannot change
the saved filter object or another user's record. A later GET computes
`newMatches = max(currentCount - lastNotifiedCount, 0)` and can consequently
show a repeated alert (if the anchor regressed) or suppress an alert (if a
newer count was overwritten in the opposite direction).

## 5. Frontend Trigger Analysis

- `frontend/src/app/saved/page.tsx:58-64` is the only direct acknowledgement
  caller. `markSeen` disables that item's button while its request is pending.
- `frontend/src/lib/api.ts:217` issues one `POST` call. The shared `apiFetch`
  may perform its standard single 401 refresh-and-retry, so a request can be
  replayed after session restoration; there is no acknowledgement-specific
  idempotency key.
- `frontend/src/app/notifications/page.tsx` only reads saved searches and
  inquiries; it does not call `markSavedNotified`.
- `frontend/src/components/layout/navbar.tsx:38-46` polls
  `GET /api/saved-searches` every 60 seconds. Polling does not write
  `lastNotifiedCount`.
- A single Saved page instance prevents a second click for the same row, but
  independent tabs/windows, repeated visits with an in-flight request, or a
  replay after a 401 can overlap. No repository code demonstrates that these
  conditions have occurred in production.
- There is no notification collection, worker, queue, webhook, or scheduled
  acknowledgement writer. Notifications are derived read-time deltas.

## 6. Backend Concurrency Analysis

MongoDB single-document writes are atomic individually, but atomicity does not
make the preceding read/count/write sequence conditional. The current `save()`
does not predicate the update on the value read by the request. Timestamps and
`__v` may change as part of saves, but no application check rejects a stale
scalar write. No transaction spans the listing count and acknowledgement write,
and a transaction would not by itself define which concurrently computed count
should win.

The relevant SavedSearch indexes are the schema's `_id` index and:

- `user: 1` (`SavedSearch.js:5`)
- `{ user: 1, createdAt: -1 }` (`SavedSearch.js:13`)

The acknowledgement lookup uses `_id` plus owner, so `_id` provides the
selective lookup and the owner predicate enforces isolation. The count query is
against `Listing` and uses the supported filter fields plus `deletedAt: null`;
the Listing model declares indexes for locality, city, property type, BHK,
price, listed date, and locality/price. No live `explain()` or provider index
inspection was performed.

## 7. Reproduction Attempt

- MongoDB race reproduction: **NOT RUN — isolated MongoDB unavailable**. A
  local `127.0.0.1:27017` listener exists, but it is backed by the persistent
  `docker-compose` `mongo_data` volume and could not be proven disposable
  without risking shared data. No MongoDB connection or mutation was made.
- Non-mutating deterministic timing model: **OBSERVED**. Two in-memory tasks
  representing counts 10 (delayed) and 25 (fast) finished with final value 10,
  demonstrating the exact stale-last-write sequence without touching MongoDB.
- No production or shared database data was used.

## 8. Evidence

- Source evidence confirms an unconditional read/count/`save()` sequence at
  `savedSearch.controller.js:78-84`.
- Repository documentation explicitly describes this as a theoretical race
  and measurement-gated follow-up (`docs/DATABASE_INTEGRITY_AUDIT.md:137-146`,
  `docs/DATABASE.md:158`).
- No production logs, incident records, or test artifact in the repository
  proves a stale `lastNotifiedCount` has occurred.
- Backend `npm test` passed 92/92. Existing tests cover ownership, strict
  filters, quarantine, and bounded matching, but contain no out-of-order
  `markNotified` concurrency test.

## 9. Impact

- The race is theoretically possible: **YES**.
- Natural same-tab trigger: **bounded by the pending-button guard**.
- Cross-tab/replay trigger: **possible**, but not evidenced.
- Reproduced against MongoDB: **NO** (unsafe shared/persistent local target).
- Production evidence: **NONE FOUND**.
- Security impact: **none proven**. Ownership, authentication, CSRF, and
  filter validation remain enforced.
- Integrity/user impact: a derived alert count may regress, causing a repeated
  or missed saved-search notification. Saved-search filters and listing data
  are not modified by this race.

## 10. Performance Observations

- Each acknowledgement performs one owner-scoped SavedSearch read, one
  `Listing.countDocuments`, and one SavedSearch save.
- Each saved-search list read computes all valid search counts in one `$facet`
  aggregation, bounded by the configured saved-search quota (default 20).
- Navbar polling is every 60 seconds. The notifications page and navbar can
  issue duplicate read requests during navigation, as documented in the
  existing Phase 4 notes, but these are GETs and do not create acknowledgement
  races.
- There is no evidence of unbounded acknowledgement fan-out. Query latency and
  index usage were not measured against production.

## 11. Security Review

The acknowledgement path preserves:

- authentication and active-account/token-version checks via `authenticate`;
- user/admin role boundary via `requireRole("user", "admin")`;
- owner scoping in both SavedSearch lookup predicates;
- global CSRF validation for unsafe cookie-authenticated requests;
- global API rate limiting;
- Mongoose identifier casting with controlled `CastError` handling (400),
  rather than arbitrary query operators;
- strict filter validation before constructing the listing query;
- archived-listing exclusion through `buildActiveListingQuery`.

No IDOR, operator injection, authorization bypass, or sensitive-data exposure
was found in this path.

## 12. Regression Test Gap

If hardening becomes justified, add one deterministic isolated test that:

1. creates one owner-scoped SavedSearch in a disposable transaction-capable
   MongoDB (or fully controlled model harness);
2. starts two acknowledgement operations with controlled delays and distinct
   count values;
3. asserts the chosen stale-write policy (prefer an atomic version/CAS loser
   response rather than silently overwriting);
4. verifies the final anchor cannot regress because of the stale operation;
5. verifies another user's record cannot be affected and malformed filters do
   not invoke a count query.

The test must not use the production database or the four known malformed
SavedSearch records.

## 13. Recommendation

**MEASUREMENT/OBSERVABILITY ONLY**

No code fix is justified by current evidence. The race is a real code-level
possibility, but it is measurement-gated: there is no production incident,
duplicate/missed-alert report, or Mongo reproduction proving user-visible
impact. Add targeted observability for acknowledgement request IDs, duration,
and conflict/replay outcomes without logging filter contents or credentials.

If evidence later demonstrates stale regressions, the smallest safe code change
is a single-document compare-and-swap acknowledgement (for example, predicate
on the observed `__v`/updated timestamp and return a controlled conflict to a
loser), plus the focused out-of-order test above. Do not add transactions,
queues, Redis, Kafka, or a new notification system for this derived counter.

## 14. Risk Classification

- **P0:** 0
- **P1:** 0
- **P2:** 0
- **P3:** 1 — theoretical derived-count race; measurement-gated, no production
  occurrence proven.

## 15. Implementation Gate

Audit verdict: **NO FIX JUSTIFIED** pending production evidence.

- Race theoretically possible: **YES**.
- Reproduced against MongoDB: **NO**.
- Production evidence exists: **NO**.
- Recommended action: **MEASUREMENT/OBSERVABILITY ONLY**.
- Exact file created: `docs/DB-003_NOTIFICATION_RACE_AUDIT.md`.
- Application files changed: **NONE**.
- Schema/index/config files changed: **NONE**.
- Production database accessed or modified: **NO**.
- Production data changed: **NO**.
- Commit/push performed: **NO**.
- Existing unrelated worktree changes preserved: **YES**.
