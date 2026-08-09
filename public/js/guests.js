document.addEventListener("DOMContentLoaded", () => {
    const guestPicker = document.getElementById("guestPicker");
    const guestDropdown = document.getElementById("guestDropdown");
    const guestText = document.getElementById("guestText");
    const adultCountEl = document.getElementById("adultCount");
    const childCountEl = document.getElementById("childCount");
    const guestButtons = document.querySelectorAll(".guest-btn");

    if (!guestPicker || !guestDropdown || !guestText || !adultCountEl || !childCountEl) {
        return;
    }

    let adults = 2;
    let children = 0;

    const updateGuestSummary = () => {
        adultCountEl.textContent = adults;
        childCountEl.textContent = children;

        const totalGuests = adults + children;
        guestText.dataset.totalGuests = String(totalGuests);

        if (totalGuests === 0) {
            guestText.textContent = "Add Guests";
            return;
        }

        const adultLabel = adults === 1 ? "Adult" : "Adults";
        const childLabel = children === 1 ? "Child" : "Children";

        if (adults > 0 && children > 0) {
            guestText.textContent = `${adults} ${adultLabel}, ${children} ${childLabel}`;
        } else if (adults > 0) {
            guestText.textContent = `${adults} ${adultLabel}`;
        } else {
            guestText.textContent = `${children} ${childLabel}`;
        }
    };

    const toggleDropdown = () => {
        const isOpen = guestDropdown.style.display === "block";
        guestDropdown.style.display = isOpen ? "none" : "block";
        guestPicker.setAttribute("aria-expanded", String(!isOpen));
    };

    guestPicker.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleDropdown();
    });

    guestPicker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleDropdown();
        }
    });

    document.addEventListener("click", (event) => {
        if (!guestPicker.contains(event.target) && !guestDropdown.contains(event.target)) {
            guestDropdown.style.display = "none";
            guestPicker.setAttribute("aria-expanded", "false");
        }
    });

    guestButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            const type = button.dataset.type;
            const action = button.dataset.action;

            if (type === "adults") {
                if (action === "increase") {
                    adults += 1;
                } else if (action === "decrease" && adults > 1) {
                    adults -= 1;
                }
            }

            if (type === "children") {
                if (action === "increase") {
                    children += 1;
                } else if (action === "decrease" && children > 0) {
                    children -= 1;
                }
            }

            updateGuestSummary();
        });
    });

    updateGuestSummary();
});
