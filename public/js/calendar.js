const hiddenCheckIn = document.getElementById("checkIn");
const hiddenCheckOut = document.getElementById("checkOut");
const selectedDates = document.getElementById("selectedDates");
const totalNights = document.getElementById("totalNights");

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

if (hiddenCheckIn && hiddenCheckOut && selectedDates && totalNights) {
    new Litepicker({
        element: document.getElementById("datePickerButton"),
        singleMode: false,
        numberOfMonths: 2,
        numberOfColumns: 2,
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
    });
}