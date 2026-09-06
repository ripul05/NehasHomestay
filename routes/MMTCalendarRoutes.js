const express = require("express");
const router = express.Router();

const {
    syncAllMMTListings,
    syncOneMMTListing,
    generateMMTExportCalendar
} = require("../services/MMTCalendarService");

function normalizeListingResult(
    result = {},
    fallbackListing = null
) {
    const errors =
        Array.isArray(result.errors)
            ? result.errors
            : [];

    return {
        listing:
            result.listing ??
            result.externalListingId ??
            fallbackListing ??
            null,
        status:
            result.status ||
            (errors.length === 0
                ? "SUCCESS"
                : "PARTIAL"),
        eventsFound:
            Number(result.eventsFound || 0),
        created:
            Number(result.created || 0),
        updated:
            Number(result.updated || 0),
        cancelled:
            Number(result.cancelled || 0),
        errors
    };
}

/*
 * MMT -> Website
 *
 * This endpoint is where our server reads the temporary
 * MMT iCal URL stored in calendar_connections.
 */
router.post("/calendar/mmt/sync", async (req, res) => {
    try {
        const {
            externalListingId
        } = req.body || {};

        if (
            externalListingId !== undefined &&
            externalListingId !== null &&
            externalListingId !== ""
        ) {
            const result =
                await syncOneMMTListing(
                    Number(externalListingId)
                );

            return res.json({
                success: Boolean(result.success),
                ...normalizeListingResult(
                    result,
                    Number(externalListingId)
                )
            });
        }

        const result =
            await syncAllMMTListings();

        const listingResults =
            Array.isArray(result.results)
                ? result.results.map(item =>
                    normalizeListingResult(item)
                )
                : [];

        return res.json({
            success: Boolean(result.success),
            status:
                result.status ||
                "SUCCESS",
            listing: null,
            eventsFound:
                listingResults.reduce(
                    (sum, item) =>
                        sum + item.eventsFound,
                    0
                ),
            created:
                listingResults.reduce(
                    (sum, item) =>
                        sum + item.created,
                    0
                ),
            updated:
                listingResults.reduce(
                    (sum, item) =>
                        sum + item.updated,
                    0
                ),
            cancelled:
                listingResults.reduce(
                    (sum, item) =>
                        sum + item.cancelled,
                    0
                ),
            errors:
                Array.isArray(result.errors)
                    ? result.errors
                    : [],
            results: listingResults
        });

    } catch (error) {
        console.error(
            "MMT sync route error:",
            error
        );

        return res.status(500).json({
            success: false,
            listing: null,
            status: "FAILED",
            eventsFound: 0,
            created: 0,
            updated: 0,
            cancelled: 0,
            errors: [
                "Unable to sync MMT calendar."
            ]
        });
    }
});

/*
 * Website -> MMT
 *
 * MMT will consume this public iCal URL.
 */
router.get(
    "/calendar/mmt/:externalListingId.ics",
    async (req, res) => {
        try {
            const listingId =
                Number(req.params.externalListingId);

            if (
                !Number.isInteger(listingId) ||
                listingId <= 0
            ) {
                return res
                    .status(400)
                    .type("text/calendar")
                    .send(
                        "BEGIN:VCALENDAR\r\n" +
                        "VERSION:2.0\r\n" +
                        "PRODID:-//NehasHomestay//MMT Export//EN\r\n" +
                        "END:VCALENDAR\r\n"
                    );
            }

            const ics =
                await generateMMTExportCalendar(
                    listingId
                );

            return res
                .type("text/calendar; charset=utf-8")
                .set("Cache-Control", "no-store")
                .send(ics);

        } catch (error) {
            console.error(
                "MMT export calendar route error:",
                error
            );

            return res
                .status(500)
                .type("text/calendar; charset=utf-8")
                .send(
                    "BEGIN:VCALENDAR\r\n" +
                    "VERSION:2.0\r\n" +
                    "PRODID:-//NehasHomestay//MMT Export//EN\r\n" +
                    "END:VCALENDAR\r\n"
                );
        }
    }
);

module.exports = router;
