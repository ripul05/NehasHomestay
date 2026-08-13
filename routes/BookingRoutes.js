const express = require("express");

const router = express.Router();

const bookingRepository =
    require("../Database/BookingRepo");


/**
 * Create booking
 *
 * POST /api/bookings
 */
router.post("/bookings", async (req, res) => {

    try {

        const {
            checkIn,
            checkOut,
            adults,
            children = 0,
            roomIds,
            guestName,
            email,
            phone
        } = req.body;


        /*
         * --------------------------------
         * Validate guest information
         * --------------------------------
         */

        if (!guestName) {

            return res.status(400).json({

                success: false,

                error:
                    "Guest name is required."

            });

        }


        if (!email) {

            return res.status(400).json({

                success: false,

                error:
                    "Email is required."

            });

        }


        if (!phone) {

            return res.status(400).json({

                success: false,

                error:
                    "Phone number is required."

            });

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


        const start =
            new Date(checkIn);

        const end =
            new Date(checkOut);


        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Invalid date format."

            });

        }


        if (start >= end) {

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

        const adultCount =
            Number(adults);

        const childCount =
            Number(children);


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
         * Validate room selection
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


        const selectedRoomIds =
            roomIds.map(Number);


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
         * Generate booking reference
         * --------------------------------
         */

        const bookingReference =
            `NHS-${Date.now()}-${Math.floor(
                Math.random() * 1000
            )}`;


        /*
         * --------------------------------
         * Create booking
         * --------------------------------
         */

        const result =
            await bookingRepository.createBooking({

                bookingReference,

                guestName,

                email,

                phone,

                adults:
                    adultCount,

                children:
                    childCount,

                checkIn,

                checkOut,

                roomIds:
                    uniqueRoomIds

            });


        /*
         * --------------------------------
         * Success
         * --------------------------------
         */

        return res.status(201).json({

            success: true,

            booking: {

                id:
                    result.booking.id,

                bookingReference:
                    result.booking.booking_reference,

                guestName:
                    result.booking.guest_name,

                email:
                    result.booking.email,

                phone:
                    result.booking.phone,

                checkIn:
                    result.booking.check_in,

                checkOut:
                    result.booking.check_out,

                adults:
                    result.booking.adults,

                children:
                    result.booking.children,

                bookingStatus:
                    result.booking.booking_status,

                paymentStatus:
                    result.booking.payment_status

            },

            rooms:
                result.rooms.map(room => ({

                    id:
                        room.id,

                    code:
                        room.code,

                    name:
                        room.name,

                    roomType:
                        room.room_type,

                    pricePerNight:
                        Number(
                            room.price_per_night
                        )

                })),

            pricing: {

                nights:
                    result.nights,

                totalPerNight:
                    result.totalPerNight,

                totalAmount:
                    result.totalAmount

            }

        });

    }

    catch (error) {

        console.error(
            "Booking creation error:",
            error
        );


        /*
         * Room became unavailable.
         */

        if (
            error.code ===
            "ROOM_UNAVAILABLE"
        ) {

            return res.status(409).json({

                success: false,

                error:
                    error.message,

                unavailableRoomIds:
                    error.roomIds

            });

        }


        /*
         * Room is blocked.
         */

        if (
            error.code ===
            "ROOM_BLOCKED"
        ) {

            return res.status(409).json({

                success: false,

                error:
                    error.message,

                blockedRoomIds:
                    error.roomIds

            });

        }


        /*
         * Capacity errors.
         */

        if (
            error.code ===
            "INSUFFICIENT_ADULT_CAPACITY"
        ) {

            return res.status(400).json({

                success: false,

                error:
                    error.message

            });

        }


        if (
            error.code ===
            "INSUFFICIENT_CHILD_CAPACITY"
        ) {

            return res.status(400).json({

                success: false,

                error:
                    error.message

            });

        }


        /*
         * Generic server error.
         */

        return res.status(500).json({

            success: false,

            error:
                "Unable to create booking."

        });

    }

});


module.exports = router;