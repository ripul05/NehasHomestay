const express = require("express");

const router = express.Router();

const availabilityRepository =
    require("../database/AvailabilityRepo");

const selectionRepository =
    require("../database/SelectionRepo");
const { createRateLimiter } = require("../middleware/rateLimit");
const { validateStayDates } = require("../utils/bookingValidation");


router.post("/availability", createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many availability searches. Please wait a minute."
}), async (req, res) => {

    try {

        const {
            checkIn,
            checkOut,
            adults = 1,
            children = 0
        } = req.body;

        const stay = validateStayDates(checkIn, checkOut);
        if (stay.error) {
            return res.status(400).json({ success: false, error: stay.error });
        }


        /*
         * Validate dates
         */

        if (!checkIn || !checkOut) {

            return res.status(400).json({

                success: false,

                error:
                    "Check-in and check-out dates are required."

            });

        }


        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)
        ) {

            return res.status(400).json({

                success: false,

                error: "Invalid date format."

            });

        }


        if (checkIn >= checkOut) {

            return res.status(400).json({

                success: false,

                error:
                    "Check-out must be after check-in."

            });

        }


        /*
         * Validate guests
         */

        const adultCount = Number(adults);
        const childCount = Number(children);


        if (
            !Number.isInteger(adultCount) ||
            adultCount < 1
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "At least one adult is required."

            });

        }


        if (
            !Number.isInteger(childCount) ||
            childCount < 0
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Invalid number of children."

            });

        }


        /*
         * Get availability
         */

        const availability =
            await availabilityRepository.getAvailability(
                checkIn,
                checkOut,
                adultCount,
                childCount
            );


        /*
         * Return availability.
         *
         * No room is selected automatically.
         */

        return res.json({

            success: true,

            ...availability

        });

    }

    catch (error) {

        console.error(
            "Availability error:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                "Unable to check availability."

        });

    }

});

router.post("/validate-selection", createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: "Too many selection attempts. Please wait a minute."
}), async (req, res) => {

    try {

        const {
            checkIn,
            checkOut,
            adults,
            children = 0,
            roomIds
        } = req.body;

        const stay = validateStayDates(checkIn, checkOut);
        if (stay.error) {
            return res.status(400).json({ success: false, error: stay.error });
        }


        /*
         * --------------------------------
         * Validate dates
         * --------------------------------
         */

        if (!checkIn || !checkOut) {

            return res.status(400).json({

                success: false,

                error:
                    "Check-in and check-out dates are required."

            });

        }


        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)
        ) {

            return res.status(400).json({

                success: false,

                error: "Invalid date format."

            });

        }


        if (checkIn >= checkOut) {

            return res.status(400).json({

                success: false,

                error:
                    "Check-out must be after check-in."

            });

        }


        /*
         * --------------------------------
         * Validate guests
         * --------------------------------
         */

        const adultCount = Number(adults);
        const childCount = Number(children);


        if (
            !Number.isInteger(adultCount) ||
            adultCount < 1
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "At least one adult is required."

            });

        }


        if (
            !Number.isInteger(childCount) ||
            childCount < 0
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Invalid number of children."

            });

        }


        /*
         * --------------------------------
         * Validate roomIds
         * --------------------------------
         */

        if (
            !Array.isArray(roomIds) ||
            roomIds.length === 0
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Please select at least one room or bed."

            });

        }


        /*
         * Convert IDs to numbers.
         */

        const selectedRoomIds =
            roomIds.map(Number);


        /*
         * Make sure every ID is a valid
         * positive integer.
         */

        if (
            selectedRoomIds.some(
                id =>
                    !Number.isInteger(id) ||
                    id <= 0
            )
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Invalid room selection."

            });

        }


        /*
         * Prevent duplicate room IDs.
         */

        const uniqueRoomIds =
            [...new Set(selectedRoomIds)];


        if (
            uniqueRoomIds.length !==
            selectedRoomIds.length
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "A room or bed cannot be selected more than once."

            });

        }


        /*
         * --------------------------------
         * Get currently available rooms
         * --------------------------------
         */

        const selectedRooms =
            await selectionRepository.getSelectedRooms(
                uniqueRoomIds,
                checkIn,
                checkOut
            );


        /*
         * --------------------------------
         * Check whether every selected
         * room was actually returned.
         *
         * This catches rooms that were booked
         * after the availability search.
         * --------------------------------
         */

        if (
            selectedRooms.length !==
            uniqueRoomIds.length
        ) {

            const availableIds =
                new Set(
                    selectedRooms.map(
                        room => room.id
                    )
                );


            const unavailableIds =
                uniqueRoomIds.filter(
                    id => !availableIds.has(id)
                );


            return res.status(409).json({

                success: false,

                error:
                    "One or more selected rooms are no longer available.",

                unavailableRoomIds:
                    unavailableIds

            });

        }


        /*
         * --------------------------------
         * Calculate capacity
         * --------------------------------
         */

        const adultCapacity =
            selectedRooms.reduce(
                (total, room) =>
                    total +
                    Number(room.max_adults),
                0
            );


        const childCapacity =
            selectedRooms.reduce(
                (total, room) =>
                    total +
                    Number(room.max_children),
                0
            );


        /*
         * Verify requested guests fit
         * inside the selected rooms.
         */

        if (adultCount > adultCapacity) {

            return res.status(400).json({

                success: false,

                error:
                    "The selected rooms do not have enough adult capacity.",

                requested: {

                    adults: adultCount,

                    children: childCount

                },

                selectedCapacity: {

                    adults: adultCapacity,

                    children: childCapacity

                }

            });

        }


        if (childCount > childCapacity) {

            return res.status(400).json({

                success: false,

                error:
                    "The selected rooms do not have enough child capacity.",

                requested: {

                    adults: adultCount,

                    children: childCount

                },

                selectedCapacity: {

                    adults: adultCapacity,

                    children: childCapacity

                }

            });

        }


        /*
         * --------------------------------
         * Calculate nights
         * --------------------------------
         */

        const nights = Math.round(
            (
                end.getTime() -
                start.getTime()
            ) /
            (1000 * 60 * 60 * 24)
        );


        /*
         * --------------------------------
         * Calculate price
         * --------------------------------
         */

        const roomsWithPrice =
            selectedRooms.map(room => {

                const pricePerNight =
                    Number(room.price_per_night);


                const roomTotal =
                    pricePerNight * nights;


                return {

                    id: room.id,

                    code: room.code,

                    name: room.name,

                    roomType: room.room_type,

                    pricePerNight,

                    nights,

                    total: roomTotal

                };

            });


        const totalPerNight =
            roomsWithPrice.reduce(
                (total, room) =>
                    total +
                    room.pricePerNight,
                0
            );


        const totalAmount =
            roomsWithPrice.reduce(
                (total, room) =>
                    total +
                    room.total,
                0
            );


        /*
         * --------------------------------
         * Success
         * --------------------------------
         */

        return res.json({

            success: true,

            dates: {

                checkIn,

                checkOut,

                nights

            },

            guests: {

                adults: adultCount,

                children: childCount,

                total:
                    adultCount +
                    childCount

            },

            selectedRooms:
                roomsWithPrice,

            capacity: {

                adults:
                    adultCapacity,

                children:
                    childCapacity

            },

            pricing: {

                totalPerNight,

                totalAmount

            }

        });

    }


    catch (error) {

        console.error(
            "Selection validation error:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                "Unable to validate room selection."

        });

    }

});


module.exports = router;
