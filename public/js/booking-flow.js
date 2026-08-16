document.addEventListener("DOMContentLoaded", () => {

    const guestDetailsSection =
        document.getElementById(
            "guestDetailsSection"
        );

    const guestDetailsForm =
        document.getElementById(
            "guestDetailsForm"
        );

    const reviewDates =
        document.getElementById(
            "reviewDates"
        );

    const reviewGuests =
        document.getElementById(
            "reviewGuests"
        );

    const reviewRooms =
        document.getElementById(
            "reviewRooms"
        );

    const reviewTotal =
        document.getElementById(
            "reviewTotal"
        );

    const confirmBookingButton =
        document.getElementById(
            "confirmBookingButton"
        );

        const showSwal = (options) => {
        if (window.Swal) {
            return window.Swal.fire(options);
        }

        const message = typeof options === "string"
            ? options
            : (options.text || "Action required.");

        alert(message);
    };

let paymentCompleted = false;


    /*
     * ==========================================
     * BACKEND URL
     * ==========================================
     */

    // const API_BASE_URL =
        "https://nehas-homestay.vercel.app";

    // Local development:
    const API_BASE_URL =
        // "http://localhost:3000";


    /*
     * ==========================================
     * POPULATE BOOKING REVIEW
     *
     * availability.js calls this after
     * successful selection validation.
     * ==========================================
     */

    window.populateBookingReview =
        function (selection) {

            const {
                dates,
                guests,
                selectedRooms,
                pricing
            } = selection;


            /*
             * ----------------------------------
             * Dates
             * ----------------------------------
             */

            reviewDates.innerHTML = `

                <strong>
                    Stay:
                </strong>

                ${formatDate(
                    dates.checkIn
                )}

                →

                ${formatDate(
                    dates.checkOut
                )}

                ·

                ${dates.nights}

                ${
                    dates.nights === 1
                        ? "night"
                        : "nights"
                }

            `;


            /*
             * ----------------------------------
             * Guests
             * ----------------------------------
             */

            reviewGuests.innerHTML = `

                <strong>
                    Guests:
                </strong>

                ${guests.adults}

                ${
                    guests.adults === 1
                        ? "adult"
                        : "adults"
                }

                ${
                    guests.children > 0
                        ? `, ${guests.children}
                           ${
                               guests.children === 1
                                   ? "child"
                                   : "children"
                           }`
                        : ""
                }

            `;


            /*
             * ----------------------------------
             * Selected rooms
             * ----------------------------------
             */

            reviewRooms.innerHTML = `

                <strong>
                    Selected Rooms
                </strong>

                ${
                    selectedRooms
                        .map(room => `

                            <div
                                class="review-room"
                            >

                                <span>
                                    ${
                                        escapeHtml(
                                            room.name
                                        )
                                    }
                                </span>

                                <span>
                                    ${
                                        formatCurrency(
                                            room.total
                                        )
                                    }
                                </span>

                            </div>

                        `)
                        .join("")
                }

            `;


            /*
             * ----------------------------------
             * Total
             * ----------------------------------
             */

            reviewTotal.textContent =
                formatCurrency(
                    pricing.totalAmount
                );

        };


    /*
     * ==========================================
     * SUBMIT BOOKING
     * ==========================================
     */

    guestDetailsForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            /*
             * ----------------------------------
             * Make sure selection exists
             * ----------------------------------
             */

            if (
                !window.bookingSelection
            ) {

                showSwal({

                    icon: "warning",

                    title:
                        "Selection missing",

                    text:
                        "Your room selection could not be found. Please select your rooms again."

                });

                return;

            }


            const selection =
                window.bookingSelection;


            /*
             * ----------------------------------
             * Guest information
             * ----------------------------------
             */

            const guestName =
                document
                    .getElementById(
                        "guestName"
                    )
                    .value
                    .trim();


            const email =
                document
                    .getElementById(
                        "guestEmail"
                    )
                    .value
                    .trim();


            const phone =
                document
                    .getElementById(
                        "guestPhone"
                    )
                    .value
                    .trim();


            /*
             * ----------------------------------
             * Basic validation
             * ----------------------------------
             */

            if (!guestName) {

                showSwal({

                    icon: "warning",

                    title:
                        "Name required",

                    text:
                        "Please enter your name."

                });

                return;

            }


            if (!email) {

                showSwal({

                    icon: "warning",

                    title:
                        "Email required",

                    text:
                        "Please enter your email."

                });

                return;

            }


            if (!phone) {

                showSwal({

                    icon: "warning",

                    title:
                        "Phone required",

                    text:
                        "Please enter your phone number."

                });

                return;

            }


            /*
             * ----------------------------------
             * Loading state
             * ----------------------------------
             */

            confirmBookingButton.disabled =
                true;

            confirmBookingButton.textContent =
                "Creating Booking...";


            try {

                /*
                 * =================================
                 * STEP 1
                 *
                 * Create booking in database
                 * =================================
                 */

                const payload = {

                    checkIn:
                        selection.dates.checkIn,

                    checkOut:
                        selection.dates.checkOut,

                    adults:
                        selection.guests.adults,

                    children:
                        selection.guests.children,

                    roomIds:
                        selection.selectedRooms.map(
                            room => room.id
                        ),

                    guestName,

                    email,

                    phone

                };


                const response =
                    await fetch(
                        `${API_BASE_URL}/api/bookings`,
                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    payload
                                )

                        }
                    );


                const data =
                    await response.json();


                /*
                 * ----------------------------------
                 * Booking failed
                 * ----------------------------------
                 */

                if (!response.ok) {

                    /*
                     * Someone else booked one
                     * of the selected rooms.
                     */

                    if (
                        response.status === 409
                    ) {

                        showSwal({

                            icon: "warning",

                            title:
                                "Rooms unavailable",

                            text:
                                "Unfortunately, one or more selected rooms are no longer available. Please start the booking again."

                        });


                        window.location.reload();

                        return;

                    }


                    throw new Error(
                        data.error ||
                        "Unable to create booking."
                    );

                }


                /*
                 * ----------------------------------
                 * Save created booking
                 * ----------------------------------
                 */

                window.createdBooking =
                    data;


                console.log(
                    "Booking created:",
                    data
                );


                /*
                 * =================================
                 * STEP 2
                 *
                 * Create Razorpay Order
                 * =================================
                 */

                confirmBookingButton.textContent =
                    "Preparing Payment...";


                const paymentResponse =
                    await fetch(
                        `${API_BASE_URL}/api/payments/create-order`,
                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    bookingId:
                                        data.booking.id

                                })

                        }
                    );


                const paymentData =
                    await paymentResponse.json();


                /*
                 * ----------------------------------
                 * Razorpay order failed
                 * ----------------------------------
                 */

                if (
                    !paymentResponse.ok
                ) {

                    throw new Error(
                        paymentData.error ||
                        "Unable to create payment order."
                    );

                }


                console.log(
                    "Razorpay order created:",
                    paymentData
                );


                /*
                 * =================================
                 * STEP 3
                 *
                 * Open Razorpay Checkout
                 * =================================
                 */

                openRazorpayCheckout(
                    paymentData,
                    data,
                    guestName,
                    email,
                    phone
                );

            }


            catch (error) {

                console.error(
                    "Booking/payment error:",
                    error
                );


                showSwal({

                    icon: "error",

                    title:
                        "Payment failed",

                    text:
                        error.message ||
                        "Unable to proceed with payment."

                });


                confirmBookingButton.disabled =
                    false;

                confirmBookingButton.textContent =
                    "Confirm & Proceed to Payment";

            }

        }
    );


    /*
     * ==========================================
     * OPEN RAZORPAY CHECKOUT
     * ==========================================
     */

    function openRazorpayCheckout(
        paymentData,
        bookingData,
        guestName,
        email,
        phone
    ) {

        paymentCompleted = false;

        /*
         * Make sure Razorpay Checkout script
         * has loaded.
         */

        if (
            typeof Razorpay ===
            "undefined"
        ) {

            showSwal({

                icon: "error",

                title:
                    "Payment unavailable",

                text:
                    "Razorpay Checkout could not be loaded. Please try again."

            });


            confirmBookingButton.disabled =
                false;

            confirmBookingButton.textContent =
                "Confirm & Proceed to Payment";

            return;

        }


        /*
         * ----------------------------------
         * Razorpay options
         * ----------------------------------
         */

        const options = {

            /*
             * Razorpay public Key ID.
             *
             * This is safe to expose to frontend.
             */

            key:
                paymentData.keyId,


            /*
             * Razorpay Order ID generated
             * by our backend.
             */

            order_id:
                paymentData.razorpayOrderId,


            /*
             * Amount in paise.
             *
             * Example:
             *
             * ₹3000 = 300000 paise
             */

            amount:
                paymentData.amount,


            /*
             * Currency
             */

            currency:
                paymentData.currency,


            /*
             * Merchant information
             */

            name:
                "Neha's Homestay",

            description:
                `Booking ${bookingData.booking.bookingReference}`,


            /*
             * ----------------------------------
             * Prefill guest information
             * ----------------------------------
             */

            prefill: {

                name:
                    guestName,

                email:
                    email,

                contact:
                    phone

            },


            /*
             * ----------------------------------
             * Razorpay notes
             * ----------------------------------
             */

            notes: {

                booking_id:
                    String(
                        bookingData.booking.id
                    ),

                booking_reference:
                    bookingData
                        .booking
                        .bookingReference

            },


            /*
             * ----------------------------------
             * Temporary payment handler
             *
             * IMPORTANT:
             *
             * We DO NOT confirm the booking
             * here.
             *
             * The next step will send these
             * details to our backend for
             * signature verification.
             * ----------------------------------
             */

            handler: async function (response) {
                paymentCompleted = true;

                console.log(
                    "Razorpay payment response:",
                    response
                );


                try {

                    confirmBookingButton.textContent =
                        "Verifying Payment...";


                    /*
                     * Send Razorpay response to backend
                     */

                    const verifyResponse =
                        await fetch(
                            `${API_BASE_URL}/api/payments/verify`,
                            {

                                method: "POST",

                                headers: {

                                    "Content-Type":
                                        "application/json"

                                },

                                body:
                                    JSON.stringify({

                                        bookingId:
                                            bookingData.booking.id,

                                        razorpay_payment_id:
                                            response.razorpay_payment_id,

                                        razorpay_order_id:
                                            response.razorpay_order_id,

                                        razorpay_signature:
                                            response.razorpay_signature

                                    })

                            }
                        );


                    const verifyData =
                        await verifyResponse.json();


                    /*
                     * Verification failed
                     */

                    if (!verifyResponse.ok) {

                        throw new Error(
                            verifyData.error ||
                            "Payment verification failed."
                        );

                    }


                    /*
                     * Payment successfully verified
                     */

                    console.log(
                        "Payment verified:",
                        verifyData
                    );


                    /*
                     * Store payment result
                     */

                    window.paymentVerification =
                        verifyData;


                    /*
                     * Update button
                     */

                    confirmBookingButton.textContent =
                        "Booking Confirmed";


                    /*
                     * Show success
                     */

                    await Promise.resolve(showSwal({

                        icon: "success",

                        title:
                            "Booking Confirmed!",

                        text:
                            `Your booking ${bookingData.booking.bookingReference
                            } has been confirmed.`

                    }));

                    /*
                     * The payment is complete, so return the customer to
                     * the first screen after they dismiss the confirmation.
                     * This also removes the completed guest-details form
                     * from view before a new booking begins.
                     */
                    confirmBookingButton.disabled = false;
                    confirmBookingButton.textContent =
                        "Confirm & Proceed to Payment";

                    if (window.bookingWizard) {
                        window.bookingWizard.showStep(1);
                    }


                }

                catch (error) {

                    console.error(
                        "Payment verification error:",
                        error
                    );


                    confirmBookingButton.disabled =
                        false;

                    confirmBookingButton.textContent =
                        "Confirm & Proceed to Payment";


                    showSwal({

                        icon: "error",

                        title:
                            "Payment Verification Failed",

                        text:
                            error.message ||
                            "We could not verify your payment. Please contact us if money was deducted."

                    });

                }

            },


            /*
             * ----------------------------------
             * Checkout closed
             * ----------------------------------
             */

            modal: {

                ondismiss:
                    function () {

                        if (paymentCompleted) {
                            return;
                        }

                        console.log(
                            "Razorpay checkout closed."
                        );


                        confirmBookingButton.disabled =
                            false;

                        confirmBookingButton.textContent =
                            "Confirm & Proceed to Payment";

                    }

            },


            /*
             * ----------------------------------
             * Theme
             * ----------------------------------
             */

            theme: {

                color:
                    "#b08a45"

            }

        };


        /*
         * Create Razorpay instance.
         */

        const razorpay =
            new Razorpay(
                options
            );


        /*
         * ----------------------------------
         * Payment failed
         * ----------------------------------
         */

        razorpay.on(
            "payment.failed",
            function (response) {

                console.error(
                    "Razorpay payment failed:",
                    response.error
                );


                showSwal({

                    icon: "error",

                    title:
                        "Payment failed",

                    text:
                        response.error &&
                        response.error.description
                            ? response.error.description
                            : "Payment failed. Please try again."

                });


                confirmBookingButton.disabled =
                    false;

                confirmBookingButton.textContent =
                    "Confirm & Proceed to Payment";

            }
        );


        /*
         * ----------------------------------
         * Open Razorpay
         * ----------------------------------
         */

        razorpay.open();

    }


    /*
     * ==========================================
     * HELPERS
     * ==========================================
     */

    function formatCurrency(amount) {

        return new Intl.NumberFormat(
            "en-IN",
            {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0
            }
        ).format(amount);

    }


    function formatDate(dateString) {

        /*
         * Avoid timezone problems with
         * YYYY-MM-DD.
         */

        const [
            year,
            month,
            day
        ] =
            dateString.split("-");


        const date =
            new Date(
                Number(year),
                Number(month) - 1,
                Number(day)
            );


        return new Intl.DateTimeFormat(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        ).format(date);

    }


    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value;

        return div.innerHTML;

    }

});