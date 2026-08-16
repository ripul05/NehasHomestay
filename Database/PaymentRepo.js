const db = require("./connection");

async function getBookingForPayment(bookingId, accessTokenHash) {
    const result = await db.query(`
        SELECT id, booking_reference, total_amount, payment_status, booking_status,
               reservation_expires_at, razorpay_order_id
        FROM bookings
        WHERE id = $1
          AND booking_access_token_hash = $2
        LIMIT 1;
    `, [bookingId, accessTokenHash]);
    return result.rows[0] || null;
}

async function saveRazorpayOrderId(bookingId, razorpayOrderId) {
    const result = await db.query(`
        UPDATE bookings
        SET razorpay_order_id = $2
        WHERE id = $1
          AND razorpay_order_id IS NULL
          AND booking_status = 'PENDING'
          AND reservation_expires_at > NOW()
        RETURNING id, booking_reference, total_amount, razorpay_order_id;
    `, [bookingId, razorpayOrderId]);
    return result.rows[0] || null;
}

async function expirePendingBookings() {
    await db.query(`
        UPDATE bookings
        SET booking_status = 'EXPIRED'
        WHERE booking_status = 'PENDING'
          AND reservation_expires_at <= NOW();
    `);
}

async function getBookingByRazorpayOrderId(razorpayOrderId) {
    const result = await db.query(`
        SELECT id, booking_reference, payment_status, booking_status, razorpay_order_id
        FROM bookings
        WHERE razorpay_order_id = $1
        LIMIT 1;
    `, [razorpayOrderId]);
    return result.rows[0] || null;
}

async function markPaymentVerified({ bookingId, razorpayPaymentId, razorpaySignature }) {
    const result = await db.query(`
        UPDATE bookings
        SET razorpay_payment_id = $2,
            razorpay_signature = $3,
            payment_status = 'PAID',
            booking_status = 'CONFIRMED',
            reservation_expires_at = NULL
        WHERE id = $1
          AND payment_status <> 'PAID'
          AND booking_status = 'PENDING'
          AND reservation_expires_at > NOW()
        RETURNING id, booking_reference, total_amount, payment_status, booking_status,
                  razorpay_order_id, razorpay_payment_id;
    `, [bookingId, razorpayPaymentId, razorpaySignature]);
    return result.rows[0] || null;
}

async function markPaymentCapturedFromWebhook({ razorpayOrderId, razorpayPaymentId }) {
    const result = await db.query(`
        UPDATE bookings
        SET razorpay_payment_id = $2,
            payment_status = 'PAID',
            booking_status = 'CONFIRMED',
            reservation_expires_at = NULL
        WHERE razorpay_order_id = $1
          AND payment_status <> 'PAID'
          AND booking_status = 'PENDING'
          AND reservation_expires_at > NOW()
        RETURNING id, booking_reference, payment_status, booking_status;
    `, [razorpayOrderId, razorpayPaymentId]);
    return result.rows[0] || null;
}

module.exports = {
    getBookingForPayment,
    saveRazorpayOrderId,
    expirePendingBookings,
    getBookingByRazorpayOrderId,
    markPaymentVerified,
    markPaymentCapturedFromWebhook
};
