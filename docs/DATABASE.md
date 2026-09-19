# RealtyIQ Database Reference

## 1. Overview

The Express API uses MongoDB through Mongoose. Schema definitions in `backend-api/src/models` are authoritative. The database name in local defaults is `realtyiq`. There is no migration framework, schema-version collection, transaction workflow, or database-level row security.

## 2. Collections

### `users`

| Field | Type | Rules / meaning |
|---|---|---|
| `_id` | ObjectId | Primary identifier |
| `name` | String | Required, trimmed, 2–80 characters |
| `email` | String | Required, lowercase/trimmed, unique |
| `passwordHash` | String | Required; bcryptjs hash, never API output |
| `role` | String | `user`, `agent`, `broker`, or `admin`; default `user` |
| `isActive` | Boolean | Default `true`; authenticated middleware denies false |
| `refreshTokens` | String[] | Server-side refresh-token allowlist, capped to latest five |
| `favorites` | ObjectId[] | References `Listing` |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes: unique email index (schema also declares indexing). Role and active status have no explicit compound admin index.

Serialization removes `passwordHash`, `refreshTokens`, and `__v`.

### `listings`

| Field | Type | Rules / meaning |
|---|---|---|
| `_id` | ObjectId | Primary identifier |
| `title` | String | Required, trimmed, max 160 |
| `city` | String | Required, trimmed; default `Bengaluru` |
| `locality` | String | Required, trimmed |
| `propertyType` | String | `Apartment`, `Villa`, or `Plot` |
| `areaType` | String | Optional model-facing area classification |
| `availabilityStatus` | String | `Ready To Move` or `Under Construction` |
| `totalSqft` | Number | Required, positive |
| `bhk`, `bath` | Number | Required, positive integers |
| `balcony` | Number | Non-negative integer; default 0 |
| `price` | Number | Required INR amount, positive |
| `pricePerSqft` | Number | Derived from `price / totalSqft` by model middleware |
| `location.lat`, `location.lng` | Number | Optional approximate coordinates |
| `images` | String[] | URL strings; default empty |
| `description` | String | Default empty; max 2,000 |
| `listedDate` | Date | Default now; used for trends/sorting |
| `createdBy` | ObjectId | Optional `User` reference |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes: individual indexes on city, locality, property type, BHK, price, and listed date; compound `{ locality: 1, price: 1 }`.

### `predictions`

| Field | Type | Rules / meaning |
|---|---|---|
| `_id` | ObjectId | Public share identifier and history key |
| `user` | ObjectId/null | Optional `User` reference; absent for anonymous prediction |
| `input` | Object | Submitted model input snapshot |
| `predictedPrice` | Number | Required INR output |
| `confidenceLow`, `confidenceHigh` | Number | Required model confidence bounds |
| `pricePerSqft` | Number | Required derived model output |
| `modelName` | String | Required runtime model identity |
| `locality` | String | Required, indexed analytics dimension |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes: `user` and `locality`. History sorts `createdAt` descending and limits to 50.

### `savedsearches`

| Field | Type | Rules / meaning |
|---|---|---|
| `_id` | ObjectId | Identifier |
| `user` | ObjectId | Required `User` reference |
| `name` | String | Required display name |
| `filters` | Object | Listing-query filter snapshot |
| `lastNotifiedCount` | Number | Match count last acknowledged; default 0 |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Index: `user`. Match/new-match values returned by the API are computed, not stored.

### `inquiries`

| Field | Type | Rules / meaning |
|---|---|---|
| `_id` | ObjectId | Identifier |
| `user` | ObjectId | Required, indexed `User` reference |
| `listing` | ObjectId | Required, indexed `Listing` reference |
| `message` | String | Required, trimmed, max 1,000 |
| `status` | String | `new`, `contacted`, or `closed`; default/indexed `new` |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

## 3. Relationships and ownership

- Users own their saved searches, inquiries, and authenticated prediction history.
- Favorites are embedded references on the user document rather than a join collection.
- Listings optionally record the admin creator.
- Admins can view all inquiries and manage all listings/users; customer reads are owner-filtered where appropriate.
- Prediction share-by-ID is intentionally public and bypasses ownership checks.

## 4. Derived and analytical data

- `pricePerSqft` is recalculated on listing save/update from price and area.
- Trend series group listings by `listedDate` month and average listing price/price per square foot.
- Locality ranking groups listings and excludes groups below three documents.
- Admin top-search data groups prediction documents by locality.
- Saved-search counts execute the listing query reconstructed from the stored filter object.

These are listing/prediction analytics, not transaction facts or precomputed warehouse metrics.

## 5. Seed and dataset mapping

`npm run seed`:

1. Connects using `MONGODB_URI`.
2. Deletes all `User` and `Listing` documents.
3. Creates `admin@realtyiq.dev` / `Admin@12345` and `demo@realtyiq.dev` / `Demo@12345`.
4. Reads up to 600 rows from `ml-service/data/bengaluru_clean.csv`.
5. Maps model columns to listing documents, assigns approximate deterministic coordinates/images, and distributes `listedDate` across 24 months.

The credentials are demo-only and must be replaced/removed in a real deployment. The seed is destructive and does not clear every dependent collection, so use only on disposable/demo databases.

## 6. Integrity and lifecycle risks

- Mongoose references do not enforce foreign keys or cascades.
- Listing deletion may leave favorite IDs and inquiry references.
- Self-service account deletion removes that user's predictions, saved searches, and inquiries, but can leave optional listing `createdBy` references.
- Seed can leave predictions/saved searches/inquiries pointing to deleted users/listings.
- No unique saved-search name, duplicate inquiry prevention, soft-delete, audit trail, retention TTL, or optimistic concurrency contract exists.
- Self-service account deletion uses one MongoDB transaction for the user's predictions, saved searches, inquiries, and User document; transaction failures fail closed. Other multi-document auth/account/admin operations remain non-transactional.

## 7. Backup, restore, migration, and privacy

Deployment assumes MongoDB Atlas but the repository contains no executable backup/restore feature. Use provider backups/export procedures and verify restoration separately. Before any schema-breaking change:

1. Define forward and rollback transformations.
2. Back up the target database and test restore.
3. Add indexes outside peak traffic where relevant.
4. Deploy readers compatible with old/new shapes before writers when possible.
5. Record a schema version or migration ledger.

No retention/privacy policy is encoded. Prediction inputs, inquiries, account data, and refresh tokens require an explicit production policy.
