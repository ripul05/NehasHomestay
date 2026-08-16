const db = require("./connection");


/**
 * Create a new booking and assign the selected
 * rooms/beds to that booking.
 *
 * Everything happens inside ONE transaction.
 */
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
            [roomIds]
        );


        const rooms = roomResult.rows;


        /*
         * Make sure every requested room exists.
         */

        if (rooms.length !== roomIds.length) {

            throw new Error(
                "One or more selected rooms do not exist."
            );

        }


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

            AND b.check_in < $3

            AND b.check_out > $2

            FOR UPDATE;
        `;


        const bookingCheckResult =
            await client.query(
                bookingCheckQuery,
                [
                    roomIds,
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

            AND start_date < $3

            AND end_date > $2

            FOR UPDATE;
        `;


        const blockedResult =
            await client.query(
                blockedQuery,
                [
                    roomIds,
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

        const startDate =
            new Date(checkIn);

        const endDate =
            new Date(checkOut);


        const nights =
            Math.round(
                (
                    endDate.getTime() -
                    startDate.getTime()
                ) /
                (1000 * 60 * 60 * 24)
            );


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

        for (const room of rooms) {

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
