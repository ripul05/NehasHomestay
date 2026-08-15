document.addEventListener("DOMContentLoaded", () => {

    const checkAvailabilityButton =
        document.getElementById("checkAvailability");

    const availabilitySection =
        document.getElementById("availabilitySection");

    const privateRoomsList =
        document.getElementById("privateRoomsList");

    const dormRoomsList =
        document.getElementById("dormRoomsList");

    const availabilitySummary =
        document.getElementById("availabilitySummary");

    const selectionSummary =
        document.getElementById("selectionSummary");

    const selectedRoomCount =
        document.getElementById("selectedRoomCount");

    const selectedPricePerNight =
        document.getElementById("selectedPricePerNight");

    const selectedTotalPrice =
        document.getElementById("selectedTotalPrice");

    const continueBooking =
        document.getElementById("continueBooking");


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

    const showSwal = (options) => {
        if (window.Swal) {
            return window.Swal.fire(options);
        }

        const message = typeof options === "string"
            ? options
            : (options.text || "Action required.");

        alert(message);
    };


    /*
     * ==========================================
     * STATE
     * ==========================================
     */

    let availableRooms = [];

    let selectedRoomIds = [];

    let currentSearch = null;


    /*
     * ==========================================
     * CHECK AVAILABILITY
     * ==========================================
     */

    checkAvailabilityButton.addEventListener(
        "click",
        async () => {

            const checkIn =
                document.getElementById("checkIn").value;

            const checkOut =
                document.getElementById("checkOut").value;

            const adults =
                Number(
                    document.getElementById("adultCount").textContent
                );

            const children =
                Number(
                    document.getElementById("childCount").textContent
                );


            /*
             * Validate dates
             */

            if (!checkIn || !checkOut) {

                showSwal({
                    icon: "warning",
                    title: "Missing dates",
                    text: "Please select your check-in and check-out dates."
                });

                return;

            }


            /*
             * Validate adults
             */

            if (adults < 1) {

                showSwal({
                    icon: "warning",
                    title: "Guest required",
                    text: "At least one adult is required."
                });

                return;

            }


            /*
             * Save current search
             */

            currentSearch = {

                checkIn,

                checkOut,

                adults,

                children

            };


            /*
             * Loading state
             */

            checkAvailabilityButton.disabled =
                true;

            checkAvailabilityButton.textContent =
                "Checking Availability...";


            try {

                const response =
                    await fetch(
                        `${API_BASE_URL}/api/availability`,
                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    currentSearch
                                )

                        }
                    );


                const data =
                    await response.json();


                /*
                 * API error
                 */

                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        "Unable to check availability."
                    );

                }


                /*
                 * Save available rooms
                 */

                availableRooms =
                    data.rooms || [];


                /*
                 * Reset previous selection
                 */

                selectedRoomIds = [];


                /*
                 * Render available rooms
                 */

                renderRooms();


                /*
                 * Show availability section
                 */

                availabilitySection.style.display =
                    "block";

                if (window.bookingWizard) {
                    window.bookingWizard.showStep(2);
                }


                /*
                 * Update availability summary
                 */

                availabilitySummary.textContent =
                    `${data.dates.nights} ${
                        data.dates.nights === 1
                            ? "night"
                            : "nights"
                    } · ${
                        data.guests.adults
                    } ${
                        data.guests.adults === 1
                            ? "adult"
                            : "adults"
                    }${
                        data.guests.children > 0
                            ? ` · ${
                                data.guests.children
                            } ${
                                data.guests.children === 1
                                    ? "child"
                                    : "children"
                            }`
                            : ""
                    }`;


                /*
                 * Reset selection summary
                 */

                updateSelectionSummary();


                /*
                 * Scroll to rooms
                 */

                availabilitySection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

            catch (error) {

                console.error(
                    "Availability error:",
                    error
                );


                showSwal({
                    icon: "error",
                    title: "Availability issue",
                    text: error.message || "Unable to check availability."
                });

            }

            finally {

                checkAvailabilityButton.disabled =
                    false;

                checkAvailabilityButton.textContent =
                    "Check Availability";

            }

        }
    );


    /*
     * ==========================================
     * RENDER ROOMS
     * ==========================================
     */

    function renderRooms() {

        privateRoomsList.innerHTML = "";

        dormRoomsList.innerHTML = "";


        const privateRooms =
            availableRooms.filter(
                room =>
                    room.room_type === "PRIVATE"
            );


        const dormBeds =
            availableRooms.filter(
                room =>
                    room.room_type === "DORM"
            );


        /*
         * Private rooms
         */

        if (privateRooms.length === 0) {

            privateRoomsList.innerHTML = `
                <p class="no-rooms">
                    No private rooms available
                    for these dates.
                </p>
            `;

        }
        else {

            privateRooms.forEach(
                room => {

                    privateRoomsList.appendChild(
                        createRoomCard(room)
                    );

                }
            );

        }


        /*
         * Dorm beds
         */

        if (dormBeds.length === 0) {

            dormRoomsList.innerHTML = `
                <p class="no-rooms">
                    No dorm beds available
                    for these dates.
                </p>
            `;

        }
        else {

            dormBeds.forEach(
                room => {

                    dormRoomsList.appendChild(
                        createRoomCard(room)
                    );

                }
            );

        }

    }


    /*
     * ==========================================
     * CREATE ROOM CARD
     * ==========================================
     */

    function createRoomCard(room) {

        const card =
            document.createElement("div");

        card.className =
            "room-selection-card";


        card.dataset.roomId =
            room.id;


        card.innerHTML = `

            <div class="room-selection-info">

                <div class="room-selection-title">
                    ${escapeHtml(room.name)}
                </div>

                <div class="room-selection-meta">

                    ${
                        room.room_type === "PRIVATE"
                            ? "Private Room"
                            : "Single Dorm Bed"
                    }

                    · Sleeps ${room.capacity}

                </div>

                <div class="room-selection-price">

                    ₹${Number(
                        room.price_per_night
                    ).toLocaleString("en-IN")}

                    <span>
                        / night
                    </span>

                </div>

            </div>


            <button
                type="button"
                class="room-select-button"
            >
                Select
            </button>

        `;


        const selectButton =
            card.querySelector(
                ".room-select-button"
            );


        selectButton.addEventListener(
            "click",
            () => {

                toggleRoomSelection(
                    room.id,
                    card,
                    selectButton
                );

            }
        );


        return card;

    }


    /*
     * ==========================================
     * SELECT / DESELECT ROOM
     * ==========================================
     */

    function toggleRoomSelection(
        roomId,
        card,
        button
    ) {

        const numericRoomId =
            Number(roomId);


        const index =
            selectedRoomIds.indexOf(
                numericRoomId
            );


        if (index === -1) {

            /*
             * Select
             */

            selectedRoomIds.push(
                numericRoomId
            );


            card.classList.add(
                "selected"
            );


            button.textContent =
                "Selected";

        }
        else {

            /*
             * Deselect
             */

            selectedRoomIds.splice(
                index,
                1
            );


            card.classList.remove(
                "selected"
            );


            button.textContent =
                "Select";

        }


        updateSelectionSummary();

    }


    /*
     * ==========================================
     * UPDATE SELECTION SUMMARY
     * ==========================================
     */

    function updateSelectionSummary() {

        if (
            selectedRoomIds.length === 0
        ) {

            selectionSummary.style.display =
                "none";

            continueBooking.disabled =
                true;

            return;

        }


        selectionSummary.style.display =
            "block";


        const selectedRooms =
            availableRooms.filter(
                room =>
                    selectedRoomIds.includes(
                        Number(room.id)
                    )
            );


        const totalPerNight =
            selectedRooms.reduce(
                (
                    total,
                    room
                ) =>
                    total +
                    Number(
                        room.price_per_night
                    ),
                0
            );


        const nights =
            currentSearch
                ? calculateNights(
                    currentSearch.checkIn,
                    currentSearch.checkOut
                )
                : 0;


        const total =
            totalPerNight * nights;


        selectedRoomCount.textContent =
            selectedRoomIds.length;


        selectedPricePerNight.textContent =
            formatCurrency(
                totalPerNight
            );


        selectedTotalPrice.textContent =
            formatCurrency(
                total
            );


        continueBooking.disabled =
            false;

    }


    /*
     * ==========================================
     * CONTINUE
     *
     * ONE CLICK:
     * Validate selection
     *       ↓
     * Show Guest Details
     * ==========================================
     */

    continueBooking.addEventListener(
        "click",
        async () => {

            await validateSelection();

        }
    );


    /*
     * ==========================================
     * VALIDATE SELECTION
     * ==========================================
     */

    async function validateSelection() {

        /*
         * Make sure something is selected.
         */

        if (
            selectedRoomIds.length === 0
        ) {

            showSwal({
                icon: "warning",
                title: "No room selected",
                text: "Please select at least one room or bed."
            });

            return;

        }


        /*
         * Make sure we have a search.
         */

        if (!currentSearch) {

            showSwal({
                icon: "warning",
                title: "Check availability first",
                text: "Please check availability first."
            });

            return;

        }


        /*
         * Loading state
         */

        continueBooking.disabled =
            true;

        continueBooking.textContent =
            "Validating...";


        try {

            const payload = {

                checkIn:
                    currentSearch.checkIn,

                checkOut:
                    currentSearch.checkOut,

                adults:
                    currentSearch.adults,

                children:
                    currentSearch.children,

                roomIds:
                    selectedRoomIds

            };


            const response =
                await fetch(
                    `${API_BASE_URL}/api/validate-selection`,
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
             * Selection invalid
             */

            if (!response.ok) {

                /*
                 * Room became unavailable.
                 */

                if (
                    response.status === 409
                ) {

                    showSwal({
                        icon: "warning",
                        title: "Rooms unavailable",
                        text: "One or more selected rooms are no longer available. Please check availability again."
                    });


                    /*
                     * Re-check availability.
                     */

                    selectedRoomIds = [];

                    updateSelectionSummary();

                    checkAvailabilityButton.click();

                    return;

                }


                throw new Error(
                    data.error ||
                    "Selection could not be validated."
                );

            }


            /*
             * =====================================
             * SUCCESS
             * =====================================
             */

            window.bookingSelection =
                data;


            console.log(
                "Validated selection:",
                data
            );


            /*
             * Populate guest-details review.
             */

            if (
                window.populateBookingReview
            ) {

                window.populateBookingReview(
                    data
                );

            }


            /*
             * Show guest details.
             */

            const guestDetailsSection =
                document.getElementById(
                    "guestDetailsSection"
                );


            if (guestDetailsSection) {

                guestDetailsSection.style.display =
                    "block";

                if (window.bookingWizard) {
                    window.bookingWizard.showStep(3);
                }

                guestDetailsSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

        }

        catch (error) {

            console.error(
                "Selection validation error:",
                error
            );


            showSwal({
                icon: "error",
                title: "Validation failed",
                text: error.message || "Unable to validate selection."
            });

        }

        finally {

            continueBooking.disabled =
                false;

            continueBooking.textContent =
                "Continue";

        }

    }


    /*
     * ==========================================
     * HELPERS
     * ==========================================
     */

    function calculateNights(
        checkIn,
        checkOut
    ) {

        const start =
            new Date(checkIn);

        const end =
            new Date(checkOut);


        return Math.round(
            (
                end.getTime() -
                start.getTime()
            ) /
            (1000 * 60 * 60 * 24)
        );

    }


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


    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value;

        return div.innerHTML;

    }

});