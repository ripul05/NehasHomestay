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
});