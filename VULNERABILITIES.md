# Security review — Neha's Homestay booking flow

Scope reviewed: browser booking flow, Express routes, PostgreSQL repositories/schema, Razorpay order creation and verification, and the optional Weebly iframe helpers. This is a code review, not a penetration test of the deployed host, database configuration, Razorpay account, or Weebly configuration.

## Remediation status

The findings below describe the original reviewed state. The following remediation has now been applied in this repository: expiring 15-minute pending reservations, per-route rate limits, strict server validation, opaque booking access capabilities, compare-and-set Razorpay-order persistence, HTTPS-relative API URLs, a signed Razorpay webhook endpoint, non-wildcard iframe messages, and pinned/SRI-protected Litepicker and SweetAlert2 assets. Apply `database/migrations/001_security_hardening.sql` before deploying these code changes and configure the new environment variables in `.env.example`.

## Findings

### 1. Pending bookings can indefinitely deny inventory

- **Severity:** High
- **Status:** Exploitable as currently implemented.
- **References:** `routes/BookingRoutes.js:14-293`; `database/BookingRepo.js:91-148`, `326-353`; `database/AvailabilityRepo.js:30-49`
- **Issue and concrete exploit:** `POST /api/bookings` creates a `PENDING` booking before payment. Both availability and the final booking check treat every `PENDING` booking as unavailable, but there is no expiry, cancellation job, or payment deadline. An attacker can use DevTools or a script to submit legitimate room IDs, future dates, and throwaway contact details, then abandon payment. The room/bed remains unavailable for every overlapping search indefinitely. Repeating this across dates can take all inventory offline without paying.
- **Specific fix:** Add a `reservation_expires_at` column and a short hold (for example, 10–15 minutes). Treat only unexpired pending bookings and confirmed bookings as unavailable; expire stale pending bookings in queries and a scheduled job. Add transactional cancellation/release after expiry. Combine with the rate limit in finding 5.

### 2. Concurrent order creation can orphan a paid Razorpay order

- **Severity:** High
- **Status:** Exploitable as currently implemented.
- **References:** `routes/PaymentRoutes.js:85-89`, `179-264`, `497-524`; `database/PaymentRepo.js:45-76`
- **Issue and concrete exploit:** Order creation reads `razorpay_order_id`, creates an order if absent, and writes it later without a transaction or conditional update. A customer (or attacker using that customer's newly created booking ID) can send two `POST /api/payments/create-order` requests in parallel. Both can observe no order ID, Razorpay can create two orders, and the last database update wins. If the customer pays the first order, `/api/payments/verify` rejects it because the database now stores the second order ID. The payment may be captured while the booking remains unconfirmed.
- **Specific fix:** Make get-or-create-order atomic. In one database transaction, lock the booking row (`SELECT ... FOR UPDATE`), reuse an existing order when present, create exactly one order, and persist it before releasing the lock. Alternatively use a guarded `UPDATE ... WHERE razorpay_order_id IS NULL RETURNING ...` plus reconciliation for a remote-order creation failure. Add a unique constraint on `bookings.razorpay_order_id`.

### 3. Public, sequential booking IDs allow unauthorized payment-order operations and status enumeration

- **Severity:** Medium
- **Status:** Exploitable as currently implemented; no direct guest-PII read endpoint was found.
- **References:** `database/schema.sql:37`; `routes/PaymentRoutes.js:43-211`, `332-464`; `public/js/booking-flow.js:520-526`, `810-825`
- **Issue and concrete exploit:** Booking IDs are serial integers and both payment endpoints accept only `bookingId`; they do not require a session, booking capability token, or owner proof. An attacker can enumerate IDs (`1`, `2`, `3`, …). For a pending booking, they can call `/api/payments/create-order` and obtain that booking's reference, amount, and Razorpay order ID. For a paid booking, sending arbitrary nonempty payment fields to `/api/payments/verify` reaches the `PAID` short-circuit before signature validation and reveals the booking reference and paid/confirmed status. The current routes do not return another guest's name, email, or phone, so a direct PII IDOR was **not** found.
- **Specific fix:** Generate a cryptographically random, unguessable booking access token when a booking is created; store only a hash and require the token for order creation and payment-status access. Prefer an authenticated customer session where available. Move the already-paid response after authorization and ensure all idempotent responses require the same authorization proof.

### 4. The deployed client would send booking and payment requests to HTTP

- **Severity:** High
- **Status:** Exploitable if this active configuration is deployed outside localhost; on an HTTPS Weebly page, browsers will generally block it as mixed content instead, breaking the flow.
- **References:** `public/js/availability.js:42-45`; `public/js/booking-flow.js:59-64`
- **Issue and concrete exploit:** Both active API base URLs are `http://localhost:3000`. If replaced by or deployed as an HTTP production endpoint, an on-path attacker on the same network can read or alter guest name/email/phone, dates, room IDs, booking IDs, and payment-verification traffic. If embedded in Weebly over HTTPS as shown, browser mixed-content protection prevents the requests rather than protecting a usable flow.
- **Specific fix:** Use a same-origin relative API path (`/api`) behind an HTTPS reverse proxy, or inject one HTTPS-only production base URL through trusted deployment configuration. Enable HTTPS redirects and HSTS at the host/proxy. Do not ship a localhost fallback in the production bundle.

### 5. No rate limiting or abuse controls protect public API endpoints

- **Severity:** Medium
- **Status:** Exploitable as currently implemented.
- **References:** `server.js:7-25`; `routes/AvailabilityRoutes.js:12-166`, `168-655`; `routes/BookingRoutes.js:14-491`; `routes/PaymentRoutes.js:43-320`, `332-728`
- **Issue and concrete exploit:** There is no rate limiter, bot control, or per-IP/per-booking throttle. A script can repeatedly run availability searches (database-heavy overlap queries), validate selections, create pending bookings, create Razorpay orders, or submit invalid payment signatures. This enables resource exhaustion and materially amplifies the inventory-locking attack in finding 1.
- **Specific fix:** Add an application/proxy rate limiter with separate, strict limits for booking creation, order creation, and payment verification; cap request body sizes; add structured audit logging/alerts; and consider CAPTCHA or a honeypot before unauthenticated booking creation.

### 6. Guest PII has only presence checks; stored XSS is latent in downstream consumers

- **Severity:** Medium
- **Status:** Input-quality issue is exploitable now; stored XSS is theoretical in the reviewed code because no admin UI, receipt renderer, or email template was provided.
- **References:** `routes/BookingRoutes.js:36-75`, `269-293`; `database/BookingRepo.js:326-372`
- **Issue and concrete exploit:** The server accepts any nonempty `guestName`, `email`, and `phone`. A user can bypass HTML input types through DevTools and submit a payload such as `<img src=x onerror=alert(document.domain)>` as `guestName`, an invalid email, or arbitrarily long/odd phone values. PostgreSQL parameterization prevents SQL injection here, but the payload is stored. If a future admin dashboard, email template, CSV/Excel export, or receipt inserts it without context-appropriate encoding, it becomes stored XSS or formula injection.
- **Specific fix:** Trim and validate on the server with explicit length limits and allowlists: a conservative name character set, a standard email parser/normalization policy, and E.164 or a clearly documented local phone format. Keep parameterized SQL. Encode by output context in every dashboard/template, and prefix/escape spreadsheet-dangerous values during CSV export. Add database `CHECK` constraints where practical.

### 7. Past dates are accepted by every server-side booking stage

- **Severity:** Medium
- **Status:** Exploitable as currently implemented.
- **References:** `routes/AvailabilityRoutes.js:42-73`, `201-232`; `routes/BookingRoutes.js:98-133`; `database/BookingRepo.js:273-296`
- **Issue and concrete exploit:** The server verifies only that check-out is after check-in. An attacker can edit the hidden date inputs or POST directly with dates in the past, then create and pay for a past reservation. This can create invalid records, distort reporting, and participate in the permanent-pending inventory abuse.
- **Specific fix:** Parse strict `YYYY-MM-DD` values in the property's business timezone and reject check-in before the current local date at `/availability`, `/validate-selection`, and `/bookings`. Enforce a maximum stay length and booking horizon as business rules too.

### 8. Razorpay confirmation relies solely on the browser callback; there is no webhook/reconciliation path

- **Severity:** Medium
- **Status:** Exploitable as a payment/fulfilment inconsistency today, though not a signature forgery.
- **References:** `public/js/booking-flow.js:777-937`; `routes/PaymentRoutes.js:332-728`; no Razorpay webhook route exists in `routes/`
- **Issue and concrete exploit:** A booking is marked paid only when the browser receives Razorpay's success callback and successfully calls `/api/payments/verify`. A customer can complete payment and then lose connectivity, close the tab, or block that request in DevTools. Razorpay may capture the money while the local booking remains `PENDING`, with no server-to-server webhook to repair it.
- **Specific fix:** Implement a Razorpay webhook endpoint that verifies the webhook signature using the webhook secret and idempotently updates the matching stored order/payment. Use the webhook as the authoritative asynchronous reconciliation path, retain the existing browser signature check for immediate UX, and run periodic reconciliation for unresolved pending orders.

### 9. Third-party browser dependencies have version/integrity drift exposure

- **Severity:** Low
- **Status:** Theoretical supply-chain risk; all current URLs use HTTPS.
- **References:** `public/index.html:13-14`, `197-199`
- **Issue and concrete exploit:** Litepicker uses an unversioned CDN path, SweetAlert2 uses a floating major (`@11`), and neither has SRI. If a CDN package/version is replaced or a served asset is compromised, arbitrary JavaScript runs in the booking iframe and can read guest details before they are sent to Razorpay.
- **Specific fix:** Pin exact versions and use SRI plus `crossorigin="anonymous"` where supported. Prefer self-hosting non-payment UI dependencies. Keep Razorpay's checkout script on its official HTTPS origin and pair it with a restrictive CSP `script-src` allowlist; verify provider guidance before applying SRI to their dynamically managed checkout asset.

### 10. Optional iframe height messages use a wildcard target origin

- **Severity:** Low
- **Status:** Not active in the supplied page (`iframe-height.js` is commented out); if enabled, the issue is exploitable but the message contains only a height value and there is no inbound message handler.
- **References:** `public/index.html:210`; `public/js/iframe-height.js:36-40`; `public/js/iframe.js:23-27`
- **Issue and concrete exploit:** Both helpers use `window.parent.postMessage(..., "*")`. If the widget is embedded by an untrusted parent, that parent receives widget-height updates. No sensitive payload or listener that trusts incoming messages was found, so impact is limited today.
- **Specific fix:** When the iframe integration is enabled, configure an expected Weebly/site origin and pass it as `targetOrigin` instead of `*`. If an inbound handler is added later, validate both `event.origin` and message schema before acting.

## Confirmed controls / non-findings

- **Client-controlled price:** Not found. `database/BookingRepo.js:299-317` recalculates the total from locked database room prices, and `routes/PaymentRoutes.js:149-175` creates the Razorpay amount from the stored server-side total. Editing DOM prices, `window.bookingSelection`, or `localStorage` does not alter the charged amount.
- **Razorpay HMAC verification:** Present. `routes/PaymentRoutes.js:497-630` compares the submitted order ID to the stored order and validates the HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET` with a timing-safe comparison before marking payment paid at `database/PaymentRepo.js:89-122`.
- **Room double-booking at booking creation:** The final booking transaction locks selected rooms before checking overlap (`database/BookingRepo.js:29-148`), so two overlapping requests for the same room serialize and the second is rejected. This does not address the pending-reservation expiry issue in finding 1.
- **Razorpay secret exposure:** Not found in browser files or HTML. The secret is read only from `process.env` in `routes/PaymentRoutes.js`. `.env` is excluded by `NehasBooking/.gitignore`; secret values were not printed during this review. The public Razorpay key ID is intentionally returned to checkout and is not a secret.
- **Local/session storage:** No `localStorage` or `sessionStorage` use was found.
- **SQL injection in reviewed queries:** No injection path found; repository queries use PostgreSQL placeholders.
- **Classic CSRF:** No cookie/session-authenticated endpoint was found, and no CORS middleware is configured. The principal risk is unauthenticated public endpoint abuse (findings 1, 3, and 5), not classic cross-site request forgery.

## Remediation order

1. Fix the pending-booking expiry and rate limits (findings 1 and 5).
2. Make Razorpay order creation atomic and add webhook reconciliation (findings 2 and 8).
3. Require HTTPS/same-origin API routing and replace sequential booking-ID access with a capability token (findings 3 and 4).
4. Tighten server-side input/date validation, then pin third-party assets and harden the optional iframe integration.
