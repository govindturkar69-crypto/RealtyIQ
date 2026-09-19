# DB-005 Remediation Report

## 1. Findings Addressed

- **DB-005-01 (P1):** remediated with a shared fail-closed CLI MongoDB target
  guard and removal of tracked seed credentials.
- **DB-005-02 (P2):** intentionally not converted to a transaction. The approved
  plan treats seed as a disposable-database reset; deletion scope and its
  non-transactional limitation remain documented.
- **DB-005-03 (P2):** retained CLI account tools now use the same target guard,
  validate passwords, and emit bounded SecurityEvents where they mutate users.

No production database or provider was accessed.

## 2. Files Changed

DB-005 changes made in this worktree:

- `backend-api/src/utils/cliDbGuard.js` — new shared target guard.
- `backend-api/src/seed/seed.js` — guard before connection; runtime credentials.
- `backend-api/src/scripts/seed-users.js` — guard and CLI audit events.
- `backend-api/src/scripts/set-password.js` — guard, password bound, and audit event.
- `backend-api/src/scripts/bootstrap-admin.js` — guard before connection.
- `backend-api/src/test/cliDbGuard.test.js` — focused safety-boundary tests.
- `backend-api/.env.example` — disposable-target marker documentation.
- `backend-api/README.md`, `README.md`, `TESTING.md`, `DEPLOYMENT.md` — safe
  local usage and production refusal guidance.

`backend-api/package.json`, `backend-api/src/utils/bootstrapAdmin.js`, and the
other dirty Phase 2–6 files were pre-existing work and were not changed by this
implementation.

## 3. Production Target Guard

`assertSafeCliTarget()` runs before every approved CLI MongoDB connection:

- requires an explicit `MONGODB_URI` rather than the development fallback;
- accepts only the `mongodb:` protocol;
- accepts only local/Compose hosts (`127.0.0.1`, `localhost`, or `mongo`);
- accepts only allowlisted disposable database names;
- requires both `REALTYIQ_DISPOSABLE_DB=true` and the exact disposable-target
  confirmation marker;
- rejects public/Atlas/SRV targets even if `NODE_ENV` is changed;
- allows the existing Compose `NODE_ENV=production` setting only when the local
  target and both explicit disposable markers are present;
- never includes a URI, credential, password, token, or confirmation value in an
  error message.

The guard is shared by seed, seed-users, set-password, and bootstrap-admin. A
rejected target fails before `mongoose.connect()`/`connectDB()`.

## 4. Static Credential Removal

The seed and seed-users paths no longer contain literal passwords or default login
values. Admin credentials are required at runtime through the existing validated
environment variables; the optional demo account is also runtime-configured and
requires a 16-character minimum password. Passwords are not generated, logged, or
placed in SecurityEvent metadata. Documentation now uses placeholders and does not
publish default credentials.

## 5. Privileged CLI Hardening

- `seed-users.js` uses the shared target guard, refuses to promote an existing
  non-admin, preserves token/session invalidation behavior, and records a bounded
  `cli_user_seeded` event per successful mutation.
- `set-password.js` requires a 16-character minimum password, uses the shared
  target guard, and records a bounded `cli_password_changed` event. User lookup
  remains explicit; no HTTP endpoint was added.
- `bootstrap-admin.js` uses the shared target guard and retains its existing
  refusal to promote a non-admin plus its `admin_bootstrap` event.
- Audit metadata contains only allowlisted source/action/result/resource fields;
  no password, token, URI, or secret is persisted.

HTTP RBAC, CSRF, last-admin protections, token invalidation, and normal account
behavior were not changed.

## 6. Seed Behavior

The seed still parses the CSV before writing, deletes only `User` and `Listing`,
creates the runtime-configured admin/optional demo user, and inserts listings.
It does not delete or broaden into Prediction, SavedSearch, Inquiry, or any other
collection. It remains non-transactional by approved design and is now restricted
to an explicitly confirmed disposable local target. No production destructive reset
workflow was added.

## 7. SecurityEvent Changes

Successful CLI user/password mutations now call the existing best-effort
`recordSecurityEvent()` utility with `actorUserId: null`, the target user id,
bounded action/result/resource fields, and `source: "cli"`. Existing metadata
sanitization remains the controlling allowlist. Bootstrap continues to record
`admin_bootstrap`. No credentials or sensitive command arguments are included.

## 8. Documentation

Updated only the approved seed/CLI usage guidance in the repository README,
backend README, testing guide, deployment guide, and backend environment example.
The docs now require explicit disposable markers, describe production refusal,
state that seed is non-transactional and limited to users/listings, and remove
the prior default-credential workflow. Render/Atlas is explicitly excluded from
the generic seed/bootstrap path.

## 9. Tests

Focused DB-005 tests (`backend-api/src/test/cliDbGuard.test.js`): **7/7 PASS**

- production/public target rejected;
- Atlas target rejected even when `NODE_ENV` is changed;
- missing/ambiguous URI or confirmation rejected;
- explicitly confirmed local disposable target accepted;
- Compose production mode requires explicit local proof;
- tracked seed material has no literal passwords;
- all privileged CLI writers import and call the shared guard.

Full backend suite: **99/99 PASS**.

Syntax checks:

- `cliDbGuard.js`: PASS
- `seed.js`: PASS
- `seed-users.js`: PASS
- `set-password.js`: PASS
- `bootstrap-admin.js`: PASS

Disposable MongoDB integration: **NOT RUN — isolated disposable MongoDB unavailable**.
No seed/bootstrap/set-password command was run against any database.

## 10. Verification Results

- `git diff --check`: PASS (line-ending warnings only).
- No frontend files were changed for this backend/CLI remediation; frontend lint,
  TypeScript, and build were not rerun because scope did not affect frontend code.
- No database connection was opened by the implementation or tests.
- No production/shared data, indexes, schemas, migrations, or provider settings
  were changed.
- No files were staged, committed, or pushed.

## 11. Production Safety Assessment

The P1 target-guard and static-credential findings are fixed in the working tree:
public/Atlas targets are rejected, and default credentials are no longer accepted
from tracked seed material. The guard is deliberately restrictive and requires
multiple independent target/intent checks.

The seed remains a disposable reset with non-transactional behavior and limited
collection scope. This is the approved DB-005-02 decision, not a production reset
capability. Provider-side Atlas topology, transaction support, backups, PITR, and
permissions remain unverified.

## 12. Remaining Conditions

1. A disposable MongoDB/replica set must be provided for end-to-end seed/bootstrap
   verification before deployment.
2. Production operators must not run the generic CLI tools against Render/Atlas;
   any legitimate production admin provisioning requires a separately approved
   break-glass procedure.
3. The untracked bootstrap implementation and existing dirty files require a
   separate hunk-level review before any commit.
4. DB-002 provider transaction readiness remains a separate provider-verification
   condition and is not changed here.

## 13. Deployment Requirements

- Review and stage only the DB-005 code/tests/documentation hunks.
- Do not run migrations, seeds, bootstrap, password utilities, or data cleanup as
  part of deployment.
- Verify provider-side Atlas capabilities separately before relying on DB-002.
- If deployed, verify normal API startup and HTTP flows only; do not verify by
  mutating production data.

## 14. Final Status

- **P1 DB-005-01:** FIXED in the working tree; deployment remains approval-gated.
- **P2 DB-005-02:** FIXED AS APPROVED — no transaction added; disposable-only
  restriction and non-transactional limitation documented.
- **P2 DB-005-03:** FIXED in the working tree for retained CLI writers with shared
  guarding and bounded audit events.
- **Production deployment safe:** **PASS WITH CONDITIONS** — requires disposable
  integration verification and separate provider-side checks; no production CLI
  operation is authorized by this report.

Current repository safety:

- HEAD/origin: `e14d13acadf25c2fb33b328ce5819c5a8fc4954f`
- Pre-existing entries: 118
- Current entries after implementation/report: 121 (three additional DB-005 files:
  the guard utility, focused test, and this report)
- Staged files: 0
- Commit/push: none

**NO PRODUCTION DATA WAS MODIFIED.**
