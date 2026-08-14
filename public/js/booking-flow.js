document.addEventListener("DOMContentLoaded", () => {

    const continueBooking =
        document.getElementById("continueBooking");

    const guestDetailsSection =
        document.getElementById("guestDetailsSection");

    const guestDetailsForm =
        document.getElementById("guestDetailsForm");

    const reviewDates =
        document.getElementById("reviewDates");

    const reviewGuests =
        document.getElementById("reviewGuests");

    const reviewRooms =
        document.getElementById("reviewRooms");

    const reviewTotal =
        document.getElementById("reviewTotal");

    const confirmBookingButton =
        document.getElementById("confirmBookingButton");


    /*
     * -----------------------------------------
     * Backend URL
     * -----------------------------------------
     */

    const API_BASE_URL =
        "http://localhost:3000";


    /*
     * -----------------------------------------
     * Continue after selection validation
     * -----------------------------------------
     */

    continueBooking.addEventListener(
        "click",
        async () => {

            /*
             * availability.js already validates
             * the selection.
             *
             * It stores the result here:
             *
             * window.bookingSelection
             */

            if (!window.bookingSelection) {

                alert(
                    "Please validate your room selection first."
                );

                return;

            }


            const selection =
                window.bookingSelection;


            /*
             * Populate review.
             */

            populateReview(selection);


            /*
             * Show guest details.
             */

            guestDetailsSection.style.display =
                "block";


            /*
             * Scroll to guest details.
             */

            guestDetailsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }
    );


    /*
     * -----------------------------------------
     * Populate booking review
     * -----------------------------------------
     */

    function populateReview(selection) {

        const {
            dates,
            guests,
            selectedRooms,
            pricing
        } = selection;


        /*
         * Dates
         */

        reviewDates.innerHTML = `
            <strong>Stay:</strong>
            ${formatDate(dates.checkIn)}
            →
            ${formatDate(dates.checkOut)}
            ·
            ${dates.nights}
            ${dates.nights === 1 ? "night" : "nights"}
        `;


        /*
         * Guests
         */

        reviewGuests.innerHTML = `
            <strong>Guests:</strong>
            ${guests.adults}
            ${guests.adults === 1 ? "adult" : "adults"}
            ${
                guests.children > 0
                    ? `, ${guests.children}
                       ${guests.children === 1
                            ? "child"
                            : "children"}`
                    : ""
            }
        `;


        /*
         * Rooms
         */

        reviewRooms.innerHTML = `

            <strong>Selected Rooms</strong>

            ${
                selectedRooms
                    .map(room => `
                        <div class="review-room">

                            <span>
                                ${escapeHtml(room.name)}
                            </span>

                            <span>
                                ${formatCurrency(
                                    room.total
                                )}
                            </span>

                        </div>
                    `)
                    .join("")
            }

        `;


        /*
         * Total
         */

        reviewTotal.textContent =
            formatCurrency(
                pricing.totalAmount
            );

    }


    /*
     * -----------------------------------------
     * Submit booking
     * -----------------------------------------
     */

    guestDetailsForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            if (!window.bookingSelection) {

                alert(
                    "Your room selection is no longer available. Please start again."
                );

                return;

            }


            const selection =
                window.bookingSelection;


            /*
             * Get guest information.
             */

            const guestName =
                document
                    .getElementById("guestName")
                    .value
                    .trim();

            const email =
                document
                    .getElementById("guestEmail")
                    .value
                    .trim();

            const phone =
                document
                    .getElementById("guestPhone")
                    .value
                    .trim();


            /*
             * Basic validation.
             */

            if (!guestName) {

                alert(
                    "Please enter your name."
                );

                return;

            }


            if (!email) {

                alert(
                    "Please enter your email."
                );

                return;

            }


            if (!phone) {

                alert(
                    "Please enter your phone number."
                );

                return;

            }


            /*
             * Loading state.
             */

            confirmBookingButton.disabled =
                true;

            confirmBookingButton.textContent =
                "Creating Booking...";


            try {

                /*
                 * Build booking payload.
                 *
                 * IMPORTANT:
                 * We send room IDs.
                 *
                 * We do NOT send prices.
                 *
                 * The backend calculates the price
                 * from the database.
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
                 * Booking failed.
                 */

                if (!response.ok) {

                    /*
                     * Someone else may have booked
                     * one of our selected rooms.
                     */

                    if (
                        response.status === 409
                    ) {

                        alert(
                            "Unfortunately, one or more selected rooms are no longer available. Please search again."
                        );


                        /*
                         * Reset the booking flow.
                         */

                        window.location.reload();

                        return;

                    }


                    throw new Error(
                        data.error ||
                        "Unable to create booking."
                    );

                }


                /*
                 * Store booking.
                 *
                 * Razorpay will use this in the
                 * next step.
                 */

                window.createdBooking =
                    data;


                console.log(
                    "Booking created:",
                    data
                );


                /*
                 * For now we simply show the
                 * booking reference.
                 *
                 * Next step:
                 * Razorpay payment.
                 */

                alert(
                    `Booking created successfully!\n\n` +
                    `Booking Reference: ${
                        data.booking.bookingReference
                    }\n\n` +
                    `Amount: ${
                        formatCurrency(
                            data.pricing.totalAmount
                        )
                    }`
                );


                /*
                 * Change button for now.
                 */

                confirmBookingButton.textContent =
                    "Booking Created";


            }

            catch (error) {

                console.error(
                    "Booking error:",
                    error
                );


                alert(
                    error.message ||
                    "Unable to create booking."
                );


                confirmBookingButton.disabled =
                    false;

                confirmBookingButton.textContent =
                    "Confirm & Proceed to Payment";

            }

        }
    );


    /*
     * -----------------------------------------
     * Helpers
     * -----------------------------------------
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

        return new Intl.DateTimeFormat(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        ).format(
            new Date(dateString)
        );

    }


    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value;

        return div.innerHTML;

    }

});