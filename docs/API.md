# RealtyIQ API Reference

## 1. Conventions

- Express base URL: `http://localhost:8000`; application routes use `/api`.
- ML base URL: `http://localhost:8001`; normally called only by Express and protected by
  the shared `ML_SERVICE_TOKEN`.
- Protected Express endpoints require `Authorization: Bearer <accessToken>`.
- Roles: `user`, `agent`, `broker`, `admin`; “admin” below means admin-only middleware.
- Express success responses are JSON unless a delete returns a simple message. Errors use:

```json
{ "error": "Human-readable message", "details": [], "requestId": "..." }
```

`details` is validation-dependent. Production internal errors are masked. FastAPI errors use `{ "detail": "..." }`.

## 2. Health

| Method | Path | Access | Result |
|---|---|---|---|
| GET | `/health` | Public | API status and timestamp |
| GET | ML `/health` | Public health probe | `{ status, model_loaded, model_name }` |
| GET | ML `/localities`, `/model-info`, `/feature-importance` | Service token | ML metadata |
| POST | ML `/predict` | Service token | Prediction result |

The Express health endpoint does not prove MongoDB or ML readiness. Admin ML status calls the ML health/info endpoints.

## 3. Authentication and accounts

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| POST | `/api/auth/signup` | Public, auth-limited | `{ name, email, password }`; establishes cookies and returns tokens only when cookie-only mode is disabled |
| POST | `/api/auth/login` | Public, auth-limited | `{ email, password }`; establishes cookies and returns tokens only when cookie-only mode is disabled |
| GET | `/api/auth/csrf` | Public, safe bootstrap | Returns `{ csrfToken }` and sets/preserves the non-HttpOnly `riq_csrf` double-submit cookie; the token is held in frontend memory only |
| POST | `/api/auth/refresh` | Public, auth-limited | Optional `{ refreshToken }`; cookie or body token is atomically rotated |
| GET | `/api/auth/me` | Authenticated | Current sanitized user |
| PATCH | `/api/auth/me` | Authenticated | `{ name }`; updates own profile |
| PATCH | `/api/auth/password` | Authenticated | `{ currentPassword, newPassword }`; revokes stored refresh sessions |
| POST | `/api/auth/logout` | Authenticated | `{ refreshToken }`; revokes the presented token and invalidates the account's access-token version |
| DELETE | `/api/auth/me` | Authenticated | Deletes own account and controller-associated activity |
| GET | `/api/auth/admin/users` | Admin | Lists registered users |
| PATCH | `/api/auth/admin/users/:id` | Admin | `{ role?, isActive? }`; guards last active admin |

Passwords are minimum eight characters. Login does not disclose whether email or password was wrong. Disabled users cannot pass authenticated middleware.

Cross-origin browser clients bootstrap CSRF with `GET /api/auth/csrf` using credentials, retain the returned token in memory, and send it as `X-CSRF-Token` on unsafe requests. The API requires that header to match the host-only `riq_csrf` cookie; authentication cookies remain HttpOnly.

## 4. Listings

| Method | Path | Access | Request / result |
|---|---|---|---|
| GET | `/api/listings` | Public | Filtered, sorted, paginated `{ items, page, limit, total, totalPages }` |
| GET | `/api/listings/meta/localities` | Public | `{ localities: string[] }` from MongoDB |
| GET | `/api/listings/:id` | Public | One listing |
| GET | `/api/listings/:id/deal` | Public | Listing price vs ML estimate/confidence and deal verdict |
| POST | `/api/listings` | Admin | Creates a listing |
| PATCH | `/api/listings/:id` | Admin | Partial listing update |
| DELETE | `/api/listings/:id` | Admin | Deletes a listing |
| POST | `/api/listings/import` | Admin | `Content-Type: text/csv`, max 5 MiB and 1–1000 rows; `{ imported }` |

List query parameters:

| Parameter | Meaning |
|---|---|
| `search` | Case-insensitive title/locality text search |
| `city`, `locality` | Case-insensitive exact match |
| `propertyType`, `areaType`, `availabilityStatus` | Exact enum/value filters |
| `bhk` | Exact bedrooms |
| `bath` | Minimum bathrooms |
| `minSqft`, `maxSqft`, `minPrice`, `maxPrice` | Numeric ranges |
| `sort` | `newest`, `price_asc`, `price_desc`, `sqft_desc`, `ppsf_asc` |
| `page`, `limit` | Pagination; limit is capped at 100 |

Listing body fields: `title`, `city`, `locality`, `propertyType`, `areaType`, `availabilityStatus`, `totalSqft`, `bhk`, `bath`, `balcony`, `price`, optional `location`, `images`, `description`, and `listedDate`. The server derives `pricePerSqft`.

CSV headers use the same camelCase names. Defaults exist for city, property type, area type, availability, and balcony; `images` is a semicolon-separated list. The entire parsed batch is validated before insert.

## 5. Predictions

| Method | Path | Access | Request / result |
|---|---|---|---|
| POST | `/api/predict` | Public; optional auth | Model input; returns ML result plus `predictionId` and persists it |
| GET | `/api/predict/options` | Public | ML categorical options/numeric ranges; locality fallback from MongoDB |
| GET | `/api/predict/feature-importance?top=10` | Public | Ranked model feature importance |
| GET | `/api/predict/history` | User or admin | Latest 50 predictions owned by the current account |
| GET | `/api/predict/:id` | Public | Stored prediction used for share links |

Prediction input:

```json
{
  "location": "Whitefield",
  "area_type": "Super built-up Area",
  "availability_status": "Ready To Move",
  "total_sqft": 1200,
  "bhk": 2,
  "bath": 2,
  "balcony": 1
}
```

Core output fields are `predicted_price`, `confidence_low`, `confidence_high`, `confidence_interval_pct`, `price_per_sqft`, `currency`, and `model_name`.

## 6. Comparison, trends, and analytics

| Method | Path | Access | Request / result |
|---|---|---|---|
| POST | `/api/compare` | Public | `{ listingIds: [2–3 IDs] }`; listing/spec/ML/deal item per ID |
| GET | `/api/trends` | Public | Query `locality?`, `months?`; monthly average listing price and price/sqft |
| GET | `/api/trends/ranking` | Public | Locality ranking; groups require at least 3 listings |
| GET | `/api/trends/admin/stats` | Admin | Listing/prediction/user totals and top predicted localities |
| GET | `/api/trends/admin/ml-status` | Admin | Combined ML health/model information |

Deal semantics: listed price more than 7% below prediction is `underpriced`, more than 7% above is `overpriced`, otherwise `fair`. Comparison can return `unknown` if ML evaluation fails.

## 7. Favorites

| Method | Path | Access | Result |
|---|---|---|---|
| GET | `/api/favorites` | User or admin | Populated favorite listings |
| GET | `/api/favorites/ids` | User or admin | Favorite listing IDs |
| POST | `/api/favorites/:id` | User or admin | Adds listing if not already present |
| DELETE | `/api/favorites/:id` | User or admin | Removes listing reference |

## 8. Saved searches and alerts

| Method | Path | Access | Request / result |
|---|---|---|---|
| GET | `/api/saved-searches` | User or admin | Owned searches with computed `matchCount` and `newMatches` |
| POST | `/api/saved-searches` | User or admin | `{ name, filters }` |
| POST | `/api/saved-searches/:id/mark-notified` | Owner | Stores current match count as acknowledged |
| DELETE | `/api/saved-searches/:id` | Owner | Deletes saved search |

Stored filters correspond to supported listing query fields. Alerts are computed on read; there is no delivery endpoint or background job.

## 9. Inquiries

| Method | Path | Access | Request / result |
|---|---|---|---|
| GET | `/api/inquiries` | User or admin | Current account's inquiries populated with listing summary |
| POST | `/api/inquiries` | User or admin | `{ listingId, message }`, message length 10–1000 |
| GET | `/api/inquiries/admin` | Admin | All inquiries with user/listing summaries |
| PATCH | `/api/inquiries/admin/:id` | Admin | `{ status: "new" | "contacted" | "closed" }` |

## 10. FastAPI ML endpoints

| Method | Path | Request / result |
|---|---|---|
| GET | `/health` | Runtime health and loaded-model state |
| GET | `/localities` | Service-token protected metadata |
| GET | `/model-info` | Service-token protected model metadata |
| GET | `/feature-importance?top=15` | Service-token protected ranked importance list |
| POST | `/predict` | Service-token protected, Pydantic-validated prediction |

Model input bounds: `total_sqft` greater than 100 and less than 50,000; BHK/bath 1–20; balcony 0–10; area type and availability must be allowed values. Location validity is resolved by predictor metadata/model behavior.

## 11. Failure mapping and limits

- Express JSON body cap: 1 MiB; CSV import: 5 MiB.
- General API limiter: configured default 200 requests/15 minutes; auth default 5/minute.
- ML prediction timeout: 8 s; options/importances: 5 s; health/info: 3 s.
- FastAPI 422 is adapted to an API 400; unreachable service to 502; timeout to 504.
- ML upstream exception details are not forwarded to API clients; production responses use
  generic failure messages.
- Invalid ObjectIds, missing resources, owner mismatch, inactive account, and role mismatch are rejected by their route/controller middleware paths.

The Express API has no OpenAPI document, version prefix, idempotency keys, cache contract, or deprecation policy. Treat this file and validators/routes as the current manual contract.
