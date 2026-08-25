INSERT INTO rooms
(
    code,
    name,
    room_type,
    capacity,
    max_adults,
    max_children,
    price_per_night
)
VALUES

(
    'ROOM1',
    'Private Room 1',
    'PRIVATE',
    2,
    2,
    1,
    1000
),

(
    'ROOM2',
    'Private Room 2',
    'PRIVATE',
    2,
    2,
    1,
    1000
),

(
    'DORM1',
    'Mix Dorm-Upper Bunk Bed 1 to Book',
    'DORM',
    1,
    1,
    0,
    750
),

(
    'DORM2',
    'Mix Dorm-Lower Bunk bed 1 to book',
    'DORM',
    1,
    1,
    0,
    750
),

(
    'DORM3',
    'NehasHomestay-Mixed Dorm-Single bed to book',
    'DORM',
    1,
    1,
    0,
    750
),

(
    'DORMBUNDLE',
    'Neha''s Homestay -Mix Dorm -3 beds to book',
    'DORM',
    3,
    3,
    0,
    2250
);