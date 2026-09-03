const db = require("./connection");
const {
    getDormGroupForRoom,
    validateDormSelection,
    expandDormSelectionIds
} = require("./dormInventory");


/**
 * Create a new booking and assign the selected
 * rooms/beds to that booking.
 *
 * Everything happens inside ONE transaction.
 */
function countNights(checkIn, checkOut) {
    const [startYear, startMonth, startDay] = checkIn.split("-").map(Number);
    const [endYear, endMonth, endDay] = checkOut.split("-").map(Number);

    const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
    const endUtc = Date.UTC(endYear, endMonth - 1, endDay);

    return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

async function createBooking({
    bookingReference,
    guestName,
    email,
    phone,
    adults,
    children,
    checkIn,
    checkOut,
    roomIds,
    bookingAccessTokenHash
}) {

    const client = await db.connect();

    try {

        /*
         * Start transaction
         */
        await client.query("BEGIN");


        /*
         * ------------------------------------------------
         * Lock the selected rooms.
         *
         * This prevents another booking transaction
         * from modifying these rooms at the same time.
         * ------------------------------------------------
         */

        const allDormRoomsQuery = `
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

            WHERE room_type = 'DORM'
            AND (
                name ILIKE '%mix dorm%' OR
                name ILIKE '%mixed dorm%'
            )
            AND active = TRUE;
        `;

        const dormRows = await client.query(allDormRoomsQuery);
        const expandedRoomIds = expandDormSelectionIds(roomIds, [
            ...dormRows.rows
        ]);

        const roomQuery = `
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

            WHERE id = ANY($1::int[])

            AND active = TRUE

            FOR UPDATE;
        `;


        const roomResult = await client.query(
            roomQuery,
            [expandedRoomIds]
        );

        const roomLookup = new Map(
            roomResult.rows.map(room => [Number(room.id), room])
        );

        const rooms = roomIds
            .map(id => roomLookup.get(Number(id)))
            .filter(Boolean);


        /*
         * Make sure every requested room exists.
         */

        if (rooms.length !== roomIds.length) {

            throw new Error(
                "One or more selected rooms do not exist."
            );

        }

        validateDormSelection(roomIds, rooms);

        const reservationRoomRows = [...new Set(expandedRoomIds)].map(
            id => roomLookup.get(Number(id))
        ).filter(Boolean);

        /*
         * ------------------------------------------------
         * Check existing bookings.
         * ------------------------------------------------
         */

        const bookingCheckQuery = `
            SELECT
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

            AND b.check_out > $2::date

            FOR UPDATE;
        `;


        const bookingCheckResult =
            await client.query(
                bookingCheckQuery,
                [
                    expandedRoomIds,
                    checkIn,
                    checkOut
                ]
            );


        if (bookingCheckResult.rows.length > 0) {

            const unavailableRoomIds =
                bookingCheckResult.rows.map(
                    row => row.room_id
                );


            const error =
                new Error(
                    "One or more selected rooms are no longer available."
                );


            error.code = "ROOM_UNAVAILABLE";

            error.roomIds =
                unavailableRoomIds;


            throw error;

        }


        /*
         * ------------------------------------------------
         * Check blocked dates.
         * ------------------------------------------------
         */

        const blockedQuery = `
            SELECT
                room_id

            FROM blocked_dates

            WHERE room_id = ANY($1::int[])

            AND start_date < $3::date

            AND end_date > $2::date

            FOR UPDATE;
        `;


        const blockedResult =
            await client.query(
                blockedQuery,
                [
                    expandedRoomIds,
                    checkIn,
                    checkOut
                ]
            );


        if (blockedResult.rows.length > 0) {

            const blockedRoomIds =
                blockedResult.rows.map(
                    row => row.room_id
                );


            const error =
                new Error(
                    "One or more selected rooms are blocked for these dates."
                );


            error.code = "ROOM_BLOCKED";

            error.roomIds =
                blockedRoomIds;


            throw error;

        }


        const externalBookingQuery = `
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

        const externalBookingResult =
            await client.query(
                externalBookingQuery,
                [
                    expandedRoomIds,
                    checkIn,
                    checkOut
                ]
            );


        if (externalBookingResult.rows.length > 0) {

            const unavailableRoomIds =
                externalBookingResult.rows.map(
                    row => row.room_id
                );


            const error =
                new Error(
                    "One or more selected rooms are no longer available."
                );


            error.code = "ROOM_UNAVAILABLE";

            error.roomIds =
                unavailableRoomIds;


            throw error;

        }


        /*
         * ------------------------------------------------
         * Calculate capacity.
         * ------------------------------------------------
         */

        const adultCapacity =
            rooms.reduce(
                (total, room) =>
                    total +
                    Number(room.max_adults),
                0
            );


        const childCapacity =
            rooms.reduce(
                (total, room) =>
                    total +
                    Number(room.max_children),
                0
            );


        if (adults > adultCapacity) {

            const error =
                new Error(
                    "Selected rooms do not have enough adult capacity."
                );


            error.code =
                "INSUFFICIENT_ADULT_CAPACITY";


            throw error;

        }


        if (children > childCapacity) {

            const error =
                new Error(
                    "Selected rooms do not have enough child capacity."
                );


            error.code =
                "INSUFFICIENT_CHILD_CAPACITY";


            throw error;

        }


        /*
         * ------------------------------------------------
         * Calculate number of nights.
         * ------------------------------------------------
         */

        const nights =
            countNights(checkIn, checkOut);


        if (nights <= 0) {

            throw new Error(
                "Invalid number of nights."
            );

        }


        /*
         * ------------------------------------------------
         * Calculate price from DATABASE.
         *
         * Never trust a price sent by the frontend.
         * ------------------------------------------------
         */

        const totalPerNight =
            rooms.reduce(
                (total, room) =>
                    total +
                    Number(room.price_per_night),
                0
            );


        const totalAmount =
            totalPerNight * nights;


        /*
         * ------------------------------------------------
         * Create booking.
         * ------------------------------------------------
         */

        const bookingQuery = `
            INSERT INTO bookings (
                booking_reference,
                guest_name,
                email,
                phone,
                adults,
                children,
                check_in,
                check_out,
                total_amount,
                payment_status,
                booking_status,
                reservation_expires_at,
                booking_access_token_hash
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
                'PENDING',
                'PENDING',
                NOW() + INTERVAL '15 minutes',
                $10
            )

            RETURNING *;
        `;


        const bookingResult =
            await client.query(
                bookingQuery,
                [
                    bookingReference,
                    guestName,
                    email,
                    phone,
                    adults,
                    children,
                    checkIn,
                    checkOut,
                    totalAmount,
                    bookingAccessTokenHash
                ]
            );


        const booking =
            bookingResult.rows[0];


        /*
         * ------------------------------------------------
         * Insert selected rooms.
         * ------------------------------------------------
         */

        for (const room of reservationRoomRows) {

            await client.query(
                `
                INSERT INTO booking_rooms (
                    booking_id,
                    room_id,
                    price_per_night,
                    nights
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4
                );
                `,
                [
                    booking.id,
                    room.id,
                    room.price_per_night,
                    nights
                ]
            );

        }


        /*
         * ------------------------------------------------
         * Commit transaction.
         * ------------------------------------------------
         */

        await client.query("COMMIT");


        return {

            booking,

            rooms,

            nights,

            totalPerNight,

            totalAmount

        };

    }

    catch (error) {

        /*
         * Something went wrong.
         * Roll back EVERYTHING.
         */

        await client.query("ROLLBACK");

        throw error;

    }

    finally {

        /*
         * Return connection to pool.
         */

        client.release();

    }

}


module.exports = {

    createBooking

};
