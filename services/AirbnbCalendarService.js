const crypto = require("crypto");
const { parseICS } = require("node-ical");

const db = require("../database/connection");

const {
  getActiveAirbnbImportConnections,
  getAirbnbImportConnection,
  getListingRoomMapping,
  findExternalBooking,
  upsertExternalBooking,
  replaceExternalBookingRooms,
  markMissingEventsCancelled,
  updateLastSyncedAt,
  createSyncLog,
  completeSyncLog
} = require("../database/AirbnbCalendarRepo");

const AIRBNB_PLATFORM = "AIRBNB";
const AIRBNB_SYNC_TYPE = "IMPORT";
const FETCH_TIMEOUT_MS = 25000;

function normalizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeGuestName(value) {
  const guest = normalizeText(value);
  if (!guest) return "Airbnb Guest";
  return guest.length > 150 ? guest.substring(0, 150) : guest;
}

function toDateOnly(dateLike) {
  if (!dateLike) return null;

  // Already a YYYY-MM-DD string.
  if (typeof dateLike === "string") {
    const match = dateLike.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  if (dateLike instanceof Date) {
    if (Number.isNaN(dateLike.getTime())) return null;

    // node-ical represents VALUE=DATE values with dateOnly=true.
    // The Date is normalized to local midnight, represented internally
    // as the previous day at 15:00 UTC in Japan.
    if (dateLike.dateOnly === true) {
      const year = dateLike.getFullYear();
      const month = String(dateLike.getMonth() + 1).padStart(2, "0");
      const day = String(dateLike.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }

    // Normal date-time values.
    const year = dateLike.getUTCFullYear();
    const month = String(dateLike.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateLike.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
}

function parseEventDateRange(startValue, endValue) {
  const checkIn = toDateOnly(startValue);
  const checkOut = toDateOnly(endValue);

  if (!checkIn || !checkOut) {
    return null;
  }

  if (checkOut <= checkIn) {
    return null;
  }

  return {
    checkIn,
    checkOut
  };
}
async function fetchCalendarText(calendarUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(calendarUrl, {
      method: "GET",
      headers: {
        Accept: "text/calendar, text/plain, text/*, */*"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/calendar") && !contentType.includes("ics") && !contentType.includes("text/plain")) {
      throw new Error("Unexpected calendar content type.");
    }

    const text = await response.text();
    if (!text || !text.includes("BEGIN:VCALENDAR")) {
      throw new Error("Response does not look like a valid iCalendar feed.");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function getAirbnbRoomIdsForBooking(listingRoomRows, bookedExternalRoomIds = []) {
  const roomSet = new Set(bookedExternalRoomIds.map(id => Number(id)));
  const baseRoomIds = listingRoomRows.map(row => Number(row.room_id));

  if (baseRoomIds.includes(6)) {
    return [3, 4, 5];
  }

  const directMatches = baseRoomIds.filter(id => roomSet.has(id) || roomSet.size === 0);
  return directMatches.length ? directMatches : baseRoomIds;
}

function extractValidEvents(calendarData) {
  const valid = [];

  if (!calendarData || typeof calendarData !== "object") {
    return valid;
  }

  for (const [uid, event] of Object.entries(calendarData)) {
    if (!event || event.type !== "VEVENT") continue;
    if (!event.start || !event.end) continue;

    const range = parseEventDateRange(event.start, event.end);
    if (!range) continue;

    const summary = normalizeText(event.summary || "");
    const description = normalizeText(event.description || "");
    const status = normalizeText(event.status || "CONFIRMED");

    valid.push({
      uid: normalizeText(uid || event.uid || ""),
      start: range.checkIn,
      end: range.checkOut,
      summary,
      description,
      status: status || "CONFIRMED",
      source: event
    });
  }

  return valid;
}

const AIRBNB_EXPORT_LISTING_ROOM_MAP = {
  1: [1],
  2: [3, 4, 5],
  3: [3],
  4: [2],
  5: [4],
  6: [5]
};

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatDateOnly(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function mergeDateRanges(ranges = []) {
  const normalized = ranges
    .map(range => ({
      start: new Date(`${range.start}T00:00:00Z`),
      end: new Date(`${range.end}T00:00:00Z`)
    }))
    .filter(range => !Number.isNaN(range.start.getTime()) && !Number.isNaN(range.end.getTime()) && range.end > range.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (normalized.length === 0) {
    return [];
  }

  const merged = [normalized[0]];

  for (const range of normalized.slice(1)) {
    const latest = merged[merged.length - 1];
    if (range.start.getTime() <= latest.end.getTime()) {
      latest.end = new Date(Math.max(latest.end.getTime(), range.end.getTime()));
    } else {
      merged.push(range);
    }
  }

  return merged.map(range => ({
    start: formatDateOnly(range.start),
    end: formatDateOnly(range.end)
  })).filter(range => range.start && range.end);
}

function buildEventUid(externalListingId, range) {
  const seed = `${externalListingId}|${range.start}|${range.end}|reserved`;
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

async function getExportBlockedRanges(externalListingId) {
  const listingId = Number(externalListingId);
  const roomIds = AIRBNB_EXPORT_LISTING_ROOM_MAP[listingId] || [];

  if (!Array.isArray(roomIds) || roomIds.length === 0) {
    return [];
  }

  const blockedRangeQuery = `
    WITH unavailable_ranges AS (
      SELECT br.room_id, b.check_in::date AS start_date, b.check_out::date AS end_date
      FROM booking_rooms br
      INNER JOIN bookings b
        ON b.id = br.booking_id
      WHERE br.room_id = ANY($1::int[])
        AND (
          b.booking_status = 'CONFIRMED'
          OR (
            b.booking_status = 'PENDING'
            AND b.reservation_expires_at > NOW()
          )
        )
        AND b.check_out > CURRENT_DATE

      UNION ALL

      SELECT bd.room_id, bd.start_date, bd.end_date
      FROM blocked_dates bd
      WHERE bd.room_id = ANY($1::int[])
        AND bd.end_date > CURRENT_DATE

      UNION ALL

      SELECT ebr.room_id, eb.check_in::date AS start_date, eb.check_out::date AS end_date
      FROM external_booking_rooms ebr
      INNER JOIN external_bookings eb
        ON eb.id = ebr.external_booking_id
      WHERE ebr.room_id = ANY($1::int[])
        AND eb.status IN ('CONFIRMED', 'BLOCKED')
        AND eb.check_out > CURRENT_DATE
    )
    SELECT start_date, end_date
    FROM unavailable_ranges
    ORDER BY start_date, end_date;
  `;

  const { rows } = await db.query(blockedRangeQuery, [roomIds]);

  return rows.map(row => ({
    start: row.start_date,
    end: row.end_date
  }));
}

function buildAirbnbExportCalendar(externalListingId, blockedRanges = []) {
  const listingId = Number(externalListingId);
  const mergedRanges = mergeDateRanges(blockedRanges);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NehasHomestay//Airbnb Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:UTC",
    "END:VTIMEZONE"
  ];

  for (const range of mergedRanges) {
    const uid = buildEventUid(listingId, range);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@nehas-homestay`,
      "DTSTAMP:" + formatDateOnly(new Date()),
      `DTSTART;VALUE=DATE:${range.start}`,
      `DTEND;VALUE=DATE:${range.end}`,
      "SUMMARY:Reserved",
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

async function generateAirbnbExportCalendar(externalListingId) {
  const listingId = Number(externalListingId);
  const blockedRanges = await getExportBlockedRanges(listingId);
  return buildAirbnbExportCalendar(listingId, blockedRanges);
}

async function syncOneAirbnbListing(externalListingId) {
  const listingId = Number(externalListingId);
  const startedAt = new Date();
  let syncLog = null;

  try {
    const connection = await getAirbnbImportConnection(listingId);
    if (!connection) {
      const errorMessage = "No active Airbnb calendar connection found for the requested listing.";
      syncLog = await createSyncLog({
        platform: AIRBNB_PLATFORM,
        externalListingId: listingId,
        syncType: AIRBNB_SYNC_TYPE,
        status: "FAILED",
        eventsFound: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsCancelled: 0,
        errorMessage,
        startedAt
      });

      await completeSyncLog(syncLog.id, {
        status: "FAILED",
        eventsFound: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsCancelled: 0,
        errorMessage,
        completedAt: new Date()
      });

      return {
        externalListingId: listingId,
        success: false,
        status: "FAILED",
        eventsFound: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        errors: [errorMessage]
      };
    }

    syncLog = await createSyncLog({
      platform: AIRBNB_PLATFORM,
      externalListingId: listingId,
      syncType: AIRBNB_SYNC_TYPE,
      status: "PARTIAL",
      eventsFound: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsCancelled: 0,
      errorMessage: null,
      startedAt
    });

    const calendarText = await fetchCalendarText(connection.calendar_url);
    const parsedCalendar = parseICS(calendarText);
    const validEvents = extractValidEvents(parsedCalendar);

    const createdCount = { value: 0 };
    const updatedCount = { value: 0 };
    const currentUids = [];
    const roomRows = await getListingRoomMapping(listingId);

    for (const event of validEvents) {
      if (!event.uid) continue;
      currentUids.push(event.uid);

      const guestName = normalizeGuestName(event.summary || event.description || "Airbnb Guest");
      const existingBooking = await findExternalBooking(listingId, event.uid);
      const bookingStatus = (event.status || "CONFIRMED").toUpperCase() === "CANCELLED" ? "CANCELLED" : "CONFIRMED";

      const rawEvent = {
        uid: event.uid,
        summary: event.summary || null,
        description: event.description || null,
        status: event.status || null,
        dtstart: event.start,
        dtend: event.end,
        start: event.start,
        end: event.end
      };

      const upserted = await upsertExternalBooking({
        externalListingId: listingId,
        externalEventUid: event.uid,
        guestName,
        checkIn: event.start,
        checkOut: event.end,
        status: bookingStatus,
        rawEvent,
        firstSeenAt: existingBooking ? existingBooking.first_seen_at : new Date(),
        lastSeenAt: new Date()
      });

      if (existingBooking) {
        updatedCount.value += 1;
      } else {
        createdCount.value += 1;
      }

      const mappedRoomIds = getAirbnbRoomIdsForBooking(roomRows, [
        ...new Set(roomRows.map(room => Number(room.room_id)))
      ]);

      if (mappedRoomIds.length > 0) {
        await replaceExternalBookingRooms(upserted.id, mappedRoomIds);
      }
    }

    const cancelledCount = await markMissingEventsCancelled(listingId, currentUids);
    await updateLastSyncedAt(listingId, new Date());

    const finalStatus = validEvents.length > 0 ? "SUCCESS" : "PARTIAL";

    await completeSyncLog(syncLog.id, {
      status: finalStatus,
      eventsFound: validEvents.length,
      eventsCreated: createdCount.value,
      eventsUpdated: updatedCount.value,
      eventsCancelled: cancelledCount,
      errorMessage: validEvents.length > 0 ? null : "No valid VEVENT entries were processed.",
      completedAt: new Date()
    });

    return {
      externalListingId: listingId,
      success: true,
      status: finalStatus,
      eventsFound: validEvents.length,
      created: createdCount.value,
      updated: updatedCount.value,
      cancelled: cancelledCount,
      errors: []
    };
  } catch (error) {
    const message = error && error.message ? error.message : "Unknown Airbnb sync error.";

    if (syncLog) {
      await completeSyncLog(syncLog.id, {
        status: "FAILED",
        eventsFound: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsCancelled: 0,
        errorMessage: message,
        completedAt: new Date()
      });
    }

    return {
      externalListingId: listingId,
      success: false,
      status: "FAILED",
      eventsFound: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      errors: [message]
    };
  }
}

async function syncAllAirbnbListings() {
  const connections = await getActiveAirbnbImportConnections();
  const results = [];
  const errors = [];

  for (const connection of connections) {
    const result = await syncOneAirbnbListing(connection.external_listing_id);
    results.push(result);

    if (!result.success && Array.isArray(result.errors) && result.errors.length) {
      errors.push({
        externalListingId: connection.external_listing_id,
        errors: result.errors
      });
    }
  }

  return {
    success: errors.length === 0,
    status: errors.length === 0 ? "SUCCESS" : "PARTIAL",
    results,
    errors
  };
}

module.exports = {
  syncOneAirbnbListing,
  syncAllAirbnbListings,
  generateAirbnbExportCalendar,
  buildAirbnbExportCalendar,
  getExportBlockedRanges,
  parseEventDateRange
};
