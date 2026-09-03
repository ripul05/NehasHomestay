const db = require("./connection");
const {
    filterAvailableDormRooms,
    collapseDormInventory
} = require("./dormInventory");


/**
 * Get all active rooms available
 * for the requested date range.
 *
 * The mixed dorm behaves like this:
 * - if all 3 single beds are free, show the bundle AND the individual beds
 * - if any single bed is taken, hide only the bundle option
 * - other room types remain visible normally
 */
async function getAvailableRooms(checkIn, checkOut) {

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

    const overlappingBookingQuery = `
        SELECT DISTINCT
            br.room_id

        FROM booking_rooms br

        INNER JOIN bookings b
            ON b.id = br.booking_id

        WHERE (
            b.booking_status = 'CONFIRMED'
            OR (
                b.booking_status = 'PENDING'
                AND b.reservation_expires_at > NOW()
            )
        )

        AND b.check_in < $2::date
        AND b.check_out > $1::date;
    `;

    const blockedDatesQuery = `
        SELECT DISTINCT
            bd.room_id

        FROM blocked_dates bd

        WHERE bd.start_date < $2::date
        AND bd.end_date > $1::date;
    `;

    const externalBookingsQuery = `
        SELECT DISTINCT
            ebr.room_id

        FROM external_booking_rooms ebr
        INNER JOIN external_bookings eb
            ON eb.id = ebr.external_booking_id

        WHERE eb.status IN ('CONFIRMED', 'BLOCKED')
        AND eb.check_in < $2::date
        AND eb.check_out > $1::date;
    `;

    const [
        overlappingBookings,
        blockedDates,
        externalBookings
    ] = await Promise.all([
        db.query(overlappingBookingQuery, [checkIn, checkOut]),
        db.query(blockedDatesQuery, [checkIn, checkOut]),
        db.query(externalBookingsQuery, [checkIn, checkOut])
    ]);

    const unavailableRoomIds = [
        ...overlappingBookings.rows.map(row => Number(row.room_id)),
        ...blockedDates.rows.map(row => Number(row.room_id)),
        ...externalBookings.rows.map(row => Number(row.room_id))
    ];

    const filteredRooms = allRooms.filter(room => {
        if (room.room_type !== "DORM") {
            return !unavailableRoomIds.includes(Number(room.id));
        }

        return true;
    });

    return collapseDormInventory(
        filterAvailableDormRooms(filteredRooms, unavailableRoomIds)
    );
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

    const [startYear, startMonth, startDay] = checkIn.split("-").map(Number);
    const [endYear, endMonth, endDay] = checkOut.split("-").map(Number);

    const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
    const endUtc = Date.UTC(endYear, endMonth - 1, endDay);

    const nights = Math.round(
        (endUtc - startUtc) /
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
