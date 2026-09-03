const express = require('express');
const path = require('path');
const router = require('./routes/booking');
const app = express();
const bodyParser = require('body-parser');
const paymentRepository = require("./database/PaymentRepo");
const airbnbCalendarService = require("./services/AirbnbCalendarService");

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

    "script-src 'self' " +
    "https://cdn.jsdelivr.net " +
    "https://checkout.razorpay.com " +
    "https://cdn.razorpay.com; " +

    "style-src 'self' " +
    "'unsafe-inline' " +
    "https://cdn.jsdelivr.net; " +

    "img-src 'self' data: https:; " +

    "connect-src 'self' " +
    "https://api.razorpay.com " +
    "https://lumberjack.razorpay.com " +
    "https://nehas-homestay.vercel.app " +
    "https://nehas-homestay-git-main-ripuls-projects.vercel.app " +
    "https://nehas-homestay-nxwlhndpd-ripuls-projects.vercel.app; " +

    "frame-src " +
    "https://api.razorpay.com " +
    "https://checkout.razorpay.com; " +

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
const availabilityRoutes = require("./routes/AvailabilityRoutes");
const bookingRoutes = require("./routes/BookingRoutes");
const paymentRoutes = require("./routes/PaymentRoutes");
const airbnbCalendarRoutes = require("./routes/AirbnbCalendarRoutes");

app.use("/api", availabilityRoutes);
app.use("/api", bookingRoutes);
app.use("/api", paymentRoutes);
app.use("/api", airbnbCalendarRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.use(router);
const expiryTimer = setInterval(() => {
  paymentRepository.expirePendingBookings().catch(error => {
    console.error("Pending reservation expiry error:", error);
  });
}, 60 * 1000);
expiryTimer.unref();

const AIRBNB_SYNC_INTERVAL_MS = Number(process.env.AIRBNB_SYNC_INTERVAL_MS || 5 * 60 * 1000);
const airbnbSyncInterval = Number.isFinite(AIRBNB_SYNC_INTERVAL_MS) && AIRBNB_SYNC_INTERVAL_MS > 0
  ? AIRBNB_SYNC_INTERVAL_MS
  : 5 * 60 * 1000;

let airbnbSyncInProgress = false;

async function runAirbnbSyncCycle() {
  if (airbnbSyncInProgress) {
    return;
  }

  airbnbSyncInProgress = true;

  try {
    const result = await airbnbCalendarService.syncAllAirbnbListings();

    if (!result || result.success === false) {
      const errorCount = Array.isArray(result && result.errors) ? result.errors.length : 0;
      console.warn(`Airbnb sync completed with ${errorCount} listing error(s).`);
      return;
    }

    console.log(`Airbnb sync completed successfully for ${Array.isArray(result.results) ? result.results.length : 0} listing(s).`);
  } catch (error) {
    console.error(
      "Airbnb sync cycle error:",
      error && error.message ? error.message : "Unknown Airbnb sync error."
    );
  } finally {
    airbnbSyncInProgress = false;
  }
}

const airbnbSyncTimer = setInterval(() => {
  runAirbnbSyncCycle().catch(() => {
    // guarded by the function itself; this catch keeps the interval alive.
  });
}, airbnbSyncInterval);
airbnbSyncTimer.unref();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
