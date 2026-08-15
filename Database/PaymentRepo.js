const db = require("./connection");


/*
 * Get booking information required
 * to create a Razorpay order.
 */
async function getBookingForPayment(bookingId) {

    const query = `
        SELECT
            id,
            booking_reference,
            guest_name,
            email,
            phone,
            total_amount,
            payment_status,
            booking_status,
            razorpay_order_id

        FROM bookings

        WHERE id = $1

        LIMIT 1;
    `;


    const result =
        await db.query(
            query,
            [bookingId]
        );


    return result.rows[0] || null;
}


/*
 * Save Razorpay order ID against
 * our internal booking.
 */
async function saveRazorpayOrderId(
    bookingId,
    razorpayOrderId
) {

    const query = `
        UPDATE bookings

        SET razorpay_order_id = $2

        WHERE id = $1

        RETURNING
            id,
            booking_reference,
            total_amount,
            razorpay_order_id;
    `;


    const result =
        await db.query(
            query,
            [
                bookingId,
                razorpayOrderId
            ]
        );


    return result.rows[0];

}

async function markPaymentVerified({

    bookingId,

    razorpayPaymentId,

    razorpaySignature

}) {

    const query = `
        UPDATE bookings

        SET
            razorpay_payment_id = $2,
            razorpay_signature = $3,
            payment_status = 'PAID',
            booking_status = 'CONFIRMED'

        WHERE id = $1

        RETURNING
            id,
            booking_reference,
            total_amount,
            payment_status,
            booking_status,
            razorpay_order_id,
            razorpay_payment_id;
    `;


    const result =
        await db.query(
            query,
            [
                bookingId,
                razorpayPaymentId,
                razorpaySignature
            ]
        );


    return result.rows[0];

}


module.exports = {

    getBookingForPayment,
    saveRazorpayOrderId,
    markPaymentVerified

};