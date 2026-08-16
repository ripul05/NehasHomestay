const express = require('express');
const path = require('path');
const router = require('./routes/booking');
const app = express();
const bodyParser = require('body-parser');
const paymentRepository = require("./database/PaymentRepo");

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' https://cdn.jsdelivr.net https://checkout.razorpay.com https://cdn.razorpay.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data:; " +
    "connect-src 'self' https://api.razorpay.com https://nehas-homestay.vercel.app; " +
    "frame-src https://api.razorpay.com https://checkout.razorpay.com; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  next();
});
app.use((req, res, next) => {
  console.log("CORS:", req.method, req.originalUrl, req.get("origin"));
  const origin = req.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use((req, res, next) => {
  if (process.env.REQUIRE_HTTPS === "true" && !req.secure && req.get("x-forwarded-proto") !== "https") {
    return res.status(400).json({ success: false, error: "HTTPS is required." });
  }
  next();
});
app.use(bodyParser.json({ limit: "20kb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "20kb" }));
const PORT = process.env.PORT || 3000;
const availabilityRoutes =
  require("./routes/AvailabilityRoutes");
const bookingRoutes =
  require("./routes/BookingRoutes");
  const paymentRoutes =
    require("./routes/PaymentRoutes");


app.use("/api", availabilityRoutes);
app.use("/api", bookingRoutes);
app.use(
    "/api",
    paymentRoutes
);

app.use(express.static(path.join(__dirname, 'public')));

app.use(router);
const expiryTimer = setInterval(() => {
  paymentRepository.expirePendingBookings().catch(error => {
    console.error("Pending reservation expiry error:", error);
  });
}, 60 * 1000);
expiryTimer.unref();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
