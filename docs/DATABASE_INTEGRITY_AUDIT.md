# RealtyIQ Database Integrity Audit

**Audit mode:** read-only repository and test inspection
**Audit date:** 2026-09-12
**Scope:** MongoDB/Mongoose persistence, critical workflows, integrity controls, and the known SavedSearch incident.

## 1. Executive Summary

RealtyIQ uses MongoDB through Mongoose. The browser never connects directly to MongoDB; Express owns validation, authorization, persistence, and calls to FastAPI. The current code has strong boundary controls: ObjectId validation, strict saved-search filters, active-listing isolation, owner scoping, bounded pagination, atomic favorite admission, transactional saved-search quota admission, token-version invalidation, and TTL-backed prediction/security-event retention.

One production data-integrity issue is confirmed: four SavedSearch documents observed in an authenticated production response lack `filters`. The current schema and supported POST path require and persist filters, and the repository contains no alternate SavedSearch writer. The records are therefore treated as historical or externally-created malformed data; their original filters cannot be reconstructed safely. They must remain untouched pending an explicit product/data decision.

No P0 or P1 database-integrity vulnerability was proven. Two medium operational risks remain: self-service account deletion is a multi-collection `Promise.all` without a transaction, and `mark-notified` performs a read/count/save sequence that can write a stale derived count under concurrency. Neither is evidence of current corruption, and neither justifies an automatic production migration.

## 2. Database Integrity Score

**Database Integrity Score: 85/100**

| Area | Score | Basis |
|---|---:|---|
| Schema integrity | 16/20 | Required fields/enums/defaults exist; four historical SavedSearch records violate the current `filters` contract and several fields use flexible `Object` shapes. |
| Relationship integrity | 14/15 | Ownership filters and archive semantics are explicit; MongoDB does not enforce foreign keys. |
| Atomicity/concurrency | 13/20 | Favorites and saved-search quota use atomic/transactional admission; account deletion and mark-notified are multi-step. |
| Duplicate prevention | 10/15 | Unique user email and `$addToSet` favorites are enforced; saved-search/inquiry duplicate policy is intentionally absent. |
| State integrity | 12/15 | Listing lifecycle and inquiry status enums are guarded; no general transition ledger exists. |
| Index quality | 7/10 | Declared indexes match primary ownership/queue/TTL queries; live production index state was not inspected. |
| Delete/retention safety | 8/10 | Listing archive preserves references; prediction/security-event TTLs exist; account deletion is not all-or-nothing. |
| Migration safety | 4/5 | No migration framework, but additive/backward-compatible patterns are documented. |
| Backup/recovery readiness | 1/5 | Atlas backup/PITR configuration and restore tests are provider-side and unverified from this repository. |
| Observability | 4/5 | Request IDs, structured logs, and best-effort SecurityEvents exist; no centralized audit/metrics store. |

The score does not penalize intentionally absent features such as durable notification delivery, a warehouse, or a migration framework where the current product does not require them.

## 3. Architecture Detected

- **Engine/provider:** MongoDB, intended for MongoDB Atlas in production; local defaults use `mongodb://127.0.0.1:27017/realtyiq`.
- **ORM:** Mongoose 8. `connectDB` enables `strictQuery` and uses a 10-second server-selection timeout. Startup exits on connection failure; no application retry loop is present.
- **Services:** Express API is the system of record and gateway; FastAPI is called by the API only. Vercel serves the frontend and Render hosts API/ML according to `render.yaml`.
- **Transactions:** Used for last-admin role/status changes and saved-search quota admission. The saved-search path fails closed with `503` when transaction capability is unavailable. No general transaction wrapper exists.
- **Caching:** Express responses can participate in HTTP conditional caching (ETag/304); no server-side database cache is present. Notifications are derived read-time deltas, not a collection.
- **Async/background:** No cron, worker, queue, webhook, or durable notification generator was found. Navbar notification polling runs in the browser every 60 seconds.

## 4. Data Model / Relationships

### User (`users`)

Required `name`, unique required `email`, required `passwordHash` (excluded from normal selection), role enum, active flag, token version, hidden mutation anchors, bounded refresh-token/hash arrays, and embedded favorite Listing ObjectIds. Timestamps are enabled. JSON serialization removes password and token material. Indexes: unique/explicit email index.

### Listing (`listings`)

Required title/locality/numeric valuation fields; enum property type/availability; optional coordinates, creator, images, and description; nullable `deletedAt` is the lifecycle source of truth. Missing or null is active; a Date is archived. Indexes cover city, locality, property type, BHK, price, listed date, and locality/price.

### Prediction (`predictions`)

Stores validated input/output snapshots, optional owner, locality, anonymous flag, hashed share token, share expiry/revocation, and TTL `expiresAt`. Public access requires a valid high-entropy token, or bounded legacy ObjectId grace for genuinely legacy records.

### SavedSearch (`savedsearches`)

Required owner, name, and `filters` Object; `lastNotifiedCount` is a derived-alert anchor. Indexes: owner and `{ user: 1, createdAt: -1 }`. Current supported creation is transactionally quota-checked.

### Inquiry (`inquiries`)

Required owner/listing/message, status enum (`new`, `contacted`, `closed`), timestamps, and user/listing/status queue indexes. MongoDB references are not foreign keys.

### SecurityEvent (`securityevents`)

Required type, optional legacy/normalized actor-target-resource fields, request metadata, and TTL `createdAt`. New metadata is allowlisted and responses are sanitized. Persistence is best-effort and separate from business mutations.

There is **no Notification collection**. The notification page derives saved-search match deltas and inquiry status records.

## 5. Critical Workflows

| Workflow | Persistence path | Concurrent-request behavior | Crash/partial-write behavior |
|---|---|---|---|
| Signup/login | User lookup, password work, token hash update, save | Unique email protects signup uniqueness; concurrent login saves can invalidate an earlier session by design | Login writes user before cookies/audit response; audit is best-effort. |
| Refresh | JWT/version/hash validation, conditional `User.updateOne` rotation | Atomic token/version predicate permits one winner; reuse invalidates the account | No document `save()` rotation race remains. |
| Password/admin invalidation | User mutation, tokenVersion increment, refresh arrays cleared | Admin last-admin changes use a transaction; ordinary self password change is a single document save | Security event is post-success and best-effort. |
| Listing archive/restore | Conditional `findOneAndUpdate` on `deletedAt` | Conditional lifecycle filters make archive/restore idempotently bounded | References remain by design; no cascade/purge. |
| Favorites | Active listing existence, atomic `$addToSet` admission on User | Duplicate add is idempotent; cap predicate is atomic | Listing check can race with archive, but the write is still user-scoped and later reads exclude archived listings. |
| SavedSearch create | Transaction: anchor user, count owner records, count active matches, create | Shared user anchor serializes quota admission when Mongo transactions are available | Transaction aborts all writes; standalone Mongo fails closed. |
| SavedSearch mark-notified | Owner lookup, listing count, document save | Concurrent calls can overwrite with an older derived count | Only the derived alert anchor can be stale; filters are not rewritten. |
| Inquiry create/status | Active listing check then Inquiry create; admin status update with validators | Repeated valid creates are allowed by current contract; status update is owner-independent but admin-protected | Listing check and create are separate; an archive between them can still leave a historical inquiry, which is preserved by lifecycle policy. |
| Notifications | Read-time saved-search aggregation plus inquiry reads | Browser sources load independently; navbar polling is 60 seconds | No durable notification write or duplicate-delivery side effect exists. |
| Account deletion | `Promise.all` deletes Prediction/SavedSearch/Inquiry then User | Concurrent account operations are not transactionally coordinated | A process/DB failure can leave partial deletion or references to a deleted user. |

## 6. Findings

### [DB-001] Historical SavedSearch documents violate the current filters contract

**Severity:** Medium
**Confidence:** High
**Location:** `SavedSearch` model, `savedSearch.controller.js:listSaved`, production `GET /api/saved-searches` response
**Evidence:** Four observed production documents are missing `filters` entirely:

1. `[REDACTED-PRODUCTION-ID-1]`
2. `[REDACTED-PRODUCTION-ID-2]`
3. `[REDACTED-PRODUCTION-ID-3]`
4. `[REDACTED-PRODUCTION-ID-4]`

The current Mongoose schema declares `filters` required (`backend-api/src/models/SavedSearch.js:5-8`), the POST validator is strict (`backend-api/src/validators/savedSearch.schema.js`), and `createSaved` passes `req.body.filters` into `SavedSearch.create` inside a transaction (`savedSearch.controller.js:30-43`). Repository search found no alternate SavedSearch writer, direct collection write, `$unset`, replacement update, or background creator.

**Failure Scenario:** The frontend strict runtime schema rejects the list response and displays a controlled recovery error. A malformed `filters: null` document could also make query construction unsafe; the known records omit the field and are not silently repaired.

**Impact:** Affected users cannot render the affected saved-search list. Original filter intent is not recoverable from the remaining fields; replacing it with `{}` would create a different search and could generate misleading match counts.

**Existing Protection:** Current writes require bounded supported filters; frontend validation rejects missing/invalid filters; ownership and quota checks remain active.

**Why Protection Is Insufficient:** Mongoose validation applies to current model writes, not historical documents created before the contract or by an unobserved external path.

**Minimum Safe Fix:** No automatic data mutation. Preserve records pending explicit decision; recreate only when original filters are known; otherwise archive/delete only after explicit approval and a separately documented recovery decision. Keep strict frontend validation.

**Migration Required:** No automatic migration; unknown/conditional if a separately approved data-recovery operation is chosen.
**Data Cleanup Required:** No; only after explicit approval.
**Production Verification Required:** Yes, read-only inventory of remaining malformed records and writer/deployment identity.

### [DB-002] Account deletion is not all-or-nothing

**Severity:** Medium
**Confidence:** High
**Location:** `backend-api/src/controllers/auth.controller.js:258-266`, `DELETE /api/auth/me`
**Evidence:** Prediction, SavedSearch, and Inquiry deletes plus `User.findByIdAndDelete` run in `Promise.all` without a shared session/transaction.

**Failure Scenario:** One collection delete succeeds, another times out, and the process exits before all operations complete.

**Impact:** Partial account deletion, residual records, or references to a deleted user. This is a destructive workflow consistency risk, not an authorization bypass.

**Existing Protection:** The route is authenticated, last-admin deletion is guarded, and each delete is owner-scoped.

**Why Protection Is Insufficient:** Authentication and scoping do not provide atomicity across collections.

**Minimum Safe Fix:** If product requires all-or-nothing deletion, execute the existing deletes in a transaction and fail closed when transaction capability is unavailable. Do not add a migration or cascade policy implicitly.

**Migration Required:** No.
**Data Cleanup Required:** Only for explicitly approved partial-deletion cases.
**Production Verification Required:** Yes, in an isolated transaction-capable environment before any change.

### [DB-003] Derived saved-search acknowledgement can regress under concurrency

**Severity:** Low
**Confidence:** Medium
**Location:** `backend-api/src/controllers/savedSearch.controller.js:60-65`, `POST /api/saved-searches/:id/mark-notified`
**Evidence:** The controller reads a saved search, counts current listings, assigns `lastNotifiedCount`, and calls `save()` as separate operations. Two requests can complete out of order.

**Failure Scenario:** Request A counts an older listing state, request B counts a newer state and saves first, then A saves its older count.

**Impact:** A subsequent read can show repeated or missing new-match deltas. Filter ownership and saved-search content are not changed.

**Existing Protection:** Owner filter is applied on lookup; the operation is user-triggered and the count is bounded by active listing queries.

**Why Protection Is Insufficient:** There is no conditional version/monotonic update for the derived acknowledgement value.

**Minimum Safe Fix:** Measure whether duplicate alert deltas occur in production; if necessary, use a conditional atomic update or monotonic acknowledgement rule. Do not introduce a distributed lock.

**Migration Required:** No.
**Data Cleanup Required:** No.
**Production Verification Required:** Yes, only if user-visible duplicate/missed deltas are observed.

### [DB-004] Production index and backup posture is not repository-verifiable

**Severity:** Low
**Confidence:** High
**Location:** MongoDB Atlas deployment configuration outside the repository
**Evidence:** Models declare indexes, but no production `listIndexes` output, Atlas backup/PITR setting, restore drill, RPO, or RTO evidence is available. `docs/DATABASE.md` explicitly says provider backup/restore procedures must be used and verified separately.

**Failure Scenario:** A declared index is absent or a restore point is unavailable during an incident.

**Impact:** Query degradation or inability to recover data; no current production failure is proven.

**Existing Protection:** Schema declarations and documented Atlas assumptions provide an intended baseline.

**Why Protection Is Insufficient:** Mongoose declarations do not prove live index state or provider backup configuration.

**Minimum Safe Fix:** Read-only provider verification of indexes, backup retention, PITR, and a tested restore procedure. Do not add speculative indexes or alter retention in this audit.

**Migration Required:** Unknown for provider-side index drift; no application migration is justified by this audit.
**Data Cleanup Required:** No.
**Production Verification Required:** Yes.

### [DB-005] Destructive seed scripts require operational isolation

**Severity:** Low
**Confidence:** High
**Location:** `backend-api/src/seed/seed.js:52-64`, `npm run seed`
**Evidence:** The seed deletes all `User` and `Listing` documents before creating seed data. Documentation warns that it is destructive and can leave dependent collections untouched.

**Failure Scenario:** An operator runs the seed command with a production/shared `MONGODB_URI`.

**Impact:** Active users/listings are deleted and dependent Prediction/SavedSearch/Inquiry references can remain.

**Existing Protection:** Explicit runtime credentials, documentation warnings, and no automatic deployment hook were found.

**Why Protection Is Insufficient:** The command remains executable against any URI supplied to the process.

**Minimum Safe Fix:** Operationally prohibit production execution and require a disposable database/runbook. A code-level guard is a separate approved change, not part of this audit.

**Migration Required:** No.
**Data Cleanup Required:** Only if an operator violates the documented procedure.
**Production Verification Required:** No application verification; provider/runbook verification is recommended.

## 7. Critical Areas Summary

- **Favorites:** Current working-tree implementation uses active-listing validation, atomic `$addToSet` admission, a configured cap, and bounded responses. Embedded archived references are retained intentionally. No cross-user access path was found.
- **Saved Searches:** Current writer is strict and transactional for quota. The four malformed production records are historical data evidence, not proof of a current writer defect. `listSaved` computes counts in one bounded `$facet`, with at most the configured quota's number of branches.
- **Inquiries:** Creation requires authentication, a valid active listing, and a 10–1000 character message. Reads are owner-scoped/paginated; admin status changes are role-protected, enum-validated, ObjectId-validated, and audited. Duplicate submissions are allowed by contract; no duplicate invariant is asserted.
- **Notifications:** No database entity or delivery side effect exists. Derived reads are independently loaded in the frontend, and polling is bounded. There is no durable read/unread state or retention collection to corrupt.
- **Predictions/shares:** Required model outputs and TTL are present; share hashes are stored rather than raw tokens, with expiry/revocation checks. These paths were inspected for relationship/retention impact and no new integrity defect was confirmed.
- **Listings:** Archive uses `deletedAt`; public queries use the active predicate and preserve historical references. No hard-delete listing path was found.

## 8. Existing Protections

Verified in current source/tests and preserved from earlier phases:

- HttpOnly access/refresh cookies, CSRF double-submit protection, secure production cookie configuration, refresh rotation/reuse detection, and token-version invalidation.
- Server-side RBAC and owner filters; frontend guards are not treated as security controls.
- ObjectId validation before listing/detail/inquiry/admin mutation access.
- Strict saved-search and listing query validation; unknown fields/operators are rejected; regex input is escaped.
- Atomic favorite admission and `$addToSet` duplicate idempotency in the current working tree.
- Transactional saved-search quota admission with fail-closed standalone-Mongo handling.
- Archived listing exclusion from public discovery, detail/deal, compare, trends, maps, locality options, and saved-search counts.
- Bounded pagination and stable ordering for listing, inquiry, admin, and security-event queues.
- Runtime frontend schemas for saved searches, favorites, inquiries, listings, and compare responses.
- SecurityEvent actor/target normalization, metadata allowlisting, redaction, request IDs, and TTL retention.
- ML service authentication, bounded timeouts, safe upstream error classification, and no raw upstream detail in responses.
- Existing tests: `backend-api/npm test` passed **80/80** in this audit run.

## 9. Production vs Local Verification

| Area | Classification | Evidence/condition |
|---|---|---|
| SavedSearch malformed records | **Verified in production** | Authenticated production GET previously returned 7 items; 4 lacked `filters` and are listed in DB-001. |
| Current SavedSearch writer/validator | **Code-level and locally verified** | Repository route, validator, controller, model, and tests require/persist filters. |
| Favorite atomic cap/quota | **Code-level; local tests verified** | Current working tree tests cover admission predicate and bounded responses; live production data was not queried. |
| SavedSearch transaction capability | **Provider-side unverified** | No production session/transaction probe was performed in this audit. |
| Live index presence | **Provider-side unverified** | Model declarations were inspected; no production `listIndexes` access was used. |
| Atlas backups/PITR/restore | **Provider-side unverified** | No provider console/API evidence was available. |
| Backend test suite | **Verified locally** | 80/80 pass; tests use mocks/isolated behavior and do not prove production topology. |
| Production database mutation | **Not performed** | No production DB connection, seed, migration, update, delete, or cleanup was run. |

## 10. Migration/Backup/Recovery Assessment

- There is no migration framework, schema-version ledger, or executable backup/restore feature.
- The known malformed SavedSearch records must not be backfilled with guessed filters or `{}`. Missing intent is not derivable from name/count/timestamps.
- Any future schema-breaking change should deploy backward-compatible readers first, then writers, and use a reviewed migration with backup and restore evidence.
- Atlas backup retention, PITR, restore testing, RPO, and RTO remain provider-side conditions and require explicit operational verification.
- TTL indexes on Prediction and SecurityEvent are application-declared. Their live presence and exact provider behavior remain unverified here.

## 11. Priority Fix Plan

### MUST FIX BEFORE PRODUCTION

**None proven.** No Critical or High database-integrity finding was confirmed.

### SHOULD FIX (Medium)

1. **Account deletion atomicity (DB-002):** If all-or-nothing deletion is a product requirement, implement a transaction-backed deletion path in `auth.controller.js`, add isolated failure/concurrency tests, and fail closed when transactions are unavailable. Verify on a disposable replica set before production use. No cleanup is authorized by this audit.
2. **SavedSearch incident decision (DB-001):** Keep the four records preserved. Decide explicitly whether any can be recreated from independently verified user input; otherwise archive/delete only through a separately approved data operation. Maintain strict frontend rejection.

### OPTIONAL HARDENING (Low)

1. Measure and, only if observed, harden `markNotified` acknowledgement monotonicity (DB-003).
2. Perform provider read-only index/backup/PITR verification (DB-004).
3. Maintain a production-safe seed runbook or add a separately approved environment guard (DB-005).

## 12. Recommended Implementation Slices

### Slice DB-1 — SavedSearch incident disposition

- **Objective:** Resolve the four known records only after explicit data-owner approval.
- **Findings:** DB-001.
- **Likely files/areas:** Operational data decision; no code file required unless a reviewed recovery workflow is approved.
- **Database impact:** Potentially four-record, individually reviewed operation; no mass update.
- **Migration risk:** High if filters are invented; avoid by preserving records.
- **Tests:** Read-only inventory and response behavior; any approved recreation must verify exact user-supplied filters.
- **Production verification:** Required, with audit log and rollback/export plan.

### Slice DB-2 — Transactional account deletion (conditional)

- **Objective:** Make the existing destructive account deletion all-or-nothing.
- **Findings:** DB-002.
- **Likely files:** `backend-api/src/controllers/auth.controller.js`, focused auth/database tests, API/database documentation.
- **Database impact:** Transaction only; no schema migration.
- **Migration risk:** Requires transaction-capable deployment; fail closed otherwise.
- **Tests:** Failure injection between collection deletes, transaction abort, authorization, last-admin protection.
- **Production verification:** Disposable replica set first; then provider capability confirmation.

### Slice DB-3 — Derived acknowledgement race (measurement-gated)

- **Objective:** Prevent stale `lastNotifiedCount` only if duplicate/missed deltas are observed.
- **Findings:** DB-003.
- **Likely files:** `savedSearch.controller.js` and focused tests.
- **Database impact:** Atomic conditional update; no migration.
- **Migration risk:** Low.
- **Tests:** Out-of-order concurrent mark-notified calls.
- **Production verification:** Metrics or reproducible user-visible evidence required before implementation.

### Slice DB-4 — Provider recovery verification

- **Objective:** Confirm live indexes, backups/PITR, restore procedure, RPO, and RTO.
- **Findings:** DB-004.
- **Likely files:** None; provider/runbook evidence.
- **Database impact:** Read-only inspection and disposable restore test only.
- **Migration risk:** None for inspection.
- **Tests:** Restore validation against an isolated copy.
- **Production verification:** Required by operations, without changing application data.

## 13. Approval Gate

**OVERALL VERDICT: READY FOR IMPLEMENTATION**

Approval is required before any code change, index change, migration, or production data disposition. The first safe action is DB-1's explicit decision; no record repair is implied. DB-2 is conditional and should be implemented only if product requires atomic account deletion.

## 14. Safety / Change Record

- Baseline branch: `main`
- HEAD: `5c23772b29704836cf327bc0834de0bfd0cc522a`
- `origin/main`: `5c23772b29704836cf327bc0834de0bfd0cc522a`
- Worktree: intentionally dirty with pre-existing tracked/untracked Phase 2–6 work; preserved.
- This audit created only this document.
- No application code, schema, index, migration, configuration, dependency, or test file was modified.
- No production/shared MongoDB was accessed or modified.
- No seed, migration, delete, update, archive, recreate, deploy, stage, commit, or push operation was performed by the audit.

**NO CODE OR DATABASE CHANGES WERE PERFORMED.**
