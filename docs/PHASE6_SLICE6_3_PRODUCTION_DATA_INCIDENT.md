# Phase 6.3 Saved Search Production Data Incident

## Incident status

**Open — remediation decision pending.**

This document records a read-only production observation. No production
records were modified, deleted, archived, recreated, or migrated.

## Evidence

An authenticated `GET /api/saved-searches` request returned HTTP `200` with
seven saved-search records:

- Three records contained valid scalar `filters` values.
- Four records were malformed because the `filters` field was completely
  missing.
- The four malformed records were named `My search` and reported
  `matchCount = 600`.

Affected SavedSearch document IDs:

1. `6aa52044c6827a8b8ed0d940`
2. `6aa51fc7c6827a8b8ed0d92d`
3. `6aa517ebb288d6b9b5336702`
4. `6aa51796b288d6b9b53366ce`

The IDs above are document identifiers only. No credentials, cookies, tokens,
passwords, or other secrets are recorded here.

## Current write-path verification

The supported production creation path was verified to:

1. Require `filters` in the saved-search request validator.
2. Validate the nested filter object.
3. Pass the validated request body, including `filters`, to
   `SavedSearch.create()`.
4. Persist and return `filters` in the created document.

Repository evidence is present in:

- `backend-api/src/routes/savedSearch.routes.js`
- `backend-api/src/validators/savedSearch.schema.js`
- `backend-api/src/controllers/savedSearch.controller.js`
- `backend-api/src/models/SavedSearch.js`
- `frontend/src/components/listings/save-search-button.tsx`
- `frontend/src/lib/api.ts`

The repository audit found no alternate `SavedSearch` creation writer, direct
collection write, replacement update, `$unset`, or background writer that
removes `filters`. The current supported writer therefore cannot create a
missing-filter record through the normal endpoint.

## Root cause

The four documents are classified as **legacy or externally-created malformed
production data**. A current supported POST request is not the demonstrated
cause.

The exact historical insertion mechanism is not established. Possible causes
include an older divergent runtime, direct database insertion, or another
provider-side process not present in this repository.

## Impact

The frontend runtime schema correctly rejects records without `filters` and
shows a controlled recovery state instead of rendering unsafe data. The
affected searches cannot safely be reconstructed from the currently visible
fields.

Replacing a missing filter object with `{}` is unsafe because it changes the
search semantics to an unrestricted “all listings” search. It could also
produce incorrect match counts and notifications.

## Current safeguards

- Frontend saved-search responses are runtime-validated with Zod.
- `filters` must be a non-null record of scalar string, finite-number, or
  boolean values.
- Malformed responses enter a controlled error/retry state.
- New POST requests require validated `filters`.
- Saved-search ownership is enforced by the authenticated backend route.
- No automatic data repair or destructive cleanup is enabled.

## Remediation decision

Preserve the four affected records pending an explicit product/data decision.

- Recreate a record only when its original filter definition is known.
- Do not infer filters from the name, match count, timestamps, or document ID.
- Archive, delete, or otherwise alter a malformed record only after explicit
  approval and an auditable recovery procedure.
- Do not add an automatic `{}` default or migration.

No code fix is currently justified because the verified current writer already
requires and persists `filters`.

## Closure criteria

This incident can be closed when all of the following are documented:

1. The disposition of each affected ID is explicitly approved.
2. Any approved recreation uses a confirmed original filter definition.
3. No automatic mutation is applied to records whose search definition is
   unknown.
4. A production-safe verification confirms newly-created searches continue to
   persist `filters`.
5. Strict frontend validation remains enabled.

The unrelated browser error involving `reportAllChanges` and `startTime` is
not part of this incident. It does not occur in the saved-search write/read
path and must be investigated separately if needed.

## Change and safety record

- Application code changed: **No**
- Production data changed: **No**
- Schema or validation changed: **No**
- Migration or seed run: **No**
- Deployment performed: **No**
- Commit or push performed: **No**
