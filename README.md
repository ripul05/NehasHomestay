# NehasBooking

A simple Node.js/Express booking app scaffold.

## Structure
- public/ for frontend files
- routes/ for route handlers
- controllers/, models/, database/ for app logic and data

## Run

1. Copy `.env.example` to `.env` and fill in the real deployment values. Set
   `ALLOWED_ORIGINS` to the exact Weebly/site origins that may embed the widget.
2. Apply `database/schema.sql` for a fresh database, or apply
   `database/migrations/001_security_hardening.sql` to an existing database.
3. In Razorpay Dashboard, configure a `payment.captured` webhook at
   `https://your-domain.example/api/payments/webhook` using
   `RAZORPAY_WEBHOOK_SECRET`.

```bash
npm install
npm start
```
