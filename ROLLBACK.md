# Production Rollback

## Rollback Triggers

Consider rollback for a confirmed production regression, failed deployment,
severe API failure, broken authentication, or an incompatible ML release.
Warnings alone are not sufficient; first confirm impact and the deployed
revision.

## Identify Current Release

Use provider deployment metadata and the production health response to identify
the active frontend/API/ML revisions. Record the commit, tag, time, and affected
service before changing anything.

## Identify Known-Good Release

Prefer a previously verified Git tag and commit. For this release:

```text
v1.0.0 → b2e071098484cceb108521f2635c7c0663cafdbd
```

## Provider Rollback Procedure

Use the provider-supported rollback control or redeploy the approved known-good
commit through the normal provider workflow. Confirm the resulting deployment
revision before testing. Do not force-push, rewrite Git history, or use
destructive worktree cleanup as a production rollback method.

## Post-Rollback Verification

Verify:

- frontend page load
- `/api/health`
- `/api/ready`
- login, `/api/auth/me`, and logout
- CSRF bootstrap and one protected request
- `/api/*` routing and proxy error handling
- prediction and history persistence
- ML `/health` and unauthorized protected-route behavior

Record request IDs and results for the incident record.

## Database Warning

Application rollback does **not** automatically mean database rollback.
Destructive or irreversible database changes require migration-specific recovery,
backup/restore evidence, compatibility review, and explicit approval. Never
assume that an older application can safely read newer production data.

## ML Compatibility

Before rolling back application code, verify that the model artifact, runtime,
dependencies, feature schema, and prediction response contract are compatible.
Do not pair an older API with an incompatible deployed ML artifact.

## Authentication and Session Considerations

Rollback can affect cookie attributes, token validation, refresh rotation, or
CSRF behavior. Recheck session restoration, logout, cookie clearing, and
protected-route denial after the rollback. Do not ask users to disclose tokens.

## Incident Communication

Record impact, start/end times, deployed and rollback revisions, request IDs,
provider actions, data observations, and follow-up owners. Preserve evidence
before cleanup and communicate clearly when service behavior has stabilized.
