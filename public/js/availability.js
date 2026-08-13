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
     * LOCAL:
     *
     * http://localhost:3000
     *
     * Later replace this with your Vercel
     * backend URL.
     */

    const API_BASE_URL =
        "http://localhost:3000";


    /*
     * Currently available rooms returned
     * from the backend.
     */

    let availableRooms = [];


    /*
     * Selected room IDs.
     */

    let selectedRoomIds = [];


    /*
     * Current booking search.
     */

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
             * Validate dates.
             */

            if (!checkIn || !checkOut) {

                alert(
                    "Please select your check-in and check-out dates."
                );

                return;

            }


            /*
             * Validate guests.
             */

            if (adults < 1) {

                alert(
                    "At least one adult is required."
                );

                return;

            }


            /*
             * Store current search.
             */

            currentSearch = {

                checkIn,

                checkOut,

                adults,

                children

            };


            /*
             * Loading state.
             */

            checkAvailabilityButton.disabled = true;

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


                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        "Unable to check availability."
                    );

                }


                /*
                 * Store rooms.
                 */

                availableRooms =
                    data.rooms || [];


                /*
                 * Clear old selection.
                 */

                selectedRoomIds = [];


                /*
                 * Render rooms.
                 */

                renderRooms();


                /*
                 * Show availability section.
                 */

                availabilitySection.style.display =
                    "block";


                /*
                 * Update summary.
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
                 * Reset selection UI.
                 */

                updateSelectionSummary();


                /*
                 * Scroll to availability.
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


                alert(
                    error.message ||
                    "Unable to check availability."
                );

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
         * Private rooms.
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
         * Dorm beds.
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
             * Select.
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
             * Deselect.
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
     * ==========================================
     */

    continueBooking.addEventListener(
        "click",
        async () => {

            if (
                selectedRoomIds.length === 0
            ) {

                return;

            }


            await validateSelection();

        }
    );


    /*
     * ==========================================
     * VALIDATE SELECTION
     * ==========================================
     */

    async function validateSelection() {

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
                            JSON.stringify(payload)

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                /*
                 * If a room was booked between
                 * availability and selection,
                 * refresh availability.
                 */

                if (
                    response.status === 409
                ) {

                    alert(
                        "One or more selected rooms are no longer available. Please select again."
                    );

                    checkAvailabilityButton.click();

                    return;

                }


                throw new Error(
                    data.error ||
                    "Selection could not be validated."
                );

            }


            /*
             * Store validated selection.
             *
             * We'll use this in the next step
             * when creating the booking.
             */

            window.bookingSelection =
                data;


            console.log(
                "Validated selection:",
                data
            );


            alert(
                `Selection confirmed!\n\n` +
                `Total: ${formatCurrency(
                    data.pricing.totalAmount
                )}`
            );


        }

        catch (error) {

            console.error(
                "Selection validation error:",
                error
            );


            alert(
                error.message ||
                "Unable to validate selection."
            );

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