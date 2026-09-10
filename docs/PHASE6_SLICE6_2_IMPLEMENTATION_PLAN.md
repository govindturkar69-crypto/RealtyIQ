# Phase 6 — Slice 6.2 Implementation Plan

## 1. Objective

Make property discovery, property detail, map/heatmap, and compare reliable at the existing Express/MongoDB/FastAPI boundaries without redesigning the product or introducing infrastructure. The implementation is limited to verified Slice 6.2 gaps and must preserve archived-listing isolation, bounded queries, rate limits, ML authentication, and the existing API client behavior.

## 2. Audit Baseline

- Branch: `main`
- HEAD: `f4b3da9002cf515f56026b7705ed7d91f78b25d7`
- Worktree: intentionally dirty, 118 status entries at audit time; previous Phase 1–5 work is protected and must not be cleaned or attributed to this slice.
- Architecture: Next.js 14 App Router → shared frontend API client → Express/Mongoose → MongoDB; compare prediction calls cross the Express → authenticated FastAPI boundary.
- Existing known verification baseline: backend 63/63, frontend lint/typecheck/build previously passing, Python checks previously passing. No new build was run during this read-only audit.
- No production/shared database was accessed.

## 3. Current Architecture and Contracts

### Discovery and listing detail

- `GET /api/listings` is validated by `listingQuerySchema`, uses `buildActiveListingQuery`, an allowlisted sort, `_id` tie-breaking, `skip/limit`, and returns `{ items, page, limit, total, totalPages }`.
- `GET /api/listings/meta/localities` returns active localities.
- `GET /api/listings/:id` and `GET /api/listings/:id/deal` return active listings only; malformed IDs are eventually converted by the error handler to a controlled 400, but these public routes do not use the explicit ObjectId param validator used by mutation routes.
- `frontend/src/components/listings/listings-browser.tsx` owns URL filters, 300 ms debounce, page state, loading/error/empty states, and a request-generation guard. It currently casts API JSON directly to `Paginated<Listing>`.

### Compare

- `POST /api/compare` validates 2–3 unique 24-character ObjectIds, is rate limited, accepts optional auth, excludes archived listings, preserves requested order, and returns `{ items, degraded }`.
- Per-listing ML failures are represented as `predictionStatus: "unavailable"`; successful items remain usable and anonymous compare does not persist prediction history.
- `frontend/src/components/compare/compare-tool.tsx` validates URL IDs, caps selection at three, fetches listings, submits compare, and renders degraded items. Search requests are debounced but have no generation/abort guard and cast API responses without runtime validation.

### Map and trends

- `frontend/src/components/map/map-view.tsx` requests at most 100 active listings and renders coordinate-bearing markers; it has loading/error/empty states but no response schema validation or request-generation guard for overlapping retries.
- `frontend/src/app/trends/page.tsx` has a generation guard for locality trend requests, but ranking/trend responses are cast without runtime validation and ranking failures are toast-only.
- `backend-api/src/lib/trends.js` bounds month and ranking limits and applies the active-listing filter. `trends.routes.js` has no dedicated query schema; controller coercion/clamping is the current protection.

### Shared client and types

- `frontend/src/lib/api.ts` provides credentials, CSRF, refresh/retry, request IDs, a 15-second timeout, and safe response parsing. Its public methods return typed casts rather than runtime-validated values.
- `frontend/src/lib/types.ts` contains compile-time interfaces only. Zod is already installed and may be reused for the smallest runtime guards.

## 4. Findings

### Confirmed P2 — unvalidated discovery/detail/compare/map API payloads

- **Files:** `frontend/src/components/listings/listings-browser.tsx`, `frontend/src/components/listings/listing-card.tsx`, `frontend/src/app/listings/[id]/page.tsx`, `frontend/src/components/compare/compare-tool.tsx`, `frontend/src/components/map/map-view.tsx`, `frontend/src/app/trends/page.tsx`, with shared schemas/types likely added under `frontend/src/lib/`.
- **Current behavior:** JSON is trusted after TypeScript casts; render paths call nested properties and numeric methods directly.
- **Impact:** malformed or partially missing property/compare data can cause an Application Error, invalid cards, or misleading comparison output instead of a recoverable state.
- **Plan:** add small Zod schemas for the listing, paginated listing, compare item/response, and the map/trends shapes actually consumed; parse at the shared API boundary or immediately at each affected caller; classify invalid payloads as `FrontendApiError`/controlled error state. Preserve optional/null fields and existing response shapes.

### Confirmed P2 — compare search stale response race

- **File:** `frontend/src/components/compare/compare-tool.tsx`.
- **Current behavior:** debounced searches can overlap; an older response can replace newer search results and its `finally` block can clear the newer loading state.
- **Impact:** users can select the wrong property after rapid typing and receive stale discovery data.
- **Plan:** reuse the existing request-generation pattern from `ListingsBrowser`/trends (or an `AbortController` only if the current client path supports it cleanly). Ignore stale/aborted results and errors; keep one debounce and one request per generation.

### Confirmed P2 — map retry/request overlap is not guarded

- **File:** `frontend/src/components/map/map-view.tsx`.
- **Current behavior:** retry calls can overlap and no generation check prevents a late failure from replacing a newer success.
- **Impact:** transient map failures can produce stale error/empty state and inconsistent marker data.
- **Plan:** add a small generation guard with unmount cleanup; do not change the 100-marker cap or add polling/clustering.

### Confirmed P2 — public detail/deal ID validation is indirect

- **Files:** `backend-api/src/routes/listing.routes.js`, `backend-api/src/validators/params.schema.js` (reuse), focused route/controller tests.
- **Current behavior:** `/:id` and `/:id/deal` rely on Mongoose CastError handling rather than the explicit ObjectId validator used elsewhere.
- **Impact:** behavior is currently controlled but inconsistent; malformed IDs traverse controller/database code before becoming 400 responses.
- **Plan:** add the existing ObjectId param validation middleware to these two read routes only, preserving 400 semantics and response shape.

### Confirmed P2 — trends query contract is weaker than discovery contract

- **Files:** `backend-api/src/routes/trends.routes.js`, `backend-api/src/controllers/trends.controller.js`, `backend-api/src/lib/trends.js`.
- **Current behavior:** months/limit are coerced and clamped, but no strict query schema/allowlist consistently rejects malformed or unknown values.
- **Impact:** callers can receive surprising results and malformed input is handled inconsistently with discovery. Existing bounds prevent an unbounded query, so this is correctness/contract hardening, not a demonstrated DoS.
- **Plan:** add a minimal strict trends query schema using existing Zod conventions; preserve current bounds, active filtering, and response shapes.

### Confirmed P2 — locality metadata failure is silently swallowed

- **File:** `frontend/src/components/listings/listings-browser.tsx`.
- **Current behavior:** locality loading failure is ignored and the filter silently remains empty.
- **Impact:** discovery remains usable but the locality control can appear incomplete with no recovery path.
- **Plan:** keep listings usable, expose a bounded filter-level error/retry state, and avoid a second uncontrolled request loop.

### P3 / follow-up, not a Slice 6.2 blocker

- Deep `skip` at the existing page cap (for example page 100000) may be slow; no measured production degradation exists. Do not introduce cursor pagination in this slice.
- Listing indexes are not purpose-built for every `deletedAt + sort` combination; no query-plan evidence justifies adding indexes now.
- Ranking has no `_id` tie-breaker, but it is not paginated and no user-visible instability has been measured.
- Broad mobile/accessibility closure and workflow improvements belong to Slice 6.5/6.3/6.4.

## 5. Scope

### In scope

1. Runtime validation and safe handling of discovery, detail, map, trends, and compare responses.
2. Compare search stale-response protection.
3. Map retry stale-response protection.
4. Strict, bounded trends query validation.
5. Explicit ObjectId validation for public listing detail/deal reads.
6. Locality-load recoverability, plus loading/empty/error/retry behavior directly needed by discovery/compare.
7. Focused backend tests and lightweight frontend verification fixtures/checks if the existing test layout supports them.

### Out of scope

- Favorites, inquiries, saved-search, and notification workflow changes (Slice 6.3).
- Prediction/history/share UX (Slice 6.4).
- Broad accessibility/mobile audit (Slice 6.5).
- Final regression/E2E closure (Slice 6.6).
- Cursor pagination, clustering, new map providers, Redis/Kafka/queues/WebSockets, new services, schema migrations, or speculative indexes.

## 6. Proposed Changes and Exact Files

### Frontend

- `frontend/src/lib/api.ts`: only if needed to expose runtime-parse errors consistently; preserve credentials, CSRF, timeout, refresh, and request IDs.
- `frontend/src/lib/types.ts`: keep compile-time types aligned; add no required fields that break legacy responses.
- `frontend/src/lib/discovery-schemas.ts` (new, only if no existing suitable helper): minimal Zod schemas for listing/pagination/compare/map/trends payloads. Prefer one shared small module over repeated ad-hoc guards.
- `frontend/src/components/listings/listings-browser.tsx`: parse listing responses, preserve generation guard, and add locality-load retry/error handling.
- `frontend/src/components/listings/listing-card.tsx`: only defensive rendering required by the schema contract; no visual redesign.
- `frontend/src/app/listings/[id]/page.tsx`: validate detail/trends/deal payloads and keep controlled retry/error states.
- `frontend/src/components/compare/compare-tool.tsx`: validate search/compare payloads and add generation cleanup for search.
- `frontend/src/components/map/map-view.tsx`: validate marker payloads and guard overlapping retries.
- `frontend/src/app/trends/page.tsx`: validate ranking/trend payloads and preserve existing trend generation guard.

### Backend

- `backend-api/src/routes/listing.routes.js`: reuse `objectIdParamSchema` for public detail and deal reads.
- `backend-api/src/routes/trends.routes.js`: add strict query validation only for supported trends parameters.
- `backend-api/src/validators/trends.schema.js` (new only if no existing shared schema is suitable): allowlisted months/limit/locality/propertyType/city with bounded values.
- `backend-api/src/controllers/trends.controller.js`: consume validated query values without changing response shape.
- `backend-api/src/test/discovery.test.js`, `backend-api/src/test/queryBuilder.test.js`, `backend-api/src/test/trends.test.js`, plus a focused listing-route test if the existing harness supports it.

No Listing schema, lifecycle, compare persistence, ML auth, rate-limit, or SecurityEvent changes are planned.

## 7. API Contract Strategy

- Keep `GET /api/listings` response `{ items, page, limit, total, totalPages }` unchanged.
- Keep `GET /api/listings/:id` and `/deal` status/error semantics unchanged; only make invalid IDs fail earlier with the same controlled 400 contract.
- Keep `POST /api/compare` `{ items, degraded }`, including `predictionStatus: "unavailable"` for partial ML failure.
- Keep map/trends response shapes unchanged; reject malformed query inputs with the existing `{ error, details?, requestId }` error format.
- Runtime-invalid JSON is a frontend recoverable error, never a direct stack trace or Application Error.

## 8. Validation and Security Strategy

- Reuse Zod and existing `validate`/`objectIdParamSchema` patterns; do not accept raw Mongo operators, arbitrary sort fields, unbounded arrays, or unbounded numeric values.
- Preserve `activeListingFilter()` on every public listing-derived path, including map, trends, compare, detail, and saved-search matching.
- Keep compare at 2–3 unique IDs, the existing prediction limiter, optional-auth behavior, and ML service-token boundary.
- Do not expose internal/private listing fields or raw ML/database errors.
- Treat all API JSON as untrusted at the frontend boundary.
- Do not store or introduce browser auth tokens.

## 9. Database and Index Strategy

- No schema migration and no data changes.
- Reuse current active filter and bounded skip/limit.
- Do not add indexes without query-plan evidence. During implementation, inspect existing indexes and document any measured limitation as P3.
- Do not redesign pagination or introduce new infrastructure.

## 10. Test Strategy

### Backend focused tests

1. Public listing detail/deal invalid ObjectIds return controlled 400.
2. Trends rejects unknown/invalid query values and clamps/accepts supported bounds.
3. Discovery still excludes archived listings, preserves stable ordering, bounds page/limit, and rejects Mongo-style operators.
4. Compare still rejects duplicates/too many/invalid IDs, excludes archived listings, preserves requested order, and keeps degraded ML items without leaking internals.

### Frontend checks

- Add the smallest existing-compatible schema/fixture checks for malformed listing, compare, map, and trends payloads if no frontend test harness exists.
- Verify stale generation behavior with deterministic promise ordering where practical; otherwise perform the manual checklist below.

### Required commands after approval

- `backend-api`: `npm test`
- `frontend`: `npm run lint`, `npx tsc --noEmit` (or the repository’s configured equivalent), `npm run build`
- `git diff --check`
- No ML test unless ML code is touched.

## 11. Browser Verification Checklist

1. Open discovery; verify initial loading, successful results, empty result, and API error/retry.
2. Apply each existing filter, sort, and pagination boundary.
3. Change filters rapidly and verify the newest response wins.
4. Open a valid detail; verify invalid/missing/archived detail recovers without an Application Error.
5. Open map/heatmap; verify marker cap, loading, empty, error, retry, and narrow viewport behavior.
6. Compare two and three active listings; verify duplicate/too-many/missing/archived IDs are controlled.
7. Reproduce a partial ML compare failure if available; successful rows remain usable and unavailable rows are explicit.
8. Type rapidly in compare search; verify stale search results do not replace newer results.
9. Inspect the console for new runtime errors and verify no sensitive errors are displayed.

Browser/screen-reader verification is not available from this read-only audit and must be recorded honestly after implementation.

## 12. Rollback and Failure Safety

- Keep changes isolated to the files above and stage only Slice 6.2 files.
- Preserve existing response shapes and use additive frontend validation; a schema rejection falls into the existing retry/error UI rather than mutating data.
- Backend validation changes are limited to earlier rejection of malformed inputs with the existing error contract.
- If a focused change causes a regression, revert only the Slice 6.2 commit/hunks; no database rollback or migration is required.

## 13. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Runtime schema is stricter than an undocumented legacy response | Medium | Derive schemas from current producers/types, keep optional fields optional, add fixtures for current responses. |
| Stale-request guard changes loading timing | Low | Reuse the proven generation pattern already used by listings/trends and test out-of-order promises. |
| Route validation changes malformed-ID status behavior | Low | Preserve the existing 400 error message/class and add focused route tests. |
| Trends callers rely on permissive coercion | Medium | Accept the current supported parameters and preserve existing numeric bounds; reject only unknown/malformed values. |
| Index/performance changes are speculative | Low | No index or pagination redesign in this slice; require measured evidence first. |

## 14. Acceptance Criteria

- Discovery, detail, map, trends, and compare never crash on malformed API payloads; they show controlled recovery states.
- Active-listing exclusion and existing archive semantics remain unchanged.
- Compare remains bounded to existing limits, preserves successful results during ML degradation, and cannot issue stale search results.
- Public detail/deal invalid IDs return controlled 400s without reaching an unvalidated database lookup.
- Trends query inputs are strict, allowlisted, and bounded.
- Loading, empty, error, and retry behavior is deterministic; no duplicate polling or request fan-out is introduced.
- Backend tests, frontend lint/typecheck/build, and `git diff --check` pass.
- No Phase 6.3–6.6 work, dependency upgrade, infrastructure, deployment, commit, or push is performed without explicit authorization.

## 15. Implementation Sequence

1. Reconfirm dirty-worktree baseline and isolate Slice 6.2 files.
2. Add/reuse minimal frontend runtime schemas and parse discovery/compare/map/trends responses.
3. Add compare-search and map retry generation guards with unmount cleanup.
4. Add locality-load recovery and preserve existing loading/empty/error UI.
5. Add public listing detail/deal ObjectId validation.
6. Add strict trends query validation using existing bounds and response contracts.
7. Add focused backend/contract tests and minimal frontend fixtures/checks.
8. Run backend/frontend verification and review the complete diff for scope/security.
9. Perform the browser checklist and report verified vs unverified items.
10. Stop for review; commit/push only if separately authorized.

## 16. Final Audit Gate

This document is the implementation plan only. No Slice 6.2 code has been implemented in this audit. Proceed to implementation only after explicit approval.
