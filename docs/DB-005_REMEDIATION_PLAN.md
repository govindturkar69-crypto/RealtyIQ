# DB-005 Remediation Plan

## 1. Scope

This plan addresses only the three verified DB-005 findings:

- DB-005-01: destructive/privileged CLI operations accept an arbitrary
  production-capable MongoDB URI and the tracked seed contains static credentials.
- DB-005-02: the seed reset is non-transactional and deletes only users/listings.
- DB-005-03: direct CLI account mutations bypass the normal HTTP RBAC/audit boundary.

This is planning only. No application, configuration, database, provider, or
worktree file was changed by the planning work except this document.

Baseline verified before planning:

- Branch: `main`
- HEAD/origin: `e14d13acadf25c2fb33b328ce5819c5a8fc4954f`
- Existing worktree entries: 117, including the pre-existing DB-005 audit and
  other unrelated dirty/untracked work.
- Atlas/provider access: unavailable; transaction and provider state remain unverified.

## 2. Findings Being Remediated

### DB-005-01 — P1

`backend-api/src/seed/seed.js` calls `connectDB()` and then executes
`User.deleteMany({})` and `Listing.deleteMany({})` without checking production
mode, URI host, database name, disposable-target identity, or an explicit operator
confirmation. `seed-users.js`, `set-password.js`, and the working-tree-only
`bootstrap-admin.js` likewise connect to the arbitrary `MONGODB_URI`. HEAD also
contains static seed credentials in code/docs. `env.js` validates presence and
strength of runtime secrets, but not the safety of a CLI database target.

### DB-005-02 — P2

The seed performs two deletes followed by independent creates/inserts. A failure
after deletion can leave a partial database, and dependent Prediction,
SavedSearch, and Inquiry documents are intentionally not cleared. This is unsafe
for a shared database but not evidence that a transaction is required for the
supported disposable-database workflow.

### DB-005-03 — P2

`seed-users.js` and `set-password.js` directly save User documents without HTTP
authentication/RBAC or a bounded SecurityEvent. The dirty working tree's
`bootstrap-admin.js` records an event, but that implementation is not in HEAD and
still lacks a target guard. These are operator tools, not public API operations;
creating a new HTTP endpoint would expand scope without improving the trust boundary.

## 3. Current Architecture

The relevant call path is:

`CLI script → env.js → db.js/mongoose.connect(MONGODB_URI) → User/Listing model writes`.

Tracked commands are `npm run seed`, `npm start`, `npm test`, and `npm run dev`.
The working tree adds `npm run bootstrap-admin`; its script and helper are untracked.
`seed-users.js` and `set-password.js` are manually runnable Node scripts but have no
package aliases. Render uses `npm install`/`npm start`; the backend Docker image also
starts only `src/server.js`. No lifecycle hook, CI workflow, or deployment hook invokes
seed/bootstrap automatically.

The default local Docker target is `mongodb://mongo:27017/realtyiq`, while Render
receives `MONGODB_URI` as a provider-managed secret. The current Compose file sets
`NODE_ENV=production` even though its Mongo target is local, so a guard that blindly
rejects every production-mode process would break the documented local Compose seed
workflow. The guard must evaluate mode, target, and explicit operator intent together.

## 4. DB-005-01 Plan

### Root cause

The scripts trust an arbitrary URI and treat valid credentials as sufficient
authorization to write. There is no shared pre-connect safety boundary. HEAD also
publishes predictable seed credentials and a deployment instruction that historically
allowed `npm run seed` from a Render Shell.

### Minimum safe remediation

Add one small shared CLI-only guard, called **before any MongoDB connection**, and reuse
it from every seed/privileged script. It must fail closed unless all of the following
hold:

1. The operation is explicitly identified as a CLI operation; normal `npm start` must
   never call the guard.
2. The target is demonstrably disposable/local. Accept only loopback or the known local
   Compose hostname (`127.0.0.1`, `localhost`, or `mongo`) and a non-production disposable
   database name. Reject `mongodb+srv` and public/Atlas hosts for these commands.
3. The database name is an allowlisted disposable name. The local Compose exception must
   be explicit because Compose currently sets `NODE_ENV=production`; it should require a
   dedicated disposable marker and exact confirmation value rather than relying on
   `NODE_ENV` alone.
4. `NODE_ENV=production` is rejected for any non-local/public target. A local Compose
   target in production mode is accepted only with the dedicated disposable marker and
   exact confirmation, so production credentials cannot be reused accidentally.
5. A separate, deliberate opt-in/confirmation is present for destructive seed and for
   privileged account mutation. Missing, malformed, or contradictory markers fail closed.
6. The guard parses the URI without logging it or exposing credentials, and runs before
   `mongoose.connect`; a rejected target must perform no database I/O.

This is intentionally stricter than a single `NODE_ENV` check. It makes production
execution inconvenient by design. A remote disposable Atlas database is not a supported
shortcut; it requires a separately reviewed operational process rather than a flag that
could also enable production.

### Static credential removal

Replace the tracked seed's hard-coded admin/demo values with runtime-only credentials,
using the existing `bootstrapAdminCredentials` validation pattern. Remove credential
values from tracked README/deployment examples and describe placeholders/runbook steps
without reproducing any secret. Do not write credentials to logs. Existing users or
production accounts must not be rotated or changed as part of this implementation.

### Mandatory vs optional

Mandatory before permitting any production-capable CLI write. The target guard and
credential removal are the minimum P1 closure; documentation/runbook updates are part of
the same safety change because HEAD currently gives an unsafe Render Shell instruction.

### Compatibility

- Local loopback and Docker Compose seed workflows remain available only with explicit
  disposable markers.
- `npm start` and HTTP application startup remain unchanged.
- Production Render Shell execution of the generic seed is intentionally blocked.
  If production administrator provisioning is genuinely required, it must use a separate,
  explicitly approved break-glass runbook rather than making `npm run seed` convenient.
- No schema, index, or data migration is required.

## 5. DB-005-02 Plan

### Root cause and decision

The reset sequence is not all-or-nothing, but the supported use case is a disposable
database. Adding a transaction would not repair the unsafe target and would introduce a
provider capability dependency that DB-004 currently classifies as unverified. It could
also tempt operators to use the seed against a shared database.

**Decision: do not add a transaction or broaden deletion scope in this remediation.**

The target guard is the safety boundary. Keep the existing user/listing deletion semantics
and keep dependent collections untouched; do not invent cascade semantics for
Prediction/SavedSearch/Inquiry. Pre-connection CSV parsing/validation should remain before
the delete so malformed input fails before any write.

If a future product requirement demands an all-or-nothing reset, it must be a separate
approved slice with an isolated database, explicit collection semantics, backup/restore
plan, and provider transaction verification. Atlas transaction capability remains
**UNVERIFIED** here.

### Mandatory vs optional

The no-transaction decision is mandatory for this scope. A future transactional reset is
optional and out of scope until measured product need exists.

### Compatibility and risk

No runtime behavior changes for normal API users. The remaining risk is partial state if
an operator bypasses the guard or if a future approved disposable reset fails mid-run;
the guard makes that an explicit, bounded test environment concern rather than a
production data-loss path.

## 6. DB-005-03 Plan

### Legitimate tools

- Keep `bootstrap-admin` as a one-time controlled provisioning tool, but make it
  non-production by default, target-guarded, and explicitly audited.
- Keep `set-password` only as a break-glass local/operator utility if it is still
  required; apply the same target guard and record a bounded CLI security event with
  `actorUserId: null`, `source: cli`, action, target user id, and result. Never include
  passwords, tokens, or full URIs.
- Treat `seed-users.js` as a legacy helper. Either remove it from the supported runbook
  or retain it only behind the same guard and audit event. Do not add an HTTP endpoint
  solely to imitate it.
- Seed-created accounts remain disposable-data behavior; they must use runtime-only
  credentials and a bounded audit event only if the implementation can preserve the
  disposable-target guarantee without adding noisy production events.

### Security semantics

The guard is not a replacement for HTTP RBAC. It protects the operator boundary; the
existing last-admin and role/status protections remain unchanged for HTTP admin routes.
The CLI must refuse unsafe target/mode combinations before loading or mutating users.
Bootstrap must continue refusing promotion of an existing non-admin, and password
mutation must remain explicit by email argument with no implicit account selection.

### Mandatory vs optional

Guarding every retained privileged CLI writer is mandatory with DB-005-01. Adding bounded
SecurityEvents to `set-password`/`seed-users` is required if those tools remain supported;
retiring redundant `seed-users.js` is optional but preferred to reduce the number of
privileged entry points.

### Compatibility

Existing HTTP administration, authentication, CSRF, token-version invalidation, and
last-admin behavior are unchanged. Operators must adopt the explicit local/disposable
runbook and cannot use these scripts as an unattended production shortcut.

## 7. Exact Files Expected to Change

The eventual implementation should be limited to the following, with mixed dirty files
staged at hunk level and unrelated Phase 6 work preserved:

### Code

- `backend-api/src/utils/cliDbGuard.js` — new shared pre-connect target/mode/confirmation
  guard; no database access.
- `backend-api/src/seed/seed.js` — invoke the guard before `connectDB`; use runtime-only
  validated credentials; preserve collection semantics.
- `backend-api/src/scripts/seed-users.js` — invoke the guard; remove static credentials;
  retain or explicitly deprecate the helper; add bounded audit event if retained.
- `backend-api/src/scripts/set-password.js` — invoke the guard; add bounded success/failure
  audit event if retained; preserve explicit target selection.
- `backend-api/src/scripts/bootstrap-admin.js` — if this working-tree-only tool remains
  supported, invoke the guard and preserve its existing safe credential validation/event.
- `backend-api/src/utils/bootstrapAdmin.js` — only if shared validation needs a minimal
  change; do not mix unrelated auth work.
- `backend-api/package.json` — only if the bootstrap command is intentionally retained;
  otherwise do not add a new script merely for this remediation.

### Documentation/configuration

- `backend-api/README.md`
- `DEPLOYMENT.md`
- `README.md`
- `TESTING.md`
- `backend-api/.env.example`

Only seed/bootstrap instructions and placeholder credential guidance should change in these
files. No production environment values, provider settings, schemas, indexes, migrations,
or application startup configuration should change.

### Tests

- `backend-api/src/test/cliDbGuard.test.js` — new unit tests for guard decisions and
  no-connect-on-rejection behavior.
- `backend-api/src/test/security.test.js` — only if the existing credential/CLI security
  assertions can be extended without unrelated hunk changes.

## 8. Test Plan

### Unit/static tests

1. Reject `NODE_ENV=production` with a public/Atlas URI.
2. Reject `mongodb+srv` and non-allowlisted hosts for destructive/privileged CLI use.
3. Reject missing/incorrect disposable database name.
4. Reject missing or incorrect explicit disposable confirmation/opt-in.
5. Accept only the documented loopback/Compose target with all required markers.
6. Prove a rejected target fails before `mongoose.connect` is called.
7. Prove seed has no static credentials and requires validated runtime credentials.
8. Prove bootstrap refuses promotion of an existing non-admin and emits redacted audit
   metadata when retained.
9. Prove set-password/seed-users never log passwords or connection strings.
10. Prove `npm start` does not invoke the CLI guard or any seed writer.

### Disposable integration tests

Only if an isolated local MongoDB/replica set can be positively identified:

- run seed against a disposable database with unique data;
- verify expected users/listings and no writes outside the allowlisted database;
- run bootstrap/password utility against disposable users;
- verify idempotency/refusal behavior and SecurityEvents;
- simulate a mid-seed failure and document the expected partial disposable state.

If the target cannot be proven disposable: `NOT RUN — isolated disposable database unavailable`.
Never substitute Atlas or shared development data.

Required verification commands after implementation: backend focused tests, full
`npm test`, `git diff --check`, and a staged/diff review. Frontend/ML tests are not required
unless their files are accidentally touched; avoid touching them.

## 9. Deployment/Operational Impact

- No database migration, index change, seed run, or provider setting change.
- Render build/start remains `npm install`/`npm start`; no automatic database writer is added.
- Production operators must stop using the documented Render Shell seed path.
- Local Docker/Compose instructions must include the explicit disposable marker and exact
  confirmation, or use a development-mode process that still passes target validation.
- Production administrator provisioning, if still required, needs an explicitly approved
  break-glass process outside the generic seed command. The plan intentionally does not make
  production execution convenient.
- Atlas transaction support, backups, PITR, and live indexes remain provider-side
  **UNVERIFIED** and are not changed here.

## 10. Data/Migration Impact

- No production data operation is authorized or required.
- No migration, backfill, index, TTL, or schema change.
- The four malformed SavedSearch records remain untouched; DB-001 is out of scope.
- DB-002 account-deletion transaction behavior is not modified.
- DB-003 notification acknowledgement behavior and DB-004 provider verification are not
  modified.

## 11. Compatibility Risks

1. Existing scripts run with `NODE_ENV=production` in local Compose; blindly rejecting that
   value would break local workflows. The explicit local target exception must therefore be
   narrowly host/database/confirmation bound.
2. Removing static demo credentials may break README smoke tests that rely on them; update
   those instructions to create runtime-only accounts instead of preserving defaults.
3. The untracked bootstrap files are not in clean HEAD. They must not be assumed deployable
   until separately reviewed and committed.
4. Retiring `seed-users.js` could affect undocumented operators; first search runbooks and
   deployment history, then deprecate only with an explicit replacement.
5. A future remote disposable database workflow may be blocked by the strict URI policy;
   that is intentional and requires separate approval rather than a permissive bypass.

## 12. Safety Gates

Before implementation:

- Reconfirm HEAD/origin and record all dirty/untracked paths.
- Approve exact file/hunk scope; do not overwrite mixed dirty files.
- Confirm no production DB connection is needed.

During implementation:

- Guard before every CLI `connect` call.
- Never print URI, password, token, or confirmation value.
- Never run seed/bootstrap/password utilities against Atlas or shared development DB.
- Keep application startup and HTTP security unchanged.

After implementation:

- Run focused guard/credential/audit tests and full backend tests.
- Run disposable integration tests only with a proven isolated target.
- Review `git diff --check`, exact changed files, and uncommitted unrelated hunks.
- Perform a read-only security review of target parsing, bypasses, logs, and audit metadata.
- Require explicit deployment approval; no commit/push/deploy is implied by this plan.

## 13. Implementation Order

1. Add and unit-test the shared CLI target guard with no DB connection.
2. Remove static credentials and wire the guard into `seed.js`.
3. Wire the guard and bounded audit behavior into retained account utilities;
   decide whether `seed-users.js` remains supported before editing it.
4. Update only the affected runbooks/examples to remove unsafe production seed guidance.
5. Run focused tests, then the full backend suite and disposable integration checks if
   available.
6. Perform final diff/security/worktree review. Stop for separate commit/deployment approval.

## 14. Explicit Non-Goals

- No production seed/bootstrap/password execution.
- No production-data repair, deletion, archive, migration, or cleanup.
- No transaction, index, schema, TTL, backup, PITR, or Atlas setting changes.
- No changes to DB-001, DB-002, DB-003, or DB-004.
- No HTTP endpoint replacing a CLI tool.
- No Redis, queues, workers, locks, or new infrastructure.
- No unrelated security/auth/frontend/ML refactoring.

## 15. Approval Gate

This document is an implementation plan only. Explicit approval is required before any
code/documentation/configuration change beyond this plan. Atlas/provider transaction and
recovery capabilities remain unverified. The approved implementation must preserve all
existing dirty/untracked work and must fail closed rather than make production seeding
easier.

**NO CODE OR DATABASE CHANGES WERE PERFORMED.**
