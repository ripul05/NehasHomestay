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


    /*
     * ==========================================
     * BACKEND URL
     * ==========================================
     *
     * LOCAL DEVELOPMENT
     */

    const API_BASE_URL =
        "https://nehas-homestay.vercel.app";
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
             * Make sure we have a validated
             * selection.
             */

            if (
                !window.bookingSelection
            ) {

                alert(
                    "Your room selection could not be found. Please select your rooms again."
                );

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
                 * --------------------------------
                 * Build booking payload
                 *
                 * IMPORTANT:
                 *
                 * We send:
                 * - dates
                 * - guests
                 * - room IDs
                 * - guest details
                 *
                 * We DO NOT send the price.
                 *
                 * Backend calculates the price.
                 * --------------------------------
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


                /*
                 * --------------------------------
                 * Create booking
                 * --------------------------------
                 */

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
                 * --------------------------------
                 * Booking failed
                 * --------------------------------
                 */

                if (!response.ok) {

                    /*
                     * Someone else booked
                     * our selected room.
                     */

                    if (
                        response.status === 409
                    ) {

                        alert(
                            "Unfortunately, one or more selected rooms are no longer available. Please start the booking again."
                        );


                        window.location.reload();

                        return;

                    }


                    throw new Error(
                        data.error ||
                        "Unable to create booking."
                    );

                }


                /*
                 * --------------------------------
                 * Booking created
                 * --------------------------------
                 */

                window.createdBooking =
                    data;


                console.log(
                    "Booking created:",
                    data
                );


                /*
                 * TEMPORARY
                 *
                 * We'll replace this with
                 * Razorpay in the next step.
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
                 * Change button state.
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
         * Avoid timezone surprises for
         * YYYY-MM-DD dates.
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