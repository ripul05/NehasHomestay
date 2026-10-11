const { BrevoClient } = require("@getbrevo/brevo");


const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY
});


const sender = {
    name: process.env.BREVO_SENDER_NAME,
    email: process.env.BREVO_SENDER_EMAIL
};


const adminEmail = process.env.ADMIN_EMAIL;


/*
 * ============================================================
 * CUSTOMER BOOKING CONFIRMATION
 * ============================================================
 */

async function sendCustomerBookingEmail(booking) {

    if (!booking.email) {

        console.error(
            "Customer email is missing. Booking:",
            booking.booking_reference
        );

        return null;
    }


    const guestName =
        booking.guest_name || "Guest";


    const bookingReference =
        booking.booking_reference;


    const amount =
        Number(booking.total_amount || 0).toFixed(2);


    const adults =
        booking.adults ?? 1;


    const children =
        booking.children ?? 0;


    try {

        const response =
            await brevo.transactionalEmails.sendTransacEmail({

                sender,

                to: [
                    {
                        email: booking.email,
                        name: guestName
                    }
                ],

                subject:
                    `Booking Confirmed - ${bookingReference}`,

                htmlContent: `

<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

</head>


<body style="
    margin:0;
    padding:0;
    background:#f5f5f5;
    font-family:Arial,Helvetica,sans-serif;
">


<div style="
    max-width:600px;
    margin:40px auto;
    background:#ffffff;
    padding:35px;
    border-radius:10px;
">


    <h2 style="
        margin-top:0;
        color:#222222;
    ">
        Booking Confirmed
    </h2>


    <p>
        Dear ${guestName},
    </p>


    <p>
        Thank you for your booking.
        Your payment has been successfully received
        and your reservation is confirmed.
    </p>


    <div style="
        margin:25px 0;
        padding:20px;
        background:#f7f7f7;
        border-radius:8px;
    ">


        <p>
            <strong>Booking Reference:</strong><br>
            ${bookingReference}
        </p>


        <p>
            <strong>Check-in:</strong><br>
            ${booking.check_in}
        </p>


        <p>
            <strong>Check-out:</strong><br>
            ${booking.check_out}
        </p>


        <p>
            <strong>Adults:</strong>
            ${adults}
        </p>


        <p>
            <strong>Children:</strong>
            ${children}
        </p>


        <p>
            <strong>Amount Paid:</strong><br>
            ₹${amount}
        </p>


    </div>


    <p>
        We look forward to welcoming you.
    </p>


    <p>
        Regards,<br>
        ${process.env.BREVO_SENDER_NAME}
    </p>


</div>


</body>

</html>

                `
            });


        console.log(
            "Customer booking email sent:",
            response?.messageId
        );


        return response;

    }
    catch (error) {

        console.error(
            "Customer booking email failed:",
            error
        );

        return null;
    }
}



/*
 * ============================================================
 * ADMIN BOOKING NOTIFICATION
 * ============================================================
 */

async function sendAdminBookingEmail(booking) {

    if (!adminEmail) {

        console.error(
            "ADMIN_EMAIL is not configured."
        );

        return null;
    }


    const amount =
        Number(booking.total_amount || 0).toFixed(2);


    try {

        const response =
            await brevo.transactionalEmails.sendTransacEmail({

                sender,

                to: [
                    {
                        email: adminEmail,
                        name: "Admin"
                    }
                ],

                subject:
                    `New Paid Booking - ${booking.booking_reference}`,

                htmlContent: `

<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

</head>


<body style="
    margin:0;
    padding:0;
    background:#f5f5f5;
    font-family:Arial,Helvetica,sans-serif;
">


<div style="
    max-width:600px;
    margin:40px auto;
    background:#ffffff;
    padding:35px;
    border-radius:10px;
">


    <h2 style="
        margin-top:0;
        color:#222222;
    ">
        New Paid Booking
    </h2>


    <p>
        A new booking has been successfully paid.
    </p>


    <div style="
        margin:25px 0;
        padding:20px;
        background:#f7f7f7;
        border-radius:8px;
    ">


        <p>
            <strong>Booking Reference:</strong><br>
            ${booking.booking_reference}
        </p>


        <p>
            <strong>Guest Name:</strong><br>
            ${booking.guest_name || "N/A"}
        </p>


        <p>
            <strong>Email:</strong><br>
            ${booking.email || "N/A"}
        </p>


        <p>
            <strong>Phone:</strong><br>
            ${booking.phone || "N/A"}
        </p>


        <p>
            <strong>Check-in:</strong><br>
            ${booking.check_in}
        </p>


        <p>
            <strong>Check-out:</strong><br>
            ${booking.check_out}
        </p>


        <p>
            <strong>Adults:</strong>
            ${booking.adults ?? 1}
        </p>


        <p>
            <strong>Children:</strong>
            ${booking.children ?? 0}
        </p>


        <p>
            <strong>Amount Paid:</strong><br>
            ₹${amount}
        </p>


        <p>
            <strong>Razorpay Payment ID:</strong><br>
            ${booking.razorpay_payment_id || "N/A"}
        </p>


        <p>
            <strong>Razorpay Order ID:</strong><br>
            ${booking.razorpay_order_id || "N/A"}
        </p>


    </div>


</div>


</body>

</html>

                `
            });


        console.log(
            "Admin booking email sent:",
            response?.messageId
        );


        return response;

    }
    catch (error) {

        console.error(
            "Admin booking email failed:",
            error
        );

        return null;
    }
}


module.exports = {

    sendCustomerBookingEmail,

    sendAdminBookingEmail

};