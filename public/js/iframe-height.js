(() => {
    const BOOKING_HEIGHT_TYPE = "BOOKING_HEIGHT";
    const MIN_HEIGHT = 700;
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : null;

    let lastSentHeight = null;
    let rafId = null;

    function getCurrentDocumentHeight() {
        const root = document.getElementById("bookingRoot") || document.body;
        const body = document.body;
        const docEl = document.documentElement;

        const height = Math.max(
            root.scrollHeight,
            root.offsetHeight,
            body.scrollHeight,
            body.offsetHeight,
            docEl.scrollHeight,
            docEl.offsetHeight,
            docEl.clientHeight
        );

        return Math.max(MIN_HEIGHT, Math.ceil(height + 12));
    }

    function updateParentHeight() {
        const nextHeight = getCurrentDocumentHeight();

        if (lastSentHeight !== null && Math.abs(nextHeight - lastSentHeight) < 2) {
            return;
        }

        lastSentHeight = nextHeight;

        console.log("Sending height:", nextHeight);
        if (!parentOrigin || window.parent === window) return;

        console.log("Sending height:", nextHeight);
        window.parent.postMessage({
            type: BOOKING_HEIGHT_TYPE,
            height: nextHeight
        }, parentOrigin);
    }

    function scheduleHeightUpdate() {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
            updateParentHeight();
            rafId = null;
        });
    }

    function observeDynamicChanges() {
        const trigger = () => scheduleHeightUpdate();

        window.addEventListener("load", trigger);
        window.addEventListener("resize", trigger);
        window.addEventListener("orientationchange", trigger);

        [
            document.getElementById("datePickerButton"),
            document.getElementById("guestPicker"),
            document.getElementById("guestDropdown"),
            document.getElementById("checkAvailability"),
            document.getElementById("continueBooking"),
            document.getElementById("availabilitySection"),
            document.getElementById("guestDetailsSection")
        ].forEach((element) => {
            if (!element) return;
            element.addEventListener("click", trigger);
            element.addEventListener("focusin", trigger);
            element.addEventListener("keydown", trigger);
        });

        const dynamicNodes = [
            document.getElementById("availabilitySection"),
            document.getElementById("guestDetailsSection"),
            document.getElementById("privateRoomsList"),
            document.getElementById("dormRoomsList"),
            document.getElementById("selectionSummary")
        ].filter(Boolean);

        dynamicNodes.forEach((node) => {
            const observer = new MutationObserver(() => scheduleHeightUpdate());
            observer.observe(node, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["style", "class", "hidden", "aria-hidden", "aria-expanded"]
            });
        });

        if ("ResizeObserver" in window) {
            new ResizeObserver(trigger).observe(document.getElementById("bookingRoot") || document.body);
        }
    }

    window.updateParentHeight = updateParentHeight;
    document.addEventListener("DOMContentLoaded", () => {
        observeDynamicChanges();
        scheduleHeightUpdate();
    });
})();
