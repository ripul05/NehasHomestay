-- ==========================================
-- ROOMS
-- ==========================================

CREATE TABLE rooms (

    id SERIAL PRIMARY KEY,

    code VARCHAR(20) UNIQUE NOT NULL,

    name VARCHAR(100) NOT NULL,

    room_type VARCHAR(20) NOT NULL,

    capacity INT NOT NULL,

    max_adults INT NOT NULL,

    max_children INT DEFAULT 0,

    price_per_night DECIMAL(10,2) NOT NULL,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



-- ==========================================
-- BOOKINGS
-- ==========================================

CREATE TABLE bookings (

    id SERIAL PRIMARY KEY,

    booking_reference VARCHAR(30) UNIQUE NOT NULL,

    guest_name VARCHAR(150) NOT NULL,

    email VARCHAR(150),

    phone VARCHAR(20),

    adults INT DEFAULT 1,

    children INT DEFAULT 0,

    check_in DATE NOT NULL,

    check_out DATE NOT NULL,

    total_amount DECIMAL(10,2),

    payment_status VARCHAR(20) DEFAULT 'PENDING',

    booking_status VARCHAR(20) DEFAULT 'PENDING',

    transaction_id VARCHAR(150),

    reservation_expires_at TIMESTAMPTZ,

    booking_access_token_hash CHAR(64),

    razorpay_order_id VARCHAR(255) UNIQUE,

    razorpay_payment_id VARCHAR(255) UNIQUE,

    razorpay_signature VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE INDEX bookings_pending_expiry_idx
    ON bookings (reservation_expires_at)
    WHERE booking_status = 'PENDING';



-- ==========================================
-- BOOKING ROOMS
-- ==========================================

CREATE TABLE booking_rooms (

    id SERIAL PRIMARY KEY,

    booking_id INT NOT NULL,

    room_id INT NOT NULL,

    price_per_night DECIMAL(10,2),

    nights INT,

    CONSTRAINT fk_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)

);



-- ==========================================
-- BLOCKED DATES
-- ==========================================

CREATE TABLE blocked_dates (

    id SERIAL PRIMARY KEY,

    room_id INT NOT NULL,

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    reason TEXT,

    CONSTRAINT fk_blocked_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE CASCADE

);
-- ==========================================
-- EXTERNAL LISTINGS
-- ==========================================

CREATE TABLE external_listings (

    id SERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    external_listing_id VARCHAR(255),

    listing_name VARCHAR(255) NOT NULL,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT external_listings_platform_check
        CHECK (platform IN ('AIRBNB', 'MMT')),

    CONSTRAINT external_listings_platform_external_id_unique
        UNIQUE (platform, external_listing_id)

);


-- ==========================================
-- EXTERNAL LISTING ROOMS
-- ==========================================

CREATE TABLE external_listing_rooms (

    id SERIAL PRIMARY KEY,

    external_listing_id INT NOT NULL,

    room_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_external_listing_rooms_listing
        FOREIGN KEY (external_listing_id)
        REFERENCES external_listings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_external_listing_rooms_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id),

    CONSTRAINT external_listing_rooms_unique
        UNIQUE (external_listing_id, room_id)

);


-- ==========================================
-- CALENDAR CONNECTIONS
-- ==========================================

CREATE TABLE calendar_connections (

    id SERIAL PRIMARY KEY,

    external_listing_id INT NOT NULL,

    direction VARCHAR(20) NOT NULL,

    calendar_name VARCHAR(255),

    calendar_url TEXT NOT NULL,

    active BOOLEAN DEFAULT TRUE,

    last_synced_at TIMESTAMP,

    provider VARCHAR(30),

    connection_type VARCHAR(30),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_calendar_connections_listing
        FOREIGN KEY (external_listing_id)
        REFERENCES external_listings(id)
        ON DELETE CASCADE,

    CONSTRAINT calendar_connections_direction_check
        CHECK (direction IN ('IMPORT', 'EXPORT')),

    CONSTRAINT calendar_connections_provider_check
        CHECK (
            provider IS NULL
            OR provider IN ('AIRBNB', 'MMT', 'WEBSITE')
        ),

    CONSTRAINT calendar_connections_type_check
        CHECK (
            connection_type IS NULL
            OR connection_type IN ('ICAL', 'API', 'CHANNEL_MANAGER')
        )

);


-- ==========================================
-- EXTERNAL BOOKINGS
-- ==========================================

CREATE TABLE external_bookings (

    id SERIAL PRIMARY KEY,

    external_listing_id INT NOT NULL,

    external_event_uid VARCHAR(500) NOT NULL,

    guest_name VARCHAR(255),

    check_in DATE NOT NULL,

    check_out DATE NOT NULL,

    status VARCHAR(30) DEFAULT 'CONFIRMED',

    raw_event JSONB,

    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_external_bookings_listing
        FOREIGN KEY (external_listing_id)
        REFERENCES external_listings(id)
        ON DELETE CASCADE,

    CONSTRAINT external_bookings_status_check
        CHECK (
            status IN ('CONFIRMED', 'CANCELLED', 'BLOCKED')
        ),

    CONSTRAINT external_bookings_dates_check
        CHECK (check_out > check_in),

    CONSTRAINT external_bookings_uid_unique
        UNIQUE (external_listing_id, external_event_uid)

);


-- ==========================================
-- EXTERNAL BOOKING ROOMS
-- ==========================================

CREATE TABLE external_booking_rooms (

    id SERIAL PRIMARY KEY,

    external_booking_id INT NOT NULL,

    room_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_external_booking_rooms_booking
        FOREIGN KEY (external_booking_id)
        REFERENCES external_bookings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_external_booking_rooms_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id),

    CONSTRAINT external_booking_rooms_unique
        UNIQUE (external_booking_id, room_id)

);


-- ==========================================
-- CALENDAR SYNC LOGS
-- ==========================================

CREATE TABLE calendar_sync_logs (

    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    external_listing_id INT,

    sync_type VARCHAR(20) NOT NULL,

    status VARCHAR(20) NOT NULL,

    events_found INT DEFAULT 0,

    events_created INT DEFAULT 0,

    events_updated INT DEFAULT 0,

    events_cancelled INT DEFAULT 0,

    error_message TEXT,

    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMP,

    CONSTRAINT fk_calendar_sync_logs_listing
        FOREIGN KEY (external_listing_id)
        REFERENCES external_listings(id)
        ON DELETE SET NULL,

    CONSTRAINT calendar_sync_logs_platform_check
        CHECK (platform IN ('AIRBNB', 'MMT', 'WEBSITE')),

    CONSTRAINT calendar_sync_logs_type_check
        CHECK (sync_type IN ('IMPORT', 'EXPORT')),

    CONSTRAINT calendar_sync_logs_status_check
        CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED'))

);