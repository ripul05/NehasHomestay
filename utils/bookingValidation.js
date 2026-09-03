const PROPERTY_TIME_ZONE = process.env.PROPERTY_TIME_ZONE || "Asia/Kolkata";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME = /^[\p{L}][\p{L}\p{M}\s.'-]{0,148}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[1-9]\d{7,14}$/;

function propertyToday() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: PROPERTY_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(
        parts.filter(part => part.type !== "literal").map(part => [part.type, part.value])
    );
    return `${values.year}-${values.month}-${values.day}`;
}

function parseIsoDate(value) {
    if (typeof value !== "string" || !ISO_DATE.test(value)) return null;

    const [year, month, day] = value.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return value;
}

function validateStayDates(checkIn, checkOut) {
    const start = parseIsoDate(checkIn);
    const end = parseIsoDate(checkOut);

    if (!start || !end) return { error: "Dates must use YYYY-MM-DD format." };
    if (checkIn < propertyToday()) return { error: "Check-in cannot be in the past." };
    if (start >= end) return { error: "Check-out must be after check-in." };
    return { checkIn, checkOut, start, end };
}

function validateGuestDetails({ guestName, email, phone }) {
    const name = typeof guestName === "string" ? guestName.trim().replace(/\s+/g, " ") : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim().replace(/[\s()-]/g, "") : "";

    if (!NAME.test(name)) return { error: "Please enter a valid full name." };
    if (normalizedEmail.length > 150 || !EMAIL.test(normalizedEmail)) {
        return { error: "Please enter a valid email address." };
    }
    if (!PHONE.test(normalizedPhone)) return { error: "Please enter a valid phone number." };

    return { guestName: name, email: normalizedEmail, phone: normalizedPhone };
}

module.exports = { validateStayDates, validateGuestDetails };
