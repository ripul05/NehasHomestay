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
let activePaymentAttemptId = 0;


/*
     * ==========================================
     * BACKEND URL
     * ==========================================
     */

    const API_BASE_URL =
        "https://nehas-homestay.vercel.app";

    // Local development:
    // const API_BASE_URL =
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
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        bookingId: data.booking.id,
                        bookingAccessToken: data.booking.accessToken
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

                if (!paymentResponse.ok) {
                    throw new Error(paymentData.error || "Unable to create payment order.");
                }

                console.log("Razorpay order created:", paymentData);


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

            } catch (error) {

                console.error("Booking/payment error:", error);

                showSwal({
                    icon: "error",
                    title: "Booking failed",
                    text: error.message || "Unable to create or process this booking."
                });

                confirmBookingButton.disabled = false;
                confirmBookingButton.textContent = "Confirm & Proceed to Payment";
            }
        }
    );

    function openRazorpayCheckout(paymentData, bookingData, guestName, email, phone) {

        const attemptId = ++activePaymentAttemptId;
        const isCurrentAttempt = () => attemptId === activePaymentAttemptId;

        paymentCompleted = false;

        if (typeof Razorpay === "undefined") {

            showSwal({
                icon: "error",
                title: "Payment unavailable",
                text: "Razorpay Checkout could not be loaded. Please try again."
            });

            confirmBookingButton.disabled = false;
            confirmBookingButton.textContent = "Confirm & Proceed to Payment";
            return;
        }

        const options = {
            key: paymentData.keyId,
            order_id: paymentData.razorpayOrderId,
            amount: paymentData.amount,
            currency: paymentData.currency,
            name: "Neha's Homestay",
            description: `Booking ${bookingData.booking.bookingReference}`,
            prefill: {
                name: guestName,
                email: email,
                contact: phone
            },
            notes: {
                booking_id: String(bookingData.booking.id),
                booking_reference: bookingData.booking.bookingReference
            },
            handler: async function (response) {
                if (!isCurrentAttempt()) {
                    return;
                }

                paymentCompleted = true;

                console.log("Razorpay payment response:", response);

                try {
                    confirmBookingButton.textContent = "Verifying Payment...";

                    const verifyResponse = await fetch(`${API_BASE_URL}/api/payments/verify`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            bookingId: bookingData.booking.id,
                            bookingAccessToken: bookingData.booking.accessToken,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    if (!isCurrentAttempt()) {
                        return;
                    }

                    const verifyData = await verifyResponse.json();

                    if (!isCurrentAttempt()) {
                        return;
                    }

                    if (!verifyResponse.ok) {
                        throw new Error(verifyData.error || "Payment verification failed.");
                    }

                    console.log("Payment verified:", verifyData);
                    window.paymentVerification = verifyData;

                    confirmBookingButton.textContent = "Booking Confirmed";

                    await showSwal({
                        icon: "success",
                        title: "Booking Confirmed!",
                        text: `Your booking ${bookingData.booking.bookingReference} has been confirmed.`
                    });

                    if (!isCurrentAttempt()) {
                        return;
                    }

                    renderBookingConfirmationState({
                        bookingData,
                        guestName,
                        email,
                        phone
                    });

                    confirmBookingButton.disabled = true;
                    confirmBookingButton.textContent = "Booking Confirmed";

                } catch (error) {
                    console.error("Payment verification error:", error);

                    if (!isCurrentAttempt()) {
                        return;
                    }

                    showSwal({
                        icon: "error",
                        title: "Payment Verification Failed",
                        text: error.message || "We could not verify your payment. Please contact us if money was deducted."
                    });

                    confirmBookingButton.disabled = false;
                    confirmBookingButton.textContent = "Confirm & Proceed to Payment";
                }
            },
            modal: {
                ondismiss: function () {
                    if (!isCurrentAttempt()) {
                        return;
                    }

                    if (paymentCompleted) {
                        return;
                    }

                    console.log("Razorpay checkout closed.");
                    confirmBookingButton.disabled = false;
                    confirmBookingButton.textContent = "Confirm & Proceed to Payment";
                }
            },
            theme: {
                color: "#b08a45"
            }
        };

        const razorpay = new Razorpay(options);

        razorpay.on("payment.failed", function (response) {
            if (!isCurrentAttempt()) {
                return;
            }

            console.error("Razorpay payment failed:", response.error);

            showSwal({
                icon: "error",
                title: "Payment failed",
                text: response.error && response.error.description
                    ? response.error.description
                    : "Payment failed. Please try again."
            });

            confirmBookingButton.disabled = false;
            confirmBookingButton.textContent = "Confirm & Proceed to Payment";
        });

        razorpay.open();
    }

    function renderBookingConfirmationState({ bookingData, guestName, email, phone }) {
        const section = document.getElementById("guestDetailsSection");

        if (!section) {
            return;
        }

        const selection = window.bookingSelection || {};
        const dates = selection.dates || {};
        const guests = selection.guests || {};
        const selectedRooms = selection.selectedRooms || [];

        const guestSummary = [guestName, email, phone]
            .filter(Boolean)
            .join(" • ");

        const roomSummary = selectedRooms.length
            ? selectedRooms.map(room => `
                <div class="booking-confirmation-room">
                    <span>${escapeHtml(room.name || "Room")}</span>
                    <strong>${formatCurrency(room.total || 0)}</strong>
                </div>
            `).join("")
            : "<div class='booking-confirmation-room'><span>Room details</span></div>";

        section.innerHTML = `
            <div class="booking-confirmation-card">
                <div class="booking-confirmation-header">
                    <div class="booking-confirmation-badge">✓</div>
                    <div>
                        <p class="booking-confirmation-kicker">Booking confirmed</p>
                        <h2>Your stay is reserved</h2>
                    </div>
                </div>

                <div class="booking-confirmation-grid">
                    <div class="booking-confirmation-panel">
                        <h3>Confirmation</h3>
                        <div class="confirmation-row">
                            <span>Reference</span>
                            <strong>${escapeHtml(bookingData?.booking?.bookingReference || "N/A")}</strong>
                        </div>
                        <div class="confirmation-row">
                            <span>Guest</span>
                            <strong>${escapeHtml(guestSummary || "Guest")}</strong>
                        </div>
                        <div class="confirmation-row">
                            <span>Total paid</span>
                            <strong>${formatCurrency(bookingData?.pricing?.totalAmount || selection?.pricing?.totalAmount || 0)}</strong>
                        </div>
                    </div>

                    <div class="booking-confirmation-panel">
                        <h3>Stay details</h3>
                        <div class="confirmation-row">
                            <span>Dates</span>
                            <strong>${dates.checkIn ? formatDate(dates.checkIn) : "—"} → ${dates.checkOut ? formatDate(dates.checkOut) : "—"}</strong>
                        </div>
                        <div class="confirmation-row">
                            <span>Guests</span>
                            <strong>${guests.adults || 0} adults${(guests.children || 0) > 0 ? `, ${(guests.children || 0)} children` : ""}</strong>
                        </div>
                        <div class="confirmation-row">
                            <span>Length</span>
                            <strong>${dates.nights || 0} ${Number(dates.nights) === 1 ? "night" : "nights"}</strong>
                        </div>
                    </div>
                </div>

                <div class="booking-confirmation-rooms">
                    <h3>Selected rooms</h3>
                    ${roomSummary}
                </div>
            </div>
        `;
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
