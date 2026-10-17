# DB-004 MongoDB Atlas Provider Verification

## Executive Summary

**Final verdict: UNVERIFIED — PROVIDER ACCESS REQUIRED.**

Audit date: 2026-09-19. The MongoDB Atlas connector is installed and callable, but its discovery operations report that MCP access is disabled for all organizations available to the authorizing account (one organization). This is a directly observed access-policy blocker. No production cluster metadata, database connection, index inventory, backup configuration, network policy, or database roles were returned.

The repository comparison and report are complete within the read-only scope. Actual production provider verification remains incomplete. No production misconfiguration or P0/P1 incident was established. Findings identify evidence gaps and a documentation discrepancy; unavailable evidence is not evidence that a control is absent.

The audit changed only this report. All 113 pre-existing dirty/untracked entries were preserved. No production writes, index changes, configuration changes, restore, migration, seed, deployment, staging, commit, or push was initiated.

## Audit Scope

Production Atlas/provider topology, transactions, indexes, TTL/retention, backups/PITR, restore readiness, TLS/network controls, database permissions, connection settings, and compatibility with DB-002, DB-003, and DB-005.

Evidence classifications used throughout:

- **VERIFIED:** directly established by legitimate provider evidence. In this run, only the connector's access denial was obtained; this does not verify the database's controls.
- **UNVERIFIED:** required provider/deployment evidence unavailable.
- **INFERRED:** repository configuration or public product documentation suggests an expectation; production is not confirmed.
- **Repository observation:** a directly inspected source/declaration, explicitly separate from provider verification.

Read material included the prior database-integrity audit, prior DB-004 report, DB-003 audit, canonical database/API/TRD/testing/architecture documentation, deployment guidance, connection configuration, all six model schemas, account deletion and other transaction callers, notification acknowledgement, retention, security-event persistence, and CLI guards.

Earlier reports' test counts and production observations are historical evidence only. They were not rerun or independently revalidated here. In particular, this report does not claim the previous 99/99 test result as a current result.

## Safety Constraints

Only repository reads, executable availability checks, three read-only Atlas discovery calls, public documentation reads, and the authorized report update were performed.

No actual environment files, runtime environment values, stored credentials, connection strings, passwords, API tokens, or private keys were sought or extracted. Source-level configuration was inspected without loading the application. No production application endpoints, database documents, model initialization, index synchronization, or tests were executed.

Provider operations issued:

| Evidence ID | Read-only operation | Result |
|---|---|---|
| E1 | `atlas-list-projects({})` | `isError: true`, `error_code: INVALID_ARGUMENT`; organization MCP access disabled |
| E2 | `atlas-list-orgs({})` | Same policy denial |
| E3 | `atlas-list-clusters({})` | Same policy denial |

E2 and E3 were submitted together after E1's structured error was inspected. All three returned no Atlas inventory. No further discovery, reauthentication, guessed IDs, credential workaround, or connection was attempted after the denial was established.

The no-write statement concerns operations initiated by this audit. It does not claim that other application clients or Atlas background TTL processing stopped, or that provider audit logs independently prove an absence of unrelated activity.

## Repository Baseline

| Item | Observation |
|---|---|
| Branch | `main` |
| HEAD | `c99b5e5725b6b532f9f7e33f9b0b08a40530e79c` |
| Local `origin/main` | `c99b5e5725b6b532f9f7e33f9b0b08a40530e79c` |
| Expected baseline | Matches both local references |
| Initial status | 87 modified tracked files and 26 untracked files: 113 entries |
| Initial staged files | None |
| Report status before this audit's edit | Already existed and was untracked |
| Integrity comparison | SHA-256 inventory of 231 tracked/non-ignored untracked files captured before the report edit |
| Remote freshness | No fetch or remote-tip query performed; `origin/main` means the local remote-tracking ref |

The working-tree code is the inspected application baseline. It is not assumed to be the deployed code. `git show HEAD:backend-api/src/controllers/auth.controller.js` still contains the older `Promise.all` account-deletion path; the working tree contains the DB-002 transaction implementation at lines 255–282.

Existing changes span backend/frontend/ML source, tests, deployment/configuration documentation, and audit reports. The pre-existing inventory follows; none of these other files was authorized for edits.

<details>
<summary>Pre-existing git status --short (113 entries)</summary>

```text
 M DEPLOYMENT.md
 M SECURITY.md
 M TESTING.md
 M backend-api/.env.example
 M backend-api/README.md
 M backend-api/package.json
 M backend-api/src/app.js
 M backend-api/src/config/db.js
 M backend-api/src/config/env.js
 M backend-api/src/controllers/auth.controller.js
 M backend-api/src/controllers/compare.controller.js
 M backend-api/src/controllers/favorites.controller.js
 M backend-api/src/controllers/inquiry.controller.js
 M backend-api/src/controllers/listing.controller.js
 M backend-api/src/controllers/predict.controller.js
 M backend-api/src/controllers/savedSearch.controller.js
 M backend-api/src/controllers/trends.controller.js
 M backend-api/src/lib/queryBuilder.js
 M backend-api/src/lib/trends.js
 M backend-api/src/middleware/errorHandler.js
 M backend-api/src/middleware/rateLimiters.js
 M backend-api/src/middleware/requestId.js
 M backend-api/src/models/Inquiry.js
 M backend-api/src/models/Listing.js
 M backend-api/src/models/SavedSearch.js
 M backend-api/src/models/User.js
 M backend-api/src/routes/auth.routes.js
 M backend-api/src/routes/compare.routes.js
 M backend-api/src/routes/inquiry.routes.js
 M backend-api/src/routes/listing.routes.js
 M backend-api/src/routes/predict.routes.js
 M backend-api/src/server.js
 M backend-api/src/services/ml.service.js
 M backend-api/src/test/app.test.js
 M backend-api/src/test/trends.test.js
 M backend-api/src/utils/logger.js
 M backend-api/src/validators/listing.schema.js
 M backend-api/src/validators/predict.schema.js
 M backend-api/src/validators/savedSearch.schema.js
 M docker-compose.yml
 M docs/API.md
 M docs/ARCHITECTURE.md
 M docs/DATABASE.md
 M docs/PRD.md
 M docs/TESTING.md
 M docs/TRD.md
 M docs/UI-UX.md
 M frontend/README.md
 M frontend/src/app/admin/page.tsx
 M frontend/src/app/dashboard/page.tsx
 M frontend/src/app/favorites/page.tsx
 M frontend/src/app/globals.css
 M frontend/src/app/listings/[id]/page.tsx
 M frontend/src/app/login/page.tsx
 M frontend/src/app/notifications/page.tsx
 M frontend/src/app/page.tsx
 M frontend/src/app/r/[id]/page.tsx
 M frontend/src/app/results/page.tsx
 M frontend/src/app/signup/page.tsx
 M frontend/src/app/template.tsx
 M frontend/src/components/compare/compare-tool.tsx
 M frontend/src/components/emi-calculator.tsx
 M frontend/src/components/investment-roi-calculator.tsx
 M frontend/src/components/layout/navbar.tsx
 M frontend/src/components/layout/theme-toggle.tsx
 M frontend/src/components/listings/favorite-button.tsx
 M frontend/src/components/listings/filters.tsx
 M frontend/src/components/listings/listing-card.tsx
 M frontend/src/components/listings/listings-browser.tsx
 M frontend/src/components/listings/pagination.tsx
 M frontend/src/components/listings/save-search-button.tsx
 M frontend/src/components/map/map-view.tsx
 M frontend/src/components/motion/count-up.tsx
 M frontend/src/components/motion/reveal.tsx
 M frontend/src/components/predict/predict-form.tsx
 M frontend/src/components/three/auth-3d.tsx
 M frontend/src/components/three/hero-3d.tsx
 M frontend/src/components/three/result-3d.tsx
 M frontend/src/components/ui/button.tsx
 M frontend/src/lib/api.ts
 M frontend/src/lib/favorites-context.tsx
 M frontend/src/lib/types.ts
 M ml-service/.env.example
 M ml-service/README.md
 M ml-service/app/main.py
 M ml-service/src/config.py
 M render.yaml
?? backend-api/src/test/accountDeletion.test.js
?? backend-api/src/test/adminQueues.test.js
?? backend-api/src/test/compareReliability.test.js
?? backend-api/src/test/discovery.test.js
?? backend-api/src/test/favoritesQuota.test.js
?? backend-api/src/test/listingLifecycle.test.js
?? backend-api/src/test/mlReliability.test.js
?? backend-api/src/test/savedSearch.test.js
?? backend-api/src/test/savedSearchQuota.test.js
?? backend-api/src/test/security.test.js
?? backend-api/src/utils/bootstrapAdmin.js
?? backend-api/src/validators/adminQueue.schema.js
?? docs/DATABASE_INTEGRITY_AUDIT.md
?? docs/DATABASE_INTEGRITY_REMEDIATION_REPORT.md
?? docs/DB-003_NOTIFICATION_RACE_AUDIT.md
?? docs/DB-004_MONGODB_ATLAS_PROVIDER_VERIFICATION.md
?? docs/DB-005_REMEDIATION_PLAN.md
?? docs/DB-005_SEED_BOOTSTRAP_SAFETY_AUDIT.md
?? docs/PHASE2_FINAL_CLOSURE.md
?? docs/PHASE3_IMPLEMENTATION_PLAN.md
?? docs/PHASE4_IMPLEMENTATION_PLAN.md
?? docs/PHASE5_IMPLEMENTATION_PLAN.md
?? docs/PHASE6_SLICE6_3_IMPLEMENTATION_PLAN.md
?? frontend/src/app/error.tsx
?? ml-service/app/security.py
?? ml-service/verify/test_security.py
```

</details>

Git initially warned that the global ignore file was inaccessible. No permission/configuration change was made. Integrity coverage is the tracked and non-ignored untracked inventory returned by Git, not ignored dependencies, actual environment files, or external files.

## Provider Access Status

**Provider access: UNAVAILABLE for this audit.**

The previous report's assertion that no Atlas connector was installed is superseded. The installed connector reached a provider policy rejection. Its diagnostic states that all available organizations have MCP access disabled, that retries/reauthentication will not resolve it, and that an Organization Owner controls enablement. No organization/project/cluster identifier or production database name was disclosed.

| Access path | Observation |
|---|---|
| Installed MongoDB Atlas connector | Present; E1–E3 denied by organization policy |
| `atlas`, `mongocli`, `mongosh`, `mongo` on PATH | All unavailable, checked with `Get-Command` |
| Existing repository tooling | Application connection and mutation-oriented CLI paths inspected statically; none used as an audit connection |
| Separate dashboard/API session | No separate authorized provider evidence was supplied or used; no dashboard workaround attempted after the policy denial |
| Credentials | Not searched for, extracted, guessed, or supplied |

MongoDB documents organization-level AI-client access in **Organization Settings → App Connections**, including a **Read** mode. An Organization Owner may choose to authorize that access in a separate action, or provide sanitized evidence through an existing authorized channel. Enabling it would be a provider-policy change and was outside this audit. See [Manage AI Client Access](https://www.mongodb.com/docs/mcp-server/remote-mcp/manage-ai-client-access/).

The generic tool catalog is not proof of effective access. It also cannot guarantee complete later coverage: the exposed collection-index schema advertises keys/names but does not guarantee TTL/unique options, and no general cluster backup/PITR inspection tool was exposed. Missing fields must remain UNVERIFIED even after access is available.

## Atlas Topology

**UNVERIFIED.** E1–E3 returned no cluster inventory.

| Required fact | Provider result |
|---|---|
| Production project/cluster identity and database name | UNVERIFIED; no target selected |
| Deployment type/tier, dedicated/shared/Flex/serverless classification | UNVERIFIED |
| Replica-set/sharded/standalone topology and member count | UNVERIFIED |
| MongoDB version and feature compatibility version | UNVERIFIED |
| Cloud provider, region(s), availability zones | UNVERIFIED |
| Session support and topology transaction capability | UNVERIFIED |
| Default/effective write concern and read concern | UNVERIFIED |
| Cluster state, availability, failover characteristics | UNVERIFIED |

`DEPLOYMENT.md:22–29` recommends an initial Atlas M0/Mumbai setup; `render.yaml:2` describes Atlas as external. These are **INFERRED deployment expectations**, not production facts. The development database name in source must not be substituted for the unknown production database.

## Transaction Support

**UNVERIFIED for production topology, privileges, execution, and retry behavior. No transaction was run.**

Repository observations:

- DB-002: `auth.controller.js:255–282` opens one Mongoose session and uses `withTransaction()`. Reads and sequential deletion of Prediction, SavedSearch, Inquiry, and User share that session; active-admin deletion also uses the shared admin mutation anchor. Non-application errors become HTTP 503; there is no nontransactional fallback.
- Cookie clearing and success response occur after the transaction returns. Optional Listing author references and SecurityEvent history are outside the account-deletion cascade.
- Saved-search quota admission uses a session, shared user anchor, count and create transaction (`savedSearch.controller.js:44–67`).
- Active-admin changes also depend on transactions (`auth.controller.js:192–221`).
- The lockfile records Mongoose 8.24.1 and MongoDB driver 6.20.0 (`backend-api/package-lock.json:864–865,808–809`); deployed dependency versions remain unknown.
- `accountDeletion.test.js` contains mocked session/abort/fail-closed cases. These were read, not run, and cannot demonstrate real Atlas rollback or retry behavior.

Generic compatibility requirements: transactions require a compatible replica set or sharded cluster; standalone deployments do not support them. MongoDB documents minimum feature compatibility versions of 4.0 for replica sets and 4.2 for sharded clusters, plus the privileges needed for the operations inside the transaction. These minima are not a recommendation to deploy old server versions. [MongoDB transaction production considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/).

The driver convenient transaction API handles eligible transient-transaction and unknown-commit-result retries. The source delegates to that API without a custom retry loop and awaits operations sequentially. This is an **INFERRED compatibility expectation**, not a tested guarantee under the production server version, error conditions, or time limits. [Node.js transaction API](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

No explicit transaction read/write concern options were found in these callers. Actual inherited concern settings, session availability, transaction lifetime, RBAC, write-conflict behavior, commit retries, and deployed DB-002 identity remain UNVERIFIED. DB-002 cannot receive production sign-off from this audit.

## Production Index Verification

**UNVERIFIED for every live collection/index.** No connection or `listIndexes` result was obtained. No missing, extra, or incorrect live index is asserted.

Names below are expected Mongoose collection names; actual production names/case remain unverified. In particular, logical SavedSearch and SecurityEvent models conventionally map to lowercase `savedsearches` and `securityevents`, not assumed camel-case collections.

| Expected collection | Repository index declarations, excluding implicit `{ _id: 1 }` | Source |
|---|---|---|
| `users` | `{ email: 1 }`, unique | `User.js:7` |
| `listings` | Single-field ascending: city, locality, propertyType, bhk, price, listedDate; compound `{ locality: 1, price: 1 }` | `Listing.js:6–20,27` |
| `predictions` | Single-field ascending: user, locality, isAnonymous, shareTokenHash; `{ expiresAt: 1 }`, TTL 0 | `Prediction.js:5,12–17` |
| `savedsearches` | `{ user: 1 }`; `{ user: 1, createdAt: -1 }` | `SavedSearch.js:5,13` |
| `inquiries` | Single-field ascending: user, listing, status; `{ user: 1, createdAt: -1, _id: -1 }`; `{ createdAt: -1, _id: -1 }`; `{ status: 1, createdAt: -1, _id: -1 }` | `Inquiry.js:4–12` |
| `securityevents` | Single-field ascending: type, user, requestId; `{ createdAt: 1 }` TTL; `{ createdAt: -1, _id: -1 }`; `{ type: 1, createdAt: -1, _id: -1 }` | `SecurityEvent.js:6–25` |
| `notifications` | No model/collection declared; alerts derive from SavedSearch and Inquiry reads | `frontend/src/app/notifications/page.tsx:32–49`; `docs/DATABASE.md` |

All model filenames in this table are under `backend-api/src/models/`. The standard implicit `_id` index is also an expectation requiring live inspection; no application-declared custom index names, sparse/partial/collation/hidden settings were found in these schemas.

`Listing.deletedAt` is declared at `Listing.js:22` without an index. No archived/deletedAt-specific index is declared in these models. This is not a missing-provider-index finding. The live inventory and query plans are unavailable, so no performance index is recommended without evidence.

The owner/date and status/date compound indexes support account history/admin queues, email uniqueness is an integrity expectation, and prediction/security-event indexes support lookup/retention. Their actual presence, unique flags, key order, query use, extra indexes and drift remain UNVERIFIED. A future comparison must obtain full options rather than accept index names/keys alone.

## TTL / Retention Verification

**UNVERIFIED for live TTL existence, indexed field, seconds, effectiveness, and drift.**

| Data | Expected field/policy from repository | Expected TTL seconds | Provider status |
|---|---|---|---|
| Predictions | `expiresAt`; date assigned at creation | `expireAfterSeconds: 0` | UNVERIFIED |
| Security events | `createdAt`; retention interval from configuration | `SECURITY_EVENT_RETENTION_DAYS × 86400`; source default 365 days = **31,536,000 seconds** | UNVERIFIED; deployed retention value unknown |
| Refresh/session state | Embedded User refresh-token hashes and legacy values, JWT expiry/rotation/revocation | No application-declared TTL | Provider inventory UNVERIFIED; no separate session collection expected |
| Share-token state | Prediction share hash, share expiry/revocation; application access checks | No separate TTL on `shareExpiresAt` or `shareRevokedAt` | Provider inventory UNVERIFIED |
| Notifications | Derived reads; no durable notification model | No application-declared TTL | No separate notification TTL expected; provider collection inventory UNVERIFIED |
| Saved searches, users, inquiries, listings | Explicit operations/lifecycle; archived listings retained | No application-declared TTL | Provider inventory UNVERIFIED |

Evidence: `Prediction.js:14–17`, `SecurityEvent.js:19`, `User.js:14–15`, `config/env.js:63–66`, `predict.controller.js:25–26,50–70,99–115`, and `docs/DATABASE.md:173–176`.

Prediction creation sets retention to the configured day count for authenticated users (source default 365), or one day for anonymous records. TTL 0 expires at that stored date; it does not mean immediate deletion of every new prediction. Share expiry/revocation is enforced by application predicates and does not independently remove the prediction or hash. Refresh expiry is enforced by JWT validation and token rotation/invalidation; it is not a MongoDB TTL on the whole User document.

MongoDB TTL deletion is asynchronous and may lag expiration under load. Documents without a valid indexed date are not expired by that TTL policy. Therefore index presence alone would not prove prompt cleanup, nor retention of historical records with absent fields. No document sampling, deletion observation, backfill, or retention change occurred. [MongoDB TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/).

## Backup / PITR Verification

**UNVERIFIED.** No backup metadata was returned.

| Control | Status |
|---|---|
| Automated backup enablement and health | UNVERIFIED |
| Snapshot schedule, frequency and retention period | UNVERIFIED |
| Continuous backup/PITR enablement and window | UNVERIFIED |
| Latest successful snapshot and latest/earliest restorable time | UNVERIFIED |
| Failed/pending backup status | UNVERIFIED |
| Retention/location/isolation of backups | UNVERIFIED |
| Restore capability and authorized operator access | UNVERIFIED |

The recommended deployment tier does not establish the purchased production tier or backup entitlement. No assumption that backups/PITR exist or are absent is justified. `docs/DATABASE.md:165–171` delegates recovery to provider procedures; it supplies no current snapshot evidence. No snapshot or restore was triggered.

## Restore / Disaster Recovery

**UNVERIFIED.** Restoration availability, PITR availability, isolated restore-target support/access, and actual restore success were not demonstrated.

No numerical RPO or RTO was found in the reviewed canonical/deployment documents. There is therefore no documented numerical objective against which the provider configuration can be approved. No recent drill, measured restore duration, recovered-data validation, or recovery ownership evidence was provided.

A configured backup, if later verified, would still not establish successful recovery. A separately authorized drill must use an isolated target, record recovery timestamps and duration, and validate application-critical collections/indexes/relationships. Neither production nor disposable restoration was performed in this audit.

## TLS / Network Security

**UNVERIFIED.**

TLS enforcement, negotiated encryption in transit, certificate validation, minimum TLS policy, IP/firewall access list, private endpoints/peering, public endpoint exposure, and whether network access exceeds actual application egress needs could not be inspected.

`DEPLOYMENT.md:25–27` calls for private connectivity or a narrow provider-egress allowlist, with database authentication/TLS for public endpoints. These are **INFERRED requirements**. An SRV-style deployment example does not prove actual negotiated TLS or rule scope.

No CIDRs, hostnames, IP addresses, private endpoint identifiers, or sensitive network details were collected or exposed. No access rule was added, removed, or changed. The MCP organization restriction is an AI-client policy and does not establish the application's database firewall or TLS state.

## Database Users / Permissions

**UNVERIFIED.** No database-user list, custom-role definition, scope, or authenticated-session privilege evidence was returned.

The application needs collection read/write operations supporting its features, including the operations inside its transactions. Actual application-user identity/existence, database scope, custom roles, excess administrative privileges, and effective permissions remain unknown. No usernames or authentication material were inspected.

Application HTTP roles (`user`, `admin`, `agent`, `broker`) are unrelated to Atlas database roles. The authorizing connector user's permissions also do not establish the production runtime user's permissions. No `atlasAdmin`, `dbAdminAnyDatabase`, or `readWriteAnyDatabase` grant is asserted present or absent. No roles or credentials were changed.

## Connection Security

**UNVERIFIED for the live production connection.**

Repository observation: `config/db.js:5–9` sets Mongoose `strictQuery` and `serverSelectionTimeoutMS: 10000`; `config/env.js:44` reads the required production database configuration. Strict-query handling does not establish transport security. The deployment example at `DEPLOYMENT.md:29` includes retryable writes and majority write concern; no connection string is reproduced here.

No explicit pool size, read preference, read concern, transaction concern, or retry override was found in inspected application callers. Their effective values may depend on the deployed URI, driver and provider defaults; these remain UNVERIFIED. Source defaults are not reported as provider settings.

Actual TLS negotiation, authentication mechanism, connection restrictions, retry behavior, pool configuration and runtime/server concern settings were not observed. The audit did not import models or start the application, avoiding incidental application writes or index initialization.

## Application Compatibility

| Application contract | Repository observation | Production compatibility |
|---|---|---|
| DB-002 transactional account deletion | Same-session sequential multi-collection deletion; no nontransactional fallback; present only in working tree relative to HEAD | UNVERIFIED topology, privileges, deployed code, actual abort/commit/retry behavior |
| Saved-search quota and active-admin protection | Additional session/transaction callers | UNVERIFIED same provider prerequisites |
| DB-003 notification acknowledgement | Owner-scoped read/count/save at `savedSearch.controller.js:78–84`; no version predicate or transaction; derived alerts | UNVERIFIED deployed behavior; Atlas topology alone cannot make this multi-step acknowledgement conditional |
| DB-005 disposable-only CLI protections | `utils/cliDbGuard.js:1–42` restricts protocol/host/database and requires two explicit disposable confirmations; called before connection by seed/account scripts | Repository observation only; not an Atlas RBAC or network boundary |
| Prediction/security-event retention | Two declared TTLs plus application share/expiry checks | UNVERIFIED live indexes/options and deployed retention |
| Security-event persistence | `utils/securityEvent.js:28–50` attempts a separate insert and logs failure without rolling back the business action | UNVERIFIED actual persistence, privileges, retention and failure monitoring |
| Expected indexes | Six declared model index sets; no Notification model | UNVERIFIED live presence/options/performance |
| Production connection | Explicit database configuration and documented TLS/network expectations | UNVERIFIED actual runtime/provider settings |

DB-003's possible stale acknowledgement is a pre-existing application concern documented in its separate audit; this run did not reproduce a production race or alter its semantics. DB-005 scripts were not executed. Security-event history remains outside DB-002's deletion scope.

## Findings

Severities classify findings only; they are not an execution ranking. **No P0 or P1 production issue was proven.** Confidence below concerns the evidence gap or source discrepancy, not an unobserved production failure.

### DB4-001 — Atlas organization policy blocks provider verification

- **Severity:** P2
- **Exact issue:** The installed connector cannot retrieve Atlas inventory because organization MCP access is disabled.
- **Evidence:** E1–E3 returned `INVALID_ARGUMENT` with the same organization-policy diagnostic; all four checked Atlas/Mongo shell executables were absent from PATH.
- **Affected component:** Provider access and production assurance.
- **Production impact:** Database controls cannot be approved from this audit; application outage or database access failure is not established.
- **Confidence:** High for the observed denial.
- **Recommended next action:** An Organization Owner should decide on separately authorized read access, or supply redacted provider evidence. Do not repeatedly reconnect or change settings as part of this audit.

### DB4-002 — Transaction compatibility and deployed DB-002 identity remain unverified

- **Severity:** P2
- **Exact issue:** Production topology/session support, effective operation privileges and deployed transactional deletion implementation are unknown.
- **Evidence:** `auth.controller.js:255–282` in the working tree uses `withTransaction()`; `git show HEAD:...` contains `Promise.all`; no topology or deployed-artifact evidence was returned.
- **Affected component:** Account deletion, saved-search admission and active-admin protection.
- **Production impact:** Unsupported capability would prevent transaction-dependent operations; the old deployed deletion path, if still deployed, would not acquire the working-tree atomicity guarantee. Neither condition is confirmed.
- **Confidence:** High for the repository difference and evidence gap.
- **Recommended next action:** Record topology/version/FCV, effective runtime permissions and deployed revision; obtain separate isolated transaction failure/retry validation before production sign-off.

### DB4-003 — Live index and TTL conformity remains unverified

- **Severity:** P3
- **Exact issue:** No full live index specifications were available for comparison with repository expectations.
- **Evidence:** Model declarations listed above; no connection or index query succeeded.
- **Affected component:** Uniqueness, query support and data retention.
- **Production impact:** Drift could affect correctness, performance or retention; no actual missing/incorrect index is demonstrated.
- **Confidence:** High for the evidence gap.
- **Recommended next action:** Read complete index keys/options for the actual six collections and any additional retention collections; compare unique, compound, partial/sparse and TTL options without changing them.

### DB4-004 — Recovery capability and objectives lack current evidence

- **Severity:** P2
- **Exact issue:** Backup/PITR status, retention, restore points, isolated restore capability and measured recovery readiness are unknown; no numerical RPO/RTO was found.
- **Evidence:** No provider backup output; `docs/DATABASE.md:165–171` requires provider recovery verification but provides no current configuration or drill.
- **Affected component:** Disaster recovery and data preservation.
- **Production impact:** Recoverability and acceptable data/time loss cannot be established; absence of backups is not proven.
- **Confidence:** High for the evidence gap and reviewed-document scope.
- **Recommended next action:** Obtain current backup/PITR/restore-point evidence, define accountable RPO/RTO, and separately authorize an isolated restore drill.

### DB4-005 — Production transport, network and runtime RBAC remain unverified

- **Severity:** P2
- **Exact issue:** No actual TLS, network access or application database-role evidence was obtained.
- **Evidence:** E1–E3 denial; only deployment expectations and source connection configuration were available.
- **Affected component:** Database confidentiality, exposure, authorization and connection reliability.
- **Production impact:** Least privilege and restricted reachability cannot be confirmed; no excessive role or public exposure is proven.
- **Confidence:** High for the evidence gap.
- **Recommended next action:** Inspect redacted TLS/network policies and effective runtime roles/settings through legitimate read-only provider evidence.

### DB4-006 — Canonical deletion documentation differs from the working tree

- **Severity:** P3
- **Exact issue:** Canonical database guidance still says other multi-document account operations remain nontransactional, while the current working tree implements transactional account deletion.
- **Evidence:** `docs/DATABASE.md:159–161` versus `auth.controller.js:255–282`; committed HEAD also retains the old deletion implementation.
- **Affected component:** Operational documentation and deployment-readiness interpretation.
- **Production impact:** Operators could misidentify the applicable transaction requirement or mistake uncommitted code for deployed behavior.
- **Confidence:** High for the local discrepancy; deployed state unknown.
- **Recommended next action:** Reconcile documentation and deployed-version evidence in separately authorized implementation work. This audit modifies neither application code nor canonical database guidance.

## Verified Controls

**Provider evidence obtained:** the connector enforced an organization-level MCP access denial (E1–E3). This is an access-policy observation, not verification of cluster security or reliability.

**Repository/process observations, kept separate from provider verification:**

- HEAD and local `origin/main` match the requested baseline.
- DB-002 transaction code, DB-005 CLI guard and two TTL declarations were read.
- The only write initiated by the audit was this authorized report update.
- No production connection, database command, index initialization or application execution occurred.
- No mutation/configuration/restore/deployment/stage/commit/push operation was requested by the audit.

## Unverified Controls

All production-specific controls remain UNVERIFIED:

- Target identity, database name, topology, tier, server/FCV, regions and availability.
- Sessions, transaction execution, effective privileges/concerns, retry behavior and deployed DB-002 code.
- Collection/index inventory, uniqueness, key ordering, options, query use and TTL operation.
- Actual retention settings and expiration-field coverage of existing data.
- Backup schedule/status/retention, PITR window and latest restore point.
- Restore capability, isolation, successful drill and measured RPO/RTO.
- TLS, authentication, network rules, private connectivity and public exposure.
- Runtime database-user identity, effective roles and least privilege.
- Actual security-event persistence and connection/pool/retry settings.

## Recommended Next Steps

1. Resolve the provider-evidence access blocker through an Organization Owner's separate decision or already authorized sanitized evidence. No policy change is included in this report.
2. Identify the production target and deployed application revision without disclosing connection secrets.
3. Capture read-only topology/version/session evidence and full live index specifications; leave unsupported checks UNVERIFIED.
4. Inspect backup/PITR/restore points, TLS/network policies, and effective application roles. Additional provider UI/API evidence may be needed beyond the connector's exposed tools.
5. Separately authorize isolated transaction and restore drills, with defined RPO/RTO and no production test mutation.
6. Reconcile source/documentation drift during separately authorized work. No remediation is performed here.

## Final Verdict

**UNVERIFIED — PROVIDER ACCESS REQUIRED**

The report and repository comparison are complete. The requested provider verification cannot be completed under the observed access policy. This is neither a PASS nor proof of a production database fault.

### Final verification record

- HEAD and local `origin/main`: `c99b5e5725b6b532f9f7e33f9b0b08a40530e79c`; unchanged.
- Provider access: **UNAVAILABLE**; connector installed, organization MCP policy denies access.
- Topology / transactions / indexes / TTL / backups-PITR / restore-DR / TLS-network / DB permissions: **UNVERIFIED**.
- Audit-initiated production writes: **NONE**.
- Audit-initiated provider configuration changes: **NONE**.
- Index create/drop/alter, restore, migration, seed/reset, app/test execution and deployment: **NONE**.
- Only audit-modified file: `docs/DB-004_MONGODB_ATLAS_PROVIDER_VERIFICATION.md`.
- All other tracked/non-ignored untracked files: unchanged by before/after SHA-256 comparison.
- Application/schema/index/migration/configuration files changed by the audit: **NONE**.
- `git diff --check`: **PASS**.
- Separate whitespace check for this already-untracked report: **PASS**.
- `git status --short`: same 113 pre-existing entries; report remains untracked.
- Staged files: **NONE**.
- Commits/pushes initiated: **NONE**; no fetch, reset, stash or discard.
- Findings: **four P2 and two P3**; no confirmed P0/P1 production issue.
