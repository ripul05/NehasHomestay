const hiddenCheckIn = document.getElementById("checkIn");
const hiddenCheckOut = document.getElementById("checkOut");
const selectedDates = document.getElementById("selectedDates");
const totalNights = document.getElementById("totalNights");
const datePickerTrigger = document.getElementById("datePickerButton");

let litepickerInstance = null;
let lastMobileLayout = null;

const normalizeDate = (value) => {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (typeof value.getTime === "function") {
        return new Date(value.getTime());
    }

    return new Date(value);
};

const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const formatDateLabel = (date) => new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
}).format(date);

const isMobileCalendar = () => window.innerWidth <= 600;

const buildPickerConfig = () => {
    const mobile = isMobileCalendar();

    return {
        element: datePickerTrigger,
        singleMode: false,
        numberOfMonths: mobile ? 1 : 2,
        numberOfColumns: mobile ? 1 : 2,
        autoApply: true,
        format: "DD MMM YYYY",
        minDate: new Date(),
        setup: (picker) => {
            picker.on("selected", (start, end) => {
                const startDate = normalizeDate(start);
                let endDate = normalizeDate(end);

                if (!startDate || !endDate) {
                    return;
                }

                if (endDate <= startDate) {
                    endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                }

                hiddenCheckIn.value = formatDateInput(startDate);
                hiddenCheckOut.value = formatDateInput(endDate);

                selectedDates.innerHTML = `${formatDateLabel(startDate)} &nbsp; → &nbsp; ${formatDateLabel(endDate)}`;

                const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
                totalNights.textContent = `${nights} ${nights === 1 ? "Night" : "Nights"}`;
            });
        }
    };
};

const destroyLitepicker = () => {
    if (!litepickerInstance) {
        return;
    }

    if (typeof litepickerInstance.destroy === "function") {
        litepickerInstance.destroy();
    }

    litepickerInstance = null;
};

const initLitepicker = () => {
    if (!hiddenCheckIn || !hiddenCheckOut || !selectedDates || !totalNights || !datePickerTrigger) {
        return;
    }

    const mobile = isMobileCalendar();

    if (lastMobileLayout !== null && lastMobileLayout !== mobile) {
        destroyLitepicker();
    }

    if (litepickerInstance) {
        return;
    }

    lastMobileLayout = mobile;
    litepickerInstance = new Litepicker(buildPickerConfig());
};

if (hiddenCheckIn && hiddenCheckOut && selectedDates && totalNights && datePickerTrigger) {
    initLitepicker();

    window.addEventListener("resize", () => {
        const currentMobileLayout = isMobileCalendar();

        if (lastMobileLayout !== currentMobileLayout) {
            initLitepicker();
        }
    });
}