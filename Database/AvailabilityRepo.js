const db = require("./connection");


/**
 * Get all individual rooms/beds available
 * for the requested date range.
 */
async function getAvailableRooms(checkIn, checkOut) {

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

        WHERE r.active = TRUE

        /*
         * Exclude units that have an overlapping
         * pending or confirmed booking.
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

            AND b.check_in < $2

            AND b.check_out > $1
        )

        /*
         * Exclude units that have been manually
         * blocked for maintenance, owner use, etc.
         */
        AND NOT EXISTS (

            SELECT 1

            FROM blocked_dates bd

            WHERE bd.room_id = r.id

            AND bd.start_date < $2

            AND bd.end_date > $1
        )

        ORDER BY r.id;
    `;

    const { rows } = await db.query(
        query,
        [checkIn, checkOut]
    );

    return rows;
}


/**
 * Get complete availability information.
 *
 * IMPORTANT:
 * This does NOT choose rooms for the customer.
 *
 * It returns all available individual units.
 */
async function getAvailability(
    checkIn,
    checkOut,
    adults,
    children
) {

    const rooms = await getAvailableRooms(
        checkIn,
        checkOut
    );


    /*
     * Separate the available inventory
     * into private rooms and dorm beds.
     */

    const privateRooms = rooms.filter(
        room => room.room_type === "PRIVATE"
    );

    const dormBeds = rooms.filter(
        room => room.room_type === "DORM"
    );


    /*
     * Calculate total capacity of currently
     * available inventory.
     */

    const privateAdultCapacity =
        privateRooms.reduce(
            (total, room) =>
                total + Number(room.max_adults),
            0
        );

    const privateChildCapacity =
        privateRooms.reduce(
            (total, room) =>
                total + Number(room.max_children),
            0
        );

    const dormAdultCapacity =
        dormBeds.reduce(
            (total, room) =>
                total + Number(room.max_adults),
            0
        );


    const totalAdultCapacity =
        privateAdultCapacity +
        dormAdultCapacity;


    const totalChildCapacity =
        privateChildCapacity;


    /*
     * This only tells us whether the currently
     * available inventory could theoretically
     * accommodate the requested guests.
     *
     * It does NOT select rooms.
     */

    const canAccommodateGuests =
        adults <= totalAdultCapacity &&
        children <= totalChildCapacity;


    /*
     * Calculate number of nights.
     */

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);

    const nights = Math.round(
        (
            endDate.getTime() -
            startDate.getTime()
        ) /
        (1000 * 60 * 60 * 24)
    );


    /*
     * Prices.
     *
     * Since all private rooms currently have
     * the same price, use the first available
     * private room.
     *
     * Same for dorm beds.
     */

    const privatePrice =
        privateRooms.length > 0
            ? Number(privateRooms[0].price_per_night)
            : 0;

    const dormPrice =
        dormBeds.length > 0
            ? Number(dormBeds[0].price_per_night)
            : 0;


    return {

        /*
         * Individual units.
         *
         * THIS is what the frontend will use
         * for room selection.
         */
        rooms,

        /*
         * Convenient grouped information.
         */
        privateRooms: {

            available: privateRooms.length,

            pricePerNight: privatePrice,

            adultCapacity:
                privateAdultCapacity,

            childCapacity:
                privateChildCapacity

        },

        dorm: {

            availableBeds: dormBeds.length,

            pricePerNight: dormPrice,

            adultCapacity:
                dormAdultCapacity,

            childCapacity: 0

        },

        dates: {

            checkIn,

            checkOut,

            nights

        },

        guests: {

            adults,

            children,

            total: adults + children

        },

        totalCapacity: {

            adults:
                totalAdultCapacity,

            children:
                totalChildCapacity

        },

        canAccommodateGuests

    };
}


module.exports = {

    getAvailableRooms,

    getAvailability

};