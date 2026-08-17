BEGIN;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS booking_access_token_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_razorpay_order_id_unique
    ON bookings (razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_razorpay_payment_id_unique
    ON bookings (razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_pending_expiry_idx
    ON bookings (reservation_expires_at)
    WHERE booking_status = 'PENDING';

CREATE INDEX IF NOT EXISTS booking_rooms_room_id_idx
    ON booking_rooms (room_id);

COMMIT;
