const db = require("./connection");
const {
    filterAvailableDormRooms,
    collapseDormInventory,
    expandDormSelectionIds
} = require("./dormInventory");


/**
 * Get specific rooms and verify that they are
 * still available for the requested dates.
 */
async function getSelectedRooms(
    roomIds,
    checkIn,
    checkOut
) {

    const allRoomsQuery = `
        SELECT
            r.id,
            r.code,
            r.name,
            r.room_type,
            r.capacity,
            r.max_adults,
            r.max_children,
            r.price_per_night,
            r.active

        FROM rooms r

        WHERE r.active = TRUE
        ORDER BY r.id;
    `;

    const { rows: allRooms } = await db.query(allRoomsQuery);
    const expandedRoomIds = expandDormSelectionIds(roomIds, allRooms);

    const selectedRoomsQuery = `
        SELECT
            r.id,
            r.code,
            r.name,
            r.room_type,
            r.capacity,
            r.max_adults,
            r.max_children,
            r.price_per_night,
            r.active

        FROM rooms r

        WHERE r.id = ANY($1::int[])
        AND r.active = TRUE
        ORDER BY r.id;
    `;

    const { rows: selectedRooms } = await db.query(
        selectedRoomsQuery,
        [expandedRoomIds]
    );

    const selectedSet = new Set(roomIds.map(id => Number(id)));
    const requestedRooms = selectedRooms.filter(room =>
        selectedSet.has(Number(room.id))
    );

    const unavailableBookingQuery = `
        SELECT DISTINCT
            br.room_id

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
        AND b.check_in < $3::date
        AND b.check_out > $2::date;
    `;

    const blockedDatesQuery = `
        SELECT DISTINCT
            bd.room_id

        FROM blocked_dates bd

        WHERE bd.room_id = ANY($1::int[])
        AND bd.start_date < $3::date
        AND bd.end_date > $2::date;
    `;

    const externalBookingsQuery = `
        SELECT DISTINCT
            ebr.room_id

        FROM external_booking_rooms ebr

        INNER JOIN external_bookings eb
            ON eb.id = ebr.external_booking_id

        WHERE ebr.room_id = ANY($1::int[])
        AND eb.status IN ('CONFIRMED', 'BLOCKED')
        AND eb.check_in < $3::date
        AND eb.check_out > $2::date;
    `;

    const [
        overlappingBookings,
        blockedDates,
        externalBookings
    ] = await Promise.all([
        db.query(unavailableBookingQuery, [expandedRoomIds, checkIn, checkOut]),
        db.query(blockedDatesQuery, [expandedRoomIds, checkIn, checkOut]),
        db.query(externalBookingsQuery, [expandedRoomIds, checkIn, checkOut])
    ]);

    const unavailableRoomIds = [
        ...overlappingBookings.rows.map(row => Number(row.room_id)),
        ...blockedDates.rows.map(row => Number(row.room_id)),
        ...externalBookings.rows.map(row => Number(row.room_id))
    ];

    const filteredRooms = selectedRooms.filter(room => {
        if (room.room_type !== "DORM") {
            return !unavailableRoomIds.includes(Number(room.id));
        }

        return true;
    });

    const finalRooms = collapseDormInventory(
        filterAvailableDormRooms(filteredRooms, unavailableRoomIds)
    );

    return finalRooms.filter(room => selectedSet.has(Number(room.id)));
}


module.exports = {
    getSelectedRooms
};
