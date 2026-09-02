# RealtyIQ UI/UX Specification

## 1. Experience model

RealtyIQ uses one public product shell with role-aware navigation and two connected authenticated workspaces:

- **User workspace:** task-oriented discovery, valuation, saving, and communication for `user`.
- **Admin workspace:** every user capability plus dense operational controls for `admin`.

Both use the same theme tokens, navbar, footer, API, and underlying records. They differ in information density, navigation, permissions, and primary calls to action.

## 2. Information architecture

### Public routes

| Route | Purpose |
|---|---|
| `/` | Marketing summary, trust/model claims, workflow, calls to predict/browse |
| `/predict` | Three-step valuation form |
| `/results` | Most recent browser-session prediction result |
| `/r/[id]` | Public persisted prediction share page |
| `/listings` | Search/filter/sort/paginate inventory |
| `/listings/[id]` | Listing, deal estimate, calculators, inquiry, trend, recents |
| `/trends` | Monthly listing trends and locality ranking |
| `/map` | Approximate listing marker/heatmap view |
| `/compare` | Two-to-three listing comparison |
| `/login`, `/signup` | Account entry |

Prediction history, favorites, saving, and inquiries require authentication even though prediction submission itself is public.

### Customer routes

| Route | Purpose |
|---|---|
| `/dashboard` | Prediction history, profile, password, account deletion |
| `/favorites` | Favorite listing collection |
| `/saved` | Saved filters, current/new matches, acknowledge/delete |
| `/notifications` | Saved-search deltas and inquiry statuses |

Users and admins may access these routes. Agent and broker accounts have no assigned protected panel.

### Admin route

`/admin` contains overview metrics, ML status, listing create/edit/delete/import, user roles/status, and inquiry workflow. Admin navigation also exposes the complete user feature set, including dashboard, prediction, listings, trends, map, comparison, favorites, saved searches, and alerts.

## 3. Navigation behavior

- Sticky desktop navbar with RealtyIQ home link, active-route treatment, theme toggle, and auth actions.
- Visitor links: Predict, Listings, Trends, Map, Compare plus Login/Sign up.
- Signed-in customer adds Favorites, Saved, Alerts, and first-name dashboard link.
- Admin receives the admin link plus every user link and an Admin identity button.
- User/admin alert badges poll saved searches every 60 seconds and reload on route changes.

Current limitation: primary navigation is hidden below the `md` breakpoint without an implemented mobile menu, leaving only brand/theme/auth actions. This is a material responsive UX gap.

## 4. Core journeys

### Get a valuation

1. Open `/predict`.
2. Wait for ML options; if the ML service fails, the API can fall back to database localities, but other enum/range data may be limited.
3. Complete location/type, property specifications, and review steps with per-step validation.
4. Submit to Express/FastAPI.
5. Open `/results`, which reads the latest result from `sessionStorage`.
6. Review price/confidence/model, feature importance, similar listings, EMI, and export/share options.

Direct navigation to `/results` without session state must show an empty/recovery state. Durable sharing uses `/r/[id]`, not `/results`.

### Find and evaluate a listing

1. Browse `/listings`; filter updates are debounced and return skeleton/loading/error feedback.
2. Optionally save filters when authenticated.
3. Favorite a card, compare up to three listings, or open details.
4. On detail, examine specs, listed-vs-model deal, calculators, trend, and recent items.
5. Sign in to send an inquiry.

### Admin operations

1. Login redirects an admin to `/admin`; other roles go to `/dashboard`.
2. Use summary/ML status for situational awareness.
3. Manage listings through one record form/table or CSV import.
4. Change user role/status with last-admin protection surfaced from API errors.
5. Move inquiry status through the shared operational queue.

## 5. Visual system

- Tailwind utility styling with CSS variables for background, foreground, card, primary, secondary, muted, accent, destructive, success, border, input, and ring.
- Light and dark token sets; `--radius: 0.6rem` drives rounded controls/cards.
- Blue primary, violet/blue aurora gradients, neutral cards, and semantic destructive/success states.
- shadcn-style local primitives: Button, Card, Input, Label, Select, Badge, Skeleton, etc.
- Lucide icons; Recharts visualizations; Leaflet maps; limited Three.js/motion enhancement on landing/auth.
- Motion must remain decorative and must not block content or controls. A reduced-motion behavior is not explicitly implemented and should be added if accessibility becomes a release criterion.

## 6. Content and data semantics

- Format currency using Indian grouping and INR symbol.
- Always label model outputs as estimates and display the confidence range.
- “Good deal” labels compare listed price with the current model estimate; they are not inspection, title, tax, or investment advice.
- “Trend” means average listed inventory by seeded/recorded `listedDate`, not completed sale prices.
- “Heatmap” uses approximate locality coordinates and price per square foot, not predicted demand.
- ROI is a user-entered scenario excluding taxes, vacancies, maintenance, and financing.
- Admin ML status should state offline/model-not-loaded separately and avoid fabricating unavailable metrics.

## 7. Forms, validation, and feedback

- Show a visible label and inline validation message for every required input.
- Disable submission while pending; use Sonner toasts for completion/failure and persistent inline states when recovery matters.
- Prediction constraints must align with Pydantic and API validators.
- Listing filters must preserve zero/empty distinctions and reset pagination when changed.
- Inquiry textarea enforces 10–1000 characters; listing CSV import explains accepted headers and returns actionable batch errors.
- Destructive account/listing actions require deliberate UI confirmation where implemented; if adding new destructive actions, confirmation is required.

## 8. Loading, empty, and failure states

- Use Skeleton components for initial page/data load.
- Empty favorites, saved searches, notifications, histories, trends, and searches should explain the next useful action.
- Authentication loading must avoid flashing protected content.
- An ML outage may degrade deal/comparison/prediction functions while listings remain usable; communicate this distinction.
- Free-tier cold starts can delay the first request; retain progress feedback and bounded failure messages.

## 9. Accessibility baseline

- Use semantic headings, forms, tables, buttons, and links.
- Preserve keyboard access and visible focus rings; do not make clickable `div` elements when a button/link fits.
- Provide accessible labels for icon-only controls and meaningful alt text for listing images.
- Do not encode deal/status/price bands only by color; retain text labels/badges.
- Charts require adjacent textual meaning or accessible summaries for critical values.
- Verify contrast in both themes and at 200% zoom.

No WCAG audit, automated accessibility test, localization, screen-reader journey, or reduced-motion test is recorded. Treat conformance beyond this baseline as unknown.

## 10. Responsive behavior

- Content containers use max widths and grid collapse patterns; cards and admin tables must remain scrollable rather than clip.
- Prediction, listing, auth, and detail grids collapse to one column on small screens.
- Maps and charts need fixed responsive height and width-aware containers.
- Admin tables should keep key actions reachable through horizontal overflow or a mobile card treatment.
- Implement a keyboard-accessible mobile navigation before calling the authenticated experience fully mobile-ready.

## 11. Future UX additions only when product-approved

Do not present these as current features: differentiated agent/broker workspaces, recommendation feed, real notification delivery, threaded chat, listing document/video manager, subscriptions, predictive forecasts/risk, CMS, or audit-log viewer. Each requires product, data, API, permission, and test design—not only new screens.
