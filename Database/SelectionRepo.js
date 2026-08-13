const db = require("./connection");


/**
 * Get specific rooms and verify that they are
 * still available for the requested dates.
 */
async function getSelectedRooms(
    roomIds,
    checkIn,
    checkOut
) {

    const query = `
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

        /*
         * Make sure the room does not have an
         * overlapping pending/confirmed booking.
         */
        AND NOT EXISTS (

            SELECT 1

            FROM booking_rooms br

            INNER JOIN bookings b
                ON b.id = br.booking_id

            WHERE br.room_id = r.id

            AND b.booking_status IN (
                'PENDING',
                'CONFIRMED'
            )

            AND b.check_in < $3

            AND b.check_out > $2
        )

        /*
         * Make sure the room is not blocked.
         */
        AND NOT EXISTS (

            SELECT 1

            FROM blocked_dates bd

            WHERE bd.room_id = r.id

            AND bd.start_date < $3

            AND bd.end_date > $2
        )

        ORDER BY r.id;
    `;

    const { rows } = await db.query(
        query,
        [
            roomIds,
            checkIn,
            checkOut
        ]
    );

    return rows;
}


module.exports = {
    getSelectedRooms
};