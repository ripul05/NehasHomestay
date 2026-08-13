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

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



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