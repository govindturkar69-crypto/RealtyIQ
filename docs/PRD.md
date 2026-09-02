# RealtyIQ Product Requirements Document

## 1. Product summary

RealtyIQ is a Bengaluru-focused real-estate decision-support application. It combines property listings with machine-learning price estimates, confidence ranges, market trends, comparisons, maps, saved activity, and inquiry workflows. The product deliberately exposes two related experiences over the same data:

- **User panel** for registered `user` accounts: discover, value, compare, save, and inquire.
- **Admin panel** for `admin`: every user-panel capability plus listing/account operations, inquiry processing, analytics, and model health.

The system is informational. Model estimates, deal labels, EMI outputs, and ROI scenarios are not financial advice.

## 2. Goals and success criteria

### Goals

1. Produce an explainable property-price estimate from a short structured form.
2. Help users judge listings through comparable data, trends, maps, and deal labels.
3. Preserve user activity across sessions: prediction history, favorites, saved searches, and inquiries.
4. Give administrators a separate operational workspace connected to the same listings, users, predictions, inquiries, and ML service.
5. Remain deployable as three small services with MongoDB Atlas, Render, and Vercel.

### Current measurable signals

- Prediction requests and persisted prediction count.
- Registered and active accounts.
- Listing inventory and imports.
- Most-predicted localities and average predicted price.
- Inquiry volume/status.
- ML availability and checked-in evaluation metrics.

Revenue, subscriptions, conversion funnels, notification delivery, and recommendation click-through are not implemented and therefore are not current success metrics.

## 3. Personas and permissions

| Persona | Role value | Primary experience | Effective permissions |
|---|---|---|---|
| Customer | `user` | Customer panel | All public discovery plus history, favorites, saved searches, alerts, profile, and inquiries |
| Agent | `agent` | No panel assigned | Can authenticate but cannot use protected user/admin panel APIs |
| Broker | `broker` | No panel assigned | Can authenticate but cannot use protected user/admin panel APIs |
| Administrator | `admin` | Admin + user panels | Every user feature plus listing CRUD/import, user role/status management, inquiry status management, admin analytics and ML status |
| Visitor | none | Public site | Landing, listings, details, prediction submission, trends, map, comparison, public shared result |

Public prediction submission is intentional. If a valid access token is present, the prediction is associated with the account; otherwise it is stored anonymously.

## 4. Functional requirements

### 4.1 Public discovery and valuation

- Browse and paginate listings; filter by text, locality, property type, BHK, minimum bathrooms, availability, size, and price; sort by newest, price, size, or price per square foot.
- View listing details, specifications, image, locality trend, ML deal comparison, EMI scenario, ROI scenario, and recently viewed properties.
- Submit a three-step prediction form using ML-provided localities/options.
- Display predicted INR price, 95% confidence bounds, price per square foot, model name, feature importance, similar listings, and client-generated PDF.
- Open a shared prediction at `/r/:id` when given its identifier.
- Compare two or three listings side-by-side. ML failure for one item must not erase the remaining listing comparison.
- View monthly listing-derived trends, locality rankings, and an approximate listing heatmap.

### 4.2 Customer panel

- Create an account, log in, refresh a session, log out, edit name, change password, and delete the account.
- View the latest 50 account-linked predictions.
- Add/remove favorites and view the favorite collection.
- Save current listing filters, see current and new match counts, mark results seen, reopen, and delete saved searches.
- View a notification center combining saved-search match deltas and inquiry status.
- Send a 10–1000 character inquiry for a listing and see its current status.

### 4.3 Admin panel

- Provide access to every user-panel route and API under the administrator's own account.
- Route non-admin users away from `/admin`; enforce all admin mutations again on the API.
- Show totals for listings, predictions, and users plus most-searched localities.
- Show ML online/model-loaded state, model identity, training time when available, row counts, and metrics when supplied by the ML metadata.
- Add, edit, and delete listings; import 1–1000 CSV rows in one request.
- View users, assign `user`/`agent`/`broker`/`admin`, and enable/disable accounts.
- Protect the last active administrator from demotion, disabling, or deletion through admin management.
- View all inquiries and move them through `new`, `contacted`, and `closed`.

## 5. Business rules

- Prices are stored and returned in INR as numeric values; seeded source prices are converted from lakhs.
- A deal is `underpriced` or `overpriced` when listed price differs from the estimate by more than 7%; otherwise it is `fair`. Missing ML output yields `unknown` in comparison.
- Saved-search “new” counts equal `max(current matches - lastNotifiedCount, 0)`; there is no background delivery job.
- Ranking includes localities with at least three listings.
- Account passwords require at least eight characters; stored password hashes use bcryptjs.
- Access and refresh tokens rotate through the API; password change invalidates stored refresh sessions.
- Disabled accounts are denied by authenticated API middleware.
- CSV import accepts the columns documented in [API.md](API.md), applies defaults, and rejects an invalid batch rather than partially importing it.

## 6. Non-functional requirements

- Responsive light/dark interface; form labels, visible errors, loading placeholders, keyboard-operable native controls, and meaningful image alt text.
- Strict TypeScript and bounded API input validation.
- Production secret validation, CORS restriction, security headers, request correlation IDs, rate limiting, and generic internal errors.
- Prediction proxy timeout of 8 seconds; supporting ML reads have shorter timeouts.
- Listing query limit capped at 100; CSV import capped at 1,000.
- Services expose health endpoints suitable for deployment monitoring.

No formal availability, latency percentile, recovery-time, recovery-point, accessibility-conformance, or data-retention SLO is defined in the repository.

## 7. Out of scope / not implemented

- Direct listing creation by agents, brokers, sellers, or customers.
- Personalized recommendation engine or predictive 1-/5-year price forecast.
- Investment risk scoring, mortgage eligibility, payments, plans, or billing.
- Email, SMS, web push, real-time chat, or agent assignment.
- Blog/news CMS, documents/videos per property, bulk Excel upload, audit log UI, or backup/restore UI.
- Revenue analytics, demand forecasting, true geospatial hotspot prediction, or historical transaction data.
- Multi-city production model behavior despite broad marketing copy.

## 8. Known product gaps and decisions needed

1. Decide whether `agent` and `broker` remain labels or gain distinct capabilities.
2. Reconcile “Indian cities” marketing copy with Bengaluru-only model/options and seed data.
3. Define privacy/retention policy for prediction inputs, inquiries, refresh tokens, and deleted accounts.
4. Decide whether public shared prediction records should be guessable by MongoDB identifier indefinitely.
5. Define ownership/contact routing for inquiries; the current workflow is a shared admin queue.
6. Define whether trends are listing-market indicators or transaction-market indicators; current data is listings only.

## 9. Acceptance baseline

A release is product-complete for the current scope when a visitor can browse and predict, a customer can retain activity and inquire, an administrator can operate shared data from a distinct panel, Express authorization prevents privilege bypass, and all three services can start with documented environment variables. Verification expectations are in [TESTING.md](TESTING.md).
