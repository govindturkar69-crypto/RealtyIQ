# RealtyIQ API Reference

## 1. Conventions

- Express base URL: `http://localhost:8000`; application routes use `/api`.
- ML base URL: `http://localhost:8001`; normally called only by Express.
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
| GET | ML `/health` | Internal/public by deployment | `{ status, model_loaded, model_name }` |

The Express health endpoint does not prove MongoDB or ML readiness. Admin ML status calls the ML health/info endpoints.

## 3. Authentication and accounts

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| POST | `/api/auth/signup` | Public, auth-limited | `{ name, email, password }`; creates role `user`, returns user + tokens |
| POST | `/api/auth/login` | Public, auth-limited | `{ email, password }`; returns user + tokens |
| POST | `/api/auth/refresh` | Public, auth-limited | `{ refreshToken }`; rotates access and refresh tokens |
| GET | `/api/auth/me` | Authenticated | Current sanitized user |
| PATCH | `/api/auth/me` | Authenticated | `{ name }`; updates own profile |
| PATCH | `/api/auth/password` | Authenticated | `{ currentPassword, newPassword }`; revokes stored refresh sessions |
| POST | `/api/auth/logout` | Authenticated | `{ refreshToken }`; removes that refresh token |
| DELETE | `/api/auth/me` | Authenticated | Deletes own account and controller-associated activity |
| GET | `/api/auth/admin/users` | Admin | Lists registered users |
| PATCH | `/api/auth/admin/users/:id` | Admin | `{ role?, isActive? }`; guards last active admin |

Passwords are minimum eight characters. Login does not disclose whether email or password was wrong. Disabled users cannot pass authenticated middleware.

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
| GET | `/api/predict/history` | Authenticated | Latest 50 predictions owned by user |
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
| GET | `/api/favorites` | Authenticated | Populated favorite listings |
| GET | `/api/favorites/ids` | Authenticated | Favorite listing IDs |
| POST | `/api/favorites/:id` | Authenticated | Adds listing if not already present |
| DELETE | `/api/favorites/:id` | Authenticated | Removes listing reference |

## 8. Saved searches and alerts

| Method | Path | Access | Request / result |
|---|---|---|---|
| GET | `/api/saved-searches` | Authenticated | Owned searches with computed `matchCount` and `newMatches` |
| POST | `/api/saved-searches` | Authenticated | `{ name, filters }` |
| POST | `/api/saved-searches/:id/mark-notified` | Owner | Stores current match count as acknowledged |
| DELETE | `/api/saved-searches/:id` | Owner | Deletes saved search |

Stored filters correspond to supported listing query fields. Alerts are computed on read; there is no delivery endpoint or background job.

## 9. Inquiries

| Method | Path | Access | Request / result |
|---|---|---|---|
| GET | `/api/inquiries` | Authenticated | User's inquiries populated with listing summary |
| POST | `/api/inquiries` | Authenticated | `{ listingId, message }`, message length 10–1000 |
| GET | `/api/inquiries/admin` | Admin | All inquiries with user/listing summaries |
| PATCH | `/api/inquiries/admin/:id` | Admin | `{ status: "new" | "contacted" | "closed" }` |

## 10. FastAPI ML endpoints

| Method | Path | Request / result |
|---|---|---|
| GET | `/health` | Runtime health and loaded-model state |
| GET | `/localities` | Categorical enums and numeric ranges from metadata |
| GET | `/model-info` | Model metadata and evaluation information |
| GET | `/feature-importance?top=15` | Ranked importance list |
| POST | `/predict` | Pydantic-validated prediction input/output described above |

Model input bounds: `total_sqft` greater than 100 and less than 50,000; BHK/bath 1–20; balcony 0–10; area type and availability must be allowed values. Location validity is resolved by predictor metadata/model behavior.

## 11. Failure mapping and limits

- Express JSON body cap: 1 MiB; CSV import: 5 MiB.
- General API limiter: configured default 200 requests/15 minutes; auth default 5/minute.
- ML prediction timeout: 8 s; options/importances: 5 s; health/info: 3 s.
- FastAPI 422 is adapted to an API 400; unreachable service to 502; timeout to 504.
- Invalid ObjectIds, missing resources, owner mismatch, inactive account, and role mismatch are rejected by their route/controller middleware paths.

The Express API has no OpenAPI document, version prefix, idempotency keys, cache contract, or deprecation policy. Treat this file and validators/routes as the current manual contract.
