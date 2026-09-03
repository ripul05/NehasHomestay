const db = require("./connection");

async function getActiveAirbnbImportConnections() {
    const query = `
        SELECT
            id,
            external_listing_id,
            direction,
            calendar_name,
            calendar_url,
            active,
            last_synced_at,
            created_at,
            updated_at,
            provider,
            connection_type
        FROM calendar_connections
        WHERE direction = 'IMPORT'
          AND provider = 'AIRBNB'
          AND connection_type = 'ICAL'
          AND active = TRUE
        ORDER BY id;
    `;

    const { rows } = await db.query(query);
    return rows;
}

async function getAirbnbImportConnection(externalListingId) {
    const query = `
        SELECT
            id,
            external_listing_id,
            direction,
            calendar_name,
            calendar_url,
            active,
            last_synced_at,
            created_at,
            updated_at,
            provider,
            connection_type
        FROM calendar_connections
        WHERE external_listing_id = $1
          AND direction = 'IMPORT'
          AND provider = 'AIRBNB'
          AND connection_type = 'ICAL'
          AND active = TRUE
        LIMIT 1;
    `;

    const { rows } = await db.query(query, [externalListingId]);
    return rows[0] || null;
}

async function getListingRoomMapping(externalListingId) {
    const query = `
        SELECT
            elr.id,
            elr.external_listing_id,
            elr.room_id,
            r.name,
            r.room_type,
            r.code
        FROM external_listing_rooms elr
        INNER JOIN rooms r
            ON r.id = elr.room_id
        WHERE elr.external_listing_id = $1
          AND r.active = TRUE
        ORDER BY elr.room_id;
    `;

    const { rows } = await db.query(query, [externalListingId]);
    return rows;
}

async function getAllActiveRooms() {
    const query = `
        SELECT
            id,
            code,
            name,
            room_type,
            capacity,
            max_adults,
            max_children,
            price_per_night,
            active
        FROM rooms
        WHERE active = TRUE
        ORDER BY id;
    `;

    const { rows } = await db.query(query);
    return rows;
}

async function findExternalBooking(externalListingId, externalEventUid) {
    const query = `
        SELECT
            id,
            external_listing_id,
            external_event_uid,
            guest_name,
            check_in,
            check_out,
            status,
            raw_event,
            first_seen_at,
            last_seen_at,
            created_at,
            updated_at
        FROM external_bookings
        WHERE external_listing_id = $1
          AND external_event_uid = $2
        LIMIT 1;
    `;

    const { rows } = await db.query(query, [externalListingId, externalEventUid]);
    return rows[0] || null;
}

async function upsertExternalBooking({
    externalListingId,
    externalEventUid,
    guestName,
    checkIn,
    checkOut,
    status,
    rawEvent,
    firstSeenAt,
    lastSeenAt
}) {
    const query = `
        INSERT INTO external_bookings (
            external_listing_id,
            external_event_uid,
            guest_name,
            check_in,
            check_out,
            status,
            raw_event,
            first_seen_at,
            last_seen_at,
            created_at,
            updated_at
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            NOW(),
            NOW()
        )
        ON CONFLICT (external_listing_id, external_event_uid)
        DO UPDATE SET
            guest_name = EXCLUDED.guest_name,
            check_in = EXCLUDED.check_in,
            check_out = EXCLUDED.check_out,
            status = EXCLUDED.status,
            raw_event = EXCLUDED.raw_event,
            last_seen_at = NOW(),
            updated_at = NOW()
        RETURNING *;
    `;

    const { rows } = await db.query(query, [
        externalListingId,
        externalEventUid,
        guestName,
        checkIn,
        checkOut,
        status,
        rawEvent,
        firstSeenAt || new Date(),
        lastSeenAt || new Date()
    ]);

    return rows[0];
}

async function replaceExternalBookingRooms(externalBookingId, roomIds = []) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        await client.query(
            `DELETE FROM external_booking_rooms WHERE external_booking_id = $1;`,
            [externalBookingId]
        );

        const uniqueRoomIds = [...new Set(roomIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))];

        for (const roomId of uniqueRoomIds) {
            await client.query(
                `
                INSERT INTO external_booking_rooms (
                    external_booking_id,
                    room_id,
                    created_at
                )
                VALUES ($1, $2, NOW());
                `,
                [externalBookingId, roomId]
            );
        }

        await client.query("COMMIT");
        return uniqueRoomIds;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function markMissingEventsCancelled(externalListingId, currentExternalEventUids = []) {
    const currentIds = Array.isArray(currentExternalEventUids)
        ? currentExternalEventUids.filter(Boolean)
        : [];

    const query = `
        UPDATE external_bookings
        SET status = 'CANCELLED',
            updated_at = NOW()
        WHERE external_listing_id = $1
          AND status <> 'CANCELLED'
          AND NOT (external_event_uid = ANY($2::text[]));
    `;

    const { rowCount } = await db.query(query, [externalListingId, currentIds]);
    return rowCount || 0;
}

async function updateLastSyncedAt(externalListingId, lastSyncedAt = new Date()) {
    const query = `
        UPDATE calendar_connections
        SET last_synced_at = $2,
            updated_at = NOW()
        WHERE external_listing_id = $1
          AND direction = 'IMPORT'
          AND provider = 'AIRBNB'
          AND connection_type = 'ICAL'
          AND active = TRUE;
    `;

    const { rowCount } = await db.query(query, [externalListingId, lastSyncedAt]);
    return rowCount || 0;
}

async function createSyncLog({
    platform,
    externalListingId,
    syncType,
    status,
    eventsFound,
    eventsCreated,
    eventsUpdated,
    eventsCancelled,
    errorMessage,
    startedAt
}) {
    const query = `
        INSERT INTO calendar_sync_logs (
            platform,
            external_listing_id,
            sync_type,
            status,
            events_found,
            events_created,
            events_updated,
            events_cancelled,
            error_message,
            started_at,
            completed_at
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW()
        )
        RETURNING *;
    `;

    const { rows } = await db.query(query, [
        platform,
        externalListingId,
        syncType,
        status,
        Number(eventsFound || 0),
        Number(eventsCreated || 0),
        Number(eventsUpdated || 0),
        Number(eventsCancelled || 0),
        errorMessage || null,
        startedAt || new Date()
    ]);

    return rows[0];
}

async function completeSyncLog(logId, {
    status,
    eventsFound,
    eventsCreated,
    eventsUpdated,
    eventsCancelled,
    errorMessage,
    completedAt
}) {
    const query = `
        UPDATE calendar_sync_logs
        SET status = $2,
            events_found = $3,
            events_created = $4,
            events_updated = $5,
            events_cancelled = $6,
            error_message = $7,
            completed_at = $8
        WHERE id = $1
        RETURNING *;
    `;

    const { rows } = await db.query(query, [
        logId,
        status,
        Number(eventsFound || 0),
        Number(eventsCreated || 0),
        Number(eventsUpdated || 0),
        Number(eventsCancelled || 0),
        errorMessage || null,
        completedAt || new Date()
    ]);

    return rows[0] || null;
}

module.exports = {
    getActiveAirbnbImportConnections,
    getAirbnbImportConnection,
    getListingRoomMapping,
    getAllActiveRooms,
    findExternalBooking,
    upsertExternalBooking,
    replaceExternalBookingRooms,
    markMissingEventsCancelled,
    updateLastSyncedAt,
    createSyncLog,
    completeSyncLog
};
