const express = require("express");

const crypto = require("crypto");

const Razorpay =
    require("razorpay");

const router =
    express.Router();


const paymentRepository =
    require("../Database/PaymentRepo");


/*
 * ==========================================
 * RAZORPAY INSTANCE
 * ==========================================
 */

const razorpay =
    new Razorpay({

        key_id:
            process.env.RAZORPAY_KEY_ID,

        key_secret:
            process.env.RAZORPAY_KEY_SECRET

    });


/*
 * ==========================================
 * CREATE RAZORPAY ORDER
 *
 * POST
 * /api/payments/create-order
 * ==========================================
 */

router.post(
    "/payments/create-order",
    async (req, res) => {

        try {

            const {
                bookingId
            } = req.body;


            const numericBookingId =
                Number(bookingId);


            /*
             * Validate booking ID
             */

            if (
                !Number.isInteger(
                    numericBookingId
                ) ||
                numericBookingId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid booking ID."

                });

            }


            /*
             * Get booking from database
             */

            const booking =
                await paymentRepository
                    .getBookingForPayment(
                        numericBookingId
                    );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Booking not found."

                });

            }


            /*
             * Only pending bookings can
             * proceed to payment.
             */

            if (
                booking.booking_status !==
                "PENDING"
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "This booking is not available for payment."

                });

            }


            /*
             * Already paid?
             */

            if (
                booking.payment_status ===
                "PAID"
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "This booking has already been paid."

                });

            }


            /*
             * Convert rupees to paise.
             */

            const amount =
                Math.round(
                    Number(
                        booking.total_amount
                    ) * 100
                );


            if (
                !Number.isInteger(amount) ||
                amount <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid booking amount."

                });

            }


            /*
             * If Razorpay order already exists,
             * reuse it.
             */

            if (
                booking.razorpay_order_id
            ) {

                return res.json({

                    success: true,

                    existingOrder: true,

                    bookingId:
                        booking.id,

                    bookingReference:
                        booking.booking_reference,

                    razorpayOrderId:
                        booking.razorpay_order_id,

                    amount,

                    currency:
                        "INR",

                    keyId:
                        process.env
                            .RAZORPAY_KEY_ID

                });

            }


            /*
             * Razorpay receipt
             */

            const receipt =
                String(
                    booking.booking_reference
                ).substring(0, 40);


            /*
             * Create Razorpay order
             */

            const razorpayOrder =
                await razorpay.orders.create({

                    amount,

                    currency:
                        "INR",

                    receipt,

                    notes: {

                        booking_id:
                            String(
                                booking.id
                            ),

                        booking_reference:
                            booking
                                .booking_reference

                    }

                });


            /*
             * Save Razorpay order ID
             */

            await paymentRepository
                .saveRazorpayOrderId(
                    booking.id,
                    razorpayOrder.id
                );


            /*
             * Return order information
             */

            return res.status(201).json({

                success: true,

                existingOrder: false,

                bookingId:
                    booking.id,

                bookingReference:
                    booking.booking_reference,

                razorpayOrderId:
                    razorpayOrder.id,

                amount:
                    razorpayOrder.amount,

                currency:
                    razorpayOrder.currency,

                keyId:
                    process.env
                        .RAZORPAY_KEY_ID

            });

        }

        catch (error) {

            console.error(
                "Razorpay order creation error:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    "Unable to create Razorpay order."

            });

        }

    }
);


/*
 * ==========================================
 * VERIFY RAZORPAY PAYMENT
 *
 * POST
 * /api/payments/verify
 * ==========================================
 */

router.post(
    "/payments/verify",
    async (req, res) => {

        try {

            const {

                bookingId,

                razorpay_payment_id,

                razorpay_order_id,

                razorpay_signature

            } = req.body;


            /*
             * ==================================
             * VALIDATE REQUEST
             * ==================================
             */

            const numericBookingId =
                Number(bookingId);


            if (
                !Number.isInteger(
                    numericBookingId
                ) ||
                numericBookingId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid booking ID."

                });

            }


            if (
                !razorpay_payment_id ||
                !razorpay_order_id ||
                !razorpay_signature
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Payment verification details are incomplete."

                });

            }


            /*
             * ==================================
             * GET BOOKING FROM DATABASE
             * ==================================
             */

            const booking =
                await paymentRepository
                    .getBookingForPayment(
                        numericBookingId
                    );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Booking not found."

                });

            }


            /*
             * ==================================
             * IDEMPOTENCY
             *
             * If already paid, don't process
             * the same payment again.
             * ==================================
             */

            if (
                booking.payment_status ===
                "PAID"
            ) {

                return res.json({

                    success: true,

                    alreadyVerified: true,

                    booking: {

                        id:
                            booking.id,

                        bookingReference:
                            booking
                                .booking_reference,

                        paymentStatus:
                            booking
                                .payment_status,

                        bookingStatus:
                            booking
                                .booking_status

                    }

                });

            }


            /*
             * ==================================
             * IMPORTANT SECURITY CHECK
             *
             * DO NOT trust the order ID
             * supplied by the browser.
             *
             * Compare it against the order
             * we stored in our database.
             * ==================================
             */

            if (
                !booking.razorpay_order_id
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Razorpay order not found for this booking."

                });

            }


            if (
                booking.razorpay_order_id !==
                razorpay_order_id
            ) {

                console.error(
                    "Razorpay order mismatch:",
                    {
                        bookingOrder:
                            booking
                                .razorpay_order_id,

                        receivedOrder:
                            razorpay_order_id
                    }
                );


                return res.status(400).json({

                    success: false,

                    error:
                        "Razorpay order does not match this booking."

                });

            }


            /*
             * ==================================
             * GENERATE EXPECTED SIGNATURE
             *
             * Razorpay:
             *
             * HMAC-SHA256(
             *     order_id + "|" + payment_id,
             *     key_secret
             * )
             * ==================================
             */

            const signaturePayload =
                booking.razorpay_order_id +
                "|" +
                razorpay_payment_id;


            const expectedSignature =
                crypto
                    .createHmac(
                        "sha256",
                        process.env
                            .RAZORPAY_KEY_SECRET
                    )
                    .update(
                        signaturePayload
                    )
                    .digest("hex");


            /*
             * ==================================
             * TIMING-SAFE COMPARISON
             * ==================================
             */

            const expectedBuffer =
                Buffer.from(
                    expectedSignature,
                    "utf8"
                );


            const receivedBuffer =
                Buffer.from(
                    razorpay_signature,
                    "utf8"
                );


            /*
             * Length must be equal before
             * timingSafeEqual().
             */

            if (
                expectedBuffer.length !==
                receivedBuffer.length
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Payment signature verification failed."

                });

            }


            const signatureValid =
                crypto.timingSafeEqual(
                    expectedBuffer,
                    receivedBuffer
                );


            /*
             * ==================================
             * INVALID SIGNATURE
             * ==================================
             */

            if (!signatureValid) {

                console.error(
                    "Invalid Razorpay payment signature."
                );


                return res.status(400).json({

                    success: false,

                    error:
                        "Payment signature verification failed."

                });

            }


            /*
             * ==================================
             * SIGNATURE VALID
             *
             * Store payment information and
             * confirm booking.
             * ==================================
             */

            const updatedBooking =
                await paymentRepository
                    .markPaymentVerified({

                        bookingId:
                            booking.id,

                        razorpayPaymentId:
                            razorpay_payment_id,

                        razorpaySignature:
                            razorpay_signature

                    });


            /*
             * ==================================
             * RESPONSE
             * ==================================
             */

            return res.json({

                success: true,

                verified: true,

                message:
                    "Payment verified successfully.",

                booking: {

                    id:
                        updatedBooking.id,

                    bookingReference:
                        updatedBooking
                            .booking_reference,

                    totalAmount:
                        updatedBooking
                            .total_amount,

                    paymentStatus:
                        updatedBooking
                            .payment_status,

                    bookingStatus:
                        updatedBooking
                            .booking_status,

                    razorpayOrderId:
                        updatedBooking
                            .razorpay_order_id,

                    razorpayPaymentId:
                        updatedBooking
                            .razorpay_payment_id

                }

            });

        }

        catch (error) {

            console.error(
                "Payment verification error:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    "Unable to verify payment."

            });

        }

    }
);


module.exports = router;