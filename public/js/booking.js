document.addEventListener("DOMContentLoaded", () => {
    const bookingButton = document.getElementById("checkAvailability");
    const checkInInput = document.getElementById("checkIn");
    const checkOutInput = document.getElementById("checkOut");
    const guestText = document.getElementById("guestText");

    if (!bookingButton || !checkInInput || !checkOutInput) {
        return;
    }

    if (guestText) {
        guestText.dataset.totalGuests = "2";
    }

    bookingButton.addEventListener("click", () => {
        const checkIn = checkInInput.value;
        const checkOut = checkOutInput.value;
        const totalGuests = parseInt(guestText?.dataset.totalGuests || "0", 10);

        if (!checkIn || !checkOut) {
            alert("Please select your stay.");
            return;
        }

        const checkInDate = new Date(`${checkIn}T00:00:00`);
        const checkOutDate = new Date(`${checkOut}T00:00:00`);

        if (checkOutDate <= checkInDate) {
            alert("Check-out date must be after check-in date.");
            return;
        }

        if (totalGuests < 1) {
            alert("Please select at least one guest.");
            return;
        }

        console.log({
            checkIn,
            checkOut,
            guests: totalGuests
        });
    });
});