# RealtyIQ v1.0.0

## Release Summary

RealtyIQ v1.0.0 is the verified production release of the Bengaluru-focused
real-estate valuation application. It includes the same-origin frontend API
proxy, Express readiness contract, authenticated service-to-service ML path,
browser E2E foundation, CI validation, and the associated security and API
contract documentation.

## Release Identity

- Version: `v1.0.0`
- Git tag: `v1.0.0`
- Production commit: `b2e071098484cceb108521f2635c7c0663cafdbd`
- Branch: `main`

## Production Verification

The following are **supplied release verification evidence**. They were not
independently rerun during this documentation change:

- User authentication and session persistence
- Route guards and admin authorization
- Admin analytics and history logging
- Favorites storage
- CSRF enforcement
- Input validation and rate limiting
- RBAC
- MongoDB Atlas index and TTL verification
- ML model serving and inference output verification
- Vercel-to-Render integration

## Security Verification

The release uses HttpOnly access and refresh cookies, Secure production cookie
settings, SameSite controls, CSRF double-submit protection, Express-side RBAC,
validated inputs, rate limiting, request IDs, sanitized errors, and an
authenticated Express-to-ML service boundary. Server-side configuration and
tokens are not intended for browser exposure.

## Database Verification

The release uses MongoDB/Mongoose ownership checks, documented indexes, and TTL
indexes where defined by the models. Atlas topology, backup, restore, network,
TLS, and role controls remain provider-operated concerns and must be verified
through provider access when operational changes are made.

## ML Verification

The production verification record identifies a live GradientBoosting Regressor
serving Bengaluru predictions with a point estimate, price-per-square-foot value,
and a 95% confidence interval. No model metric is asserted here; deployed
artifact identity and runtime compatibility remain release-operation checks.

## Deployment Verification

The verified production topology is Vercel for the Next.js frontend, Render for
the Express API and FastAPI ML service, and MongoDB Atlas for persistence. Browser
traffic uses the same-origin frontend proxy; the API and ML services are not
selected by browser input.

## CI Verification

Repository CI uses GitHub Actions with lockfile installs, Node 20, frontend lint,
TypeScript, build, Playwright Chromium/E2E, and backend tests. Remote CI status
must be checked against the exact release commit when repeating the release
process.

## Known Limitations

- Product and ML scope are Bengaluru-focused.
- Map coordinates are approximate locality coordinates.
- Saved-search notifications are polling/count deltas, not push or email delivery.
- The repository has no general migration framework.
- The repository does not provide backup/restore automation.
- Runtime, backups, networking, and provider retention controls are provider-dependent.
- Free-tier services may cold-start after idle periods.

## Operational Notes

- `PROXY_UPSTREAM_API_ORIGIN` is server-only configuration for the frontend proxy.
- Keep the `v1.0.0` tag and production commit available for release identification.
- Repeat health, authentication, proxy, ML, and persistence checks after provider changes.
- Never place secrets, cookies, JWTs, service tokens, or database credentials in source or documentation.
