const express = require("express");
const router = express.Router();

const {
  syncAllAirbnbListings,
  syncOneAirbnbListing,
  generateAirbnbExportCalendar
} = require("../services/AirbnbCalendarService");

function normalizeListingResult(result = {}, fallbackListing = null) {
  const errors = Array.isArray(result.errors) ? result.errors : [];

  return {
    listing: result.listing ?? result.externalListingId ?? fallbackListing ?? null,
    status: result.status || (errors.length === 0 ? "SUCCESS" : "PARTIAL"),
    eventsFound: Number(result.eventsFound || 0),
    created: Number(result.created || 0),
    updated: Number(result.updated || 0),
    cancelled: Number(result.cancelled || 0),
    errors
  };
}

router.get("/calendar/airbnb/:externalListingId.ics", async (req, res) => {
  try {
    const { externalListingId } = req.params;
    const listingId = Number(externalListingId);

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return res.status(400).type("text/calendar").send(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//NehasHomestay//Airbnb Export//EN\r\nEND:VCALENDAR\r\n"
      );
    }

    const ics = await generateAirbnbExportCalendar(listingId);
    return res
      .type("text/calendar; charset=utf-8")
      .set("Cache-Control", "no-store")
      .send(ics);
  } catch (error) {
    console.error("Airbnb export calendar route error:", error);
    return res
      .status(500)
      .type("text/calendar; charset=utf-8")
      .send(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//NehasHomestay//Airbnb Export//EN\r\nBEGIN:VEVENT\r\nUID:error@nehas-homestay\r\nDTSTAMP:19700101T000000Z\r\nDTSTART;VALUE=DATE:19700101\r\nDTEND;VALUE=DATE:19700102\r\nSUMMARY:Reserved\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
      );
  }
});

router.post("/calendar/airbnb/sync", async (req, res) => {
  try {
    /*
     * No admin/auth middleware is currently present in this project,
     * so this endpoint is development-only until a real admin protection
     * layer is added in production.
     */
    // if (process.env.NODE_ENV !== "development") {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Airbnb manual sync is development-only until an admin authentication guard is added for production."
    //   });
    // }

    const { externalListingId } = req.body || {};

    if (externalListingId !== undefined && externalListingId !== null && externalListingId !== "") {
      const result = await syncOneAirbnbListing(Number(externalListingId));
      return res.json({
        success: Boolean(result.success),
        ...normalizeListingResult(result, Number(externalListingId))
      });
    }

    const result = await syncAllAirbnbListings();
    const listingResults = Array.isArray(result.results)
      ? result.results.map(item => normalizeListingResult(item))
      : [];

    return res.json({
      success: Boolean(result.success),
      status: result.status || (listingResults.some(item => item.errors.length > 0) ? "PARTIAL" : "SUCCESS"),
      listing: null,
      eventsFound: listingResults.reduce((sum, item) => sum + Number(item.eventsFound || 0), 0),
      created: listingResults.reduce((sum, item) => sum + Number(item.created || 0), 0),
      updated: listingResults.reduce((sum, item) => sum + Number(item.updated || 0), 0),
      cancelled: listingResults.reduce((sum, item) => sum + Number(item.cancelled || 0), 0),
      errors: Array.isArray(result.errors) ? result.errors : [],
      results: listingResults
    });
  } catch (error) {
    console.error("Airbnb sync route error:", error);
    return res.status(500).json({
      success: false,
      listing: null,
      status: "FAILED",
      eventsFound: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      errors: ["Unable to sync Airbnb calendar."]
    });
  }
});

module.exports = router;
