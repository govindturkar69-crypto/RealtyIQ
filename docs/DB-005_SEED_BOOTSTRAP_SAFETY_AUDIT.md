# DB-005 Seed & Bootstrap Safety Audit

## 1. Scope

Read-only forensic review of database-writing seed, bootstrap, fixture, reset,
initialization, deployment, Docker, and test paths. No seed, bootstrap,
migration, provider command, or database connection was executed by this audit.
Production data and the existing dirty worktree were left untouched.

## 2. Repository Baseline

- Branch: `main`
- HEAD: `e14d13acadf25c2fb33b328ce5819c5a8fc4954f`
- `origin/main`: `e14d13acadf25c2fb33b328ce5819c5a8fc4954f`
- Pre-existing dirty/untracked entries at audit start: **116**
- Current worktree entries after adding this report: **117** (the additional entry is this untracked report).
- No files were reset, cleaned, staged, committed, pushed, or deleted.

The tracked release and the working tree differ. In particular, `backend-api/package.json`
has an uncommitted `bootstrap-admin` script, and the corresponding bootstrap files are
untracked. They are analyzed below but are not part of HEAD/origin and are not deployable
from a clean checkout.

## 3. Database-Writing Mechanisms

Repository-wide searches found these relevant writers:

| Mechanism | Entry point | Collections/effect | Destructive? | Automatic? |
|---|---|---|---|---|
| Seed | `backend-api/src/seed/seed.js` | `User.deleteMany({})`, `Listing.deleteMany({})`, then creates admin/demo users and `Listing.insertMany` | **Yes**; deletes every user and listing in the selected database | No |
| User seed helper | `backend-api/src/scripts/seed-users.js` | Creates or updates the two hard-coded seed accounts; sets passwords | No bulk delete, but privileged credential/role mutation | No package hook; manual `node` invocation |
| Password utility | `backend-api/src/scripts/set-password.js` | Finds an arbitrary email and saves a new password | No, but privileged account mutation | No package hook; manual `node` invocation |
| Admin bootstrap (working tree only) | `backend-api/src/scripts/bootstrap-admin.js` → `utils/bootstrapAdmin.js` | Creates or updates one administrator, activates it, increments token version, clears refresh state | Not destructive to collections; privileged mutation | No; package script is uncommitted |
| Application workflows | Controllers under `backend-api/src/controllers` | Normal user/listing/prediction/inquiry/saved-search/auth writes | Product operations, not seed/reset mechanisms | HTTP-driven |

No `dropDatabase`, `dropCollection`, collection-level drop, migration runner, fixture loader,
reset command, or bulk purge beyond the seed's two `deleteMany` calls was found. ML dataset
and training scripts write local files/dataframes, not MongoDB.

## 4. Package Script Analysis

The tracked HEAD `backend-api/package.json` exposes `start`, `dev`, `seed`, and `test`.
The working tree additionally (but uncommitted) exposes `bootstrap-admin`. Frontend has only
Next.js development/build/lint/start scripts; ML has no npm database scripts.

| Script/command | Entry point | Writes DB? | Destructive? | Production guard? |
|---|---|---:|---:|---|
| `npm run seed` (tracked) | `src/seed/seed.js` | Yes | **Yes** (`User.deleteMany`, `Listing.deleteMany`) | **No**; only credential/input checks |
| `npm run bootstrap-admin` (working tree only) | `src/scripts/bootstrap-admin.js` | Yes | No collection purge; creates/rotates an admin | **No** explicit production/target guard |
| `node src/scripts/seed-users.js` (tracked, no package alias) | `seed-users.js` | Yes | No bulk delete | **No** |
| `node src/scripts/set-password.js ...` (tracked, no package alias) | `set-password.js` | Yes | No | **No** |
| `npm start` | `src/server.js` | Connects only; no seed call | No | N/A |
| `npm test` | Node test runner | Current tests do not connect to MongoDB | No | Test isolation is not enforced by a shared target guard |

The tracked seed uses static admin/demo credentials in source and logs a seed summary. The
tracked README/deployment instructions also contain the static demo credential pair; values
are intentionally omitted here. The working-tree edits replace these with runtime-supplied
credentials, but those edits are not in HEAD.

## 5. Seed Script Forensics

`backend-api/src/seed/seed.js:51-101` parses a local CSV, calls `connectDB()` (which uses
`env.mongoUri`), deletes **all** `User` and `Listing` documents, creates an admin and demo
user, inserts up to 600 listings, and disconnects. Mongoose validation applies to the creates,
but there is no transaction around the delete/recreate sequence and no check of `NODE_ENV`,
MongoDB host, database name, disposable-database marker, or explicit confirmation.

The script therefore accepts any valid `MONGODB_URI`, including an Atlas production URI. The
tracked `DEPLOYMENT.md` explicitly instructs an operator to run `npm run seed` from the Render
API Shell, which makes this a documented production-capable path despite warnings elsewhere
that the database should be disposable. It also leaves `Prediction`, `SavedSearch`, and
`Inquiry` documents untouched, so deleting users/listings can leave dangling references.

The current working-tree version adds strong runtime bootstrap/demo credential requirements and
redacts its summary log, but still has no fail-closed production target guard. It is not a
committed or deployable change and was not modified by this audit.

## 6. Bootstrap-Admin Forensics

The current working tree contains `src/scripts/bootstrap-admin.js` and
`src/utils/bootstrapAdmin.js`; both are absent from HEAD. The dirty `package.json` adds the
corresponding command. The utility requires operator-provided email/password (email format and
minimum 16-character password), refuses to promote an existing non-admin, and the script
creates or updates one admin, activates it, increments `tokenVersion`, clears refresh state,
saves, and records an `admin_bootstrap` SecurityEvent. It is idempotent for the same admin but
not a no-op: it resets password/session state on each run.

It connects directly with `mongoose.connect(env.mongoUri)` and has no `NODE_ENV`/URI/database
allowlist or confirmation gate. Thus it **can target production when run from the working tree**
with production `MONGODB_URI`; it is **not present in the clean HEAD deployment**. The required
credentials are runtime-only and are not printed by the script. No real database was contacted.

## 7. Environment Targeting

`backend-api/src/config/env.js:24-44` requires `MONGODB_URI` in production but only checks that
it is non-empty. `backend-api/src/config/db.js:5-8` passes the URI directly to Mongoose and
performs no hostname/database-name validation. Consequently an operator can point any manual
writer at Atlas simply by exporting the production URI; the application cannot distinguish a
disposable database from production.

Tracked `.env` files are gitignored; only placeholder `.env.example` files are tracked.
Render declares `MONGODB_URI` as a manually supplied secret, while Docker Compose sets a local
`mongodb://mongo:27017/realtyiq` URI. Compose is safer by default but an operator can override
environment values when executing a one-off command. No database target allowlist or explicit
destructive-operation confirmation exists.

Classification: **D — production-capable and insufficiently guarded** for the tracked seed,
seed-users, and set-password utilities; the untracked bootstrap is the same when present.

## 8. Automatic Execution Paths

- `npm install`: no `preinstall`, `install`, `postinstall`, `prepare`, or other lifecycle hook
  invokes a database writer.
- `npm start`/Render start: `server.js` connects and starts Express; it does not seed or
  bootstrap.
- Render build is `npm install`; Render start is `npm start`; no seed/bootstrap/migration hook
  is declared in `render.yaml`.
- Backend Dockerfile runs `npm install --omit=dev`, copies files, and starts `src/server.js`.
  Docker Compose starts Mongo, ML, and the API; it does not run seed automatically.
- Vercel builds the frontend only.
- No `.github/workflows` or repository CI workflow was found.
- README/TESTING one-liners are operator commands, not automatic hooks.

Therefore no automatic deployment/startup execution of seed/bootstrap was found. The risk is
manual/operator invocation, not an implicit Render/Vercel lifecycle action.

## 9. Production Safety Boundary

The boundary is weak for destructive/privileged CLI operations:

- `NODE_ENV=production` fail-fast checks protect JWT/ML/Mongo *configuration presence*, not
  seed target safety.
- No `NODE_ENV` rejection, explicit opt-in, URI host rejection, database-name allowlist,
  disposable marker, dry-run, or interactive confirmation is enforced by seed.
- Credentials are required by the current dirty seed/bootstrap versions, but credentials do
  not prove that the target is disposable.
- The tracked HEAD seed has static credentials and the HEAD deployment guide explicitly
  describes seeding the cloud database.

This is not an automatic data-loss event, but a mistaken command can immediately delete active
users/listings. Existing documentation warnings are operator-dependent and are not fail-closed.

## 10. Credential Safety

**Verified:** `.env`/`.env.local` files are gitignored; tracked examples use placeholders; Render
secret fields use `sync: false`/generated values; current logger paths avoid printing passwords.

**Finding:** tracked HEAD `seed.js`, `seed-users.js`, `backend-api/README.md`, and
`DEPLOYMENT.md` contain a static demo/admin credential pair (redacted in this report). If the
seed is run against a reachable deployment, those credentials are known and predictable. The
working-tree hardening removes this default but is not committed. Operators should treat the
published values as compromised and rotate any account created with them; no rotation was
performed here.

## 11. Privileged Account Creation

Normal signup creates a user role. The tracked seed creates an admin after deleting all users;
`seed-users.js` can create the tracked admin account and reset its password; `set-password.js`
can reset any selected user's password without RBAC; the working-tree bootstrap can create or
reset one admin and emits a SecurityEvent. These CLI paths bypass HTTP RBAC by design, are not
automatically invoked, and require filesystem/operator access, but the tracked seed and
seed-users paths do not emit a SecurityEvent for their account mutations. Last-admin protections
in HTTP admin routes do not protect direct CLI writes.

## 12. Test and Fixture Isolation

The Node test suite (run during this audit: **92/92 pass**) uses mocks/pure model checks and does
not call `connectDB()` or execute seed/bootstrap writers. `security.test.js` uses loopback URI
strings only for environment-validation subprocesses. No hard-coded production URI was found.
There is no generic test-time assertion that rejects a production-looking URI if a future
integration test imports a writer. A disposable MongoDB environment was not available and no
seed/bootstrap behavior was executed:

`NOT RUN — isolated disposable database unavailable`

## 13. Docker / Compose Analysis

Compose provisions a local Mongo 7 container with a named local volume and passes the API a
private Compose URI. The backend image runs only `src/server.js`; no entrypoint invokes seed or
bootstrap. The documented `docker compose exec ... npm run seed` is an explicit operator action
against the local Compose database by default. Environment override capability means operators
must still verify the target before running it; no code-level guard prevents substituting an
Atlas URI.

## 14. CI/CD and Deployment Analysis

`render.yaml` defines only the ML Docker web service and the Node API (`npm install`/`npm start`)
with health checks. Vercel configuration is provider-side; no repository deployment hook runs a
database writer. No GitHub Actions or release script was found. The only production-capable
database command documented in the Render workflow is a manual Render Shell invocation.

## 15. Safe Execution Testing

No disposable MongoDB/replica set was available, so no seed, bootstrap, reset, or guard behavior
was executed. Static source analysis is the basis for all findings. The repository test suite
passed without opening a database connection. Production/shared databases were not contacted.

## 16. Findings

### [DB-005-01] Destructive seed and privileged scripts have no fail-closed target guard

- **Severity:** High (P1)
- **Confidence:** High
- **Location:** `backend-api/src/seed/seed.js:51-62`, `src/scripts/seed-users.js:12-29`,
  `src/scripts/set-password.js:12-22`, `config/db.js:5-8`, `npm run seed`
- **Evidence:** Writers use the arbitrary `env.mongoUri`; seed executes `User.deleteMany({})`
  and `Listing.deleteMany({})`; none checks production mode, host, database name, disposable
  marker, or operator confirmation. HEAD docs instruct running seed from Render Shell.
- **Failure Scenario:** An operator runs a documented/manual command while Render's production
  `MONGODB_URI` is in the environment.
- **Impact:** All users/listings can be deleted; known credentials can be recreated; dependent
  collections can be left orphaned. Password utilities can mutate a production account.
- **Existing Protection:** Runtime credential/input checks, environment secret validation for
  application startup, documentation warnings, and absence of automatic hooks.
- **Why Protection Is Insufficient:** None binds the command to a disposable target or fails
  closed when `NODE_ENV=production`/Atlas is selected.
- **Minimum Safe Fix:** Add a shared CLI guard that rejects production by default and requires an
  explicit, reviewed disposable-target marker (with target validation) before any write; remove
  static credentials from tracked seed/docs. Apply the same guard to bootstrap/password utilities.
- **Migration Required:** No.
- **Data Cleanup Required:** Unknown; only if a prior unsafe run occurred.
- **Production Verification Required:** Yes (verify command rejection against a production-like
  environment without connecting to Atlas).

### [DB-005-02] Seed reset is not all-or-nothing and omits dependent collections

- **Severity:** Medium (P2)
- **Confidence:** High
- **Location:** `backend-api/src/seed/seed.js:55-99`
- **Evidence:** Parallel user/listing deletes are followed by separate creates/inserts; no
  transaction and no Prediction/SavedSearch/Inquiry cleanup is performed.
- **Failure Scenario:** Seed fails after deletes (CSV/validation/insert error) or is used against
  a non-disposable database.
- **Impact:** Partial/empty seed state and dangling references.
- **Existing Protection:** Documentation says disposable DB only; no automatic invocation.
- **Why Protection Is Insufficient:** Warnings do not restore deleted data or prevent a partial
  run.
- **Minimum Safe Fix:** Keep seed disposable-only behind DB-005-01 guard; if a transactional
  reset is ever required, design it separately with explicit product approval. Do not add
  cascade semantics here.
- **Migration Required:** No.
- **Data Cleanup Required:** No automatic cleanup authorized.
- **Production Verification Required:** Yes for any future seed change.

### [DB-005-03] CLI account mutations are outside HTTP audit/RBAC boundaries

- **Severity:** Medium (P2)
- **Confidence:** High
- **Location:** `backend-api/src/scripts/seed-users.js`, `src/scripts/set-password.js`, and
  working-tree-only `src/scripts/bootstrap-admin.js`
- **Evidence:** Direct Mongoose saves bypass route authentication/RBAC; tracked scripts do not
  call `recordSecurityEvent`.
- **Failure Scenario:** A host operator with script/URI access resets or creates a privileged
  account without the normal admin workflow.
- **Impact:** Untracked administrative changes and weaker forensic attribution.
- **Existing Protection:** Filesystem/provider access is required; current bootstrap utility
  records an event when present; credentials are runtime-supplied in the dirty version.
- **Why Protection Is Insufficient:** Provider/operator access and environment targeting remain
  the trust boundary; tracked scripts have no explicit audit event.
- **Minimum Safe Fix:** Guard commands as in DB-005-01 and document/emit a bounded CLI audit
  event for any approved privileged mutation.
- **Migration Required:** No.
- **Data Cleanup Required:** Unknown.
- **Production Verification Required:** Yes if commands are changed.

## 17. Risk Classification

| Mechanism | Destructive? | Production-capable? | Guard | Automatic? | Risk |
|---|---:|---:|---|---:|---|
| Tracked `npm run seed` | Yes | Yes | Input checks only; no target guard | No | **P1** |
| Tracked `seed-users.js` | No bulk delete | Yes | None beyond env availability | No | **P2** |
| Tracked `set-password.js` | No | Yes | CLI argument presence only | No | **P2** |
| Working-tree `bootstrap-admin` | No collection purge | Yes when present | Credential format/length only | No | **P2** |
| `npm start`, Render start, Docker CMD | No | Connect/readiness only | Normal app env validation | Yes, but non-destructive | Informational |
| Frontend/Vercel build | No | No Mongo target | N/A | Yes | Informational |
| Current Node tests | No | No DB connection | No generic production-target guard | No | P3 |

P0: **0**. P1: **DB-005-01**. P2: **DB-005-02, DB-005-03**. P3: test-target guard/documentation
hardening only. No provider-side data-loss event is proven by this audit.

## 18. Recommendation

Evidence supports **D — ADD MULTI-LAYER PRODUCTION SAFETY BOUNDARY** for destructive seed
execution, plus the same target guard for privileged CLI utilities. This is a targeted safety
change, not new infrastructure. The minimum design is fail-closed target validation before
`connectDB`, explicit disposable-target opt-in, no static credentials, and an operator runbook
that never instructs seeding a production URI. A future implementation must preserve the normal
application startup path and must not run any data migration automatically.

Operational documentation should also state that `set-password` and bootstrap commands are
break-glass operations, require temporary credentials, and must be followed by removal/rotation
of those variables. No guard or documentation was implemented in this audit.

## 19. Required Remediation, If Any

1. **Before production use:** remediate DB-005-01 by adding a shared, fail-closed CLI target
   guard and removing tracked default credentials/documented login values. Review the exact
   provider command path before rollout.
2. Preserve current working-tree bootstrap hardening only through a separately reviewed commit;
   it is not part of the clean HEAD deployment today.
3. Keep DB-005-02 deferred unless product requires a transactional disposable reset; do not
   broaden seed deletion to dependent collections without a separate design.
4. Add isolated disposable-Mongo tests for command rejection and successful local seed/bootstrap
   behavior before any deployment.

## 20. Implementation Gate

**BLOCKED — ACTION REQUIRED** for production-safe seed execution: the tracked seed is destructive,
accepts an arbitrary production-capable URI, and HEAD contains static seed credentials. No
application change was made because this task is audit-only. Approval is required before any
guard, credential removal, or operational documentation change.

## 21. Final Verdict

### Explicit answers

1. **Can `npm run seed` target production?** **YES.** It calls `connectDB()` with arbitrary
   `MONGODB_URI`, then deletes all users/listings; no target guard exists.
2. **Can bootstrap-admin target production?** **YES in the current working tree; NOT PRESENT in
   clean HEAD/origin.** Its direct Mongoose connection has no target guard.
3. **Can any seed/bootstrap run automatically during deployment/startup?** **NO automatic path
   found.** Render/Docker/Vercel lifecycle commands do not invoke them.
4. **Can production credentials accidentally be inherited?** **YES.** Manual commands inherit
   the process `MONGODB_URI`; Compose is local by default but overrides are possible.
5. **Are destructive operations protected by fail-closed guards?** **NO.** Input checks and
   documentation warnings are not fail-closed target guards.
6. **Are privileged credentials protected?** **PARTIAL/NO for HEAD.** Runtime logging is
   redacted and env files are ignored, but static seed credentials are tracked in code/docs.
7. **Are tests isolated from production?** **CODE-LEVEL VERIFIED for current tests** (no DB
   connection); no generic guard exists for future DB integration tests. Behavioral seed tests
   were not run because no disposable MongoDB was available.
8. **Is any P0/P1/P2 finding present?** **YES:** one P1 (DB-005-01) and two P2 findings
   (DB-005-02/03); P0 is none.
9. **Is remediation required?** **YES before permitting production-capable seed/CLI writes.**
10. **Minimum safe remediation:** fail-closed disposable-target guard before connection,
    remove static credentials, align bootstrap/password utilities with the guard, and add
    isolated behavioral tests/runbook evidence.

## 22. Safety Record

- Report-only file created: `docs/DB-005_SEED_BOOTSTRAP_SAFETY_AUDIT.md`
- No application, seed, bootstrap, schema, index, config, environment, or deployment file was
  modified by this audit.
- No production/shared MongoDB was accessed; no provider settings or credentials were changed.
- No seed, bootstrap, migration, reset, update, delete, or destructive command was executed.
- Nothing was staged, committed, pushed, reset, cleaned, stashed, reverted, or deleted.
- Existing dirty/untracked work remains protected; current status count is 117, consisting of the
  116 pre-existing entries plus this report.

**NO PRODUCTION DATA WAS MODIFIED**
