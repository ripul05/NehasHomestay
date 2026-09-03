const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/test';

const db = require('./connection');
const selectionRepo = require('./SelectionRepo');
const bookingRepo = require('./BookingRepo');

const roomCatalog = [
  { id: 1, code: 'RM1', name: 'Private Room', room_type: 'PRIVATE', capacity: 2, max_adults: 2, max_children: 0, price_per_night: '1500.00', active: true },
  { id: 2, code: 'DM-1', name: 'Mix Dorm 3 Beds to Book', room_type: 'DORM', capacity: 3, max_adults: 3, max_children: 0, price_per_night: '600.00', active: true },
  { id: 3, code: 'DM-2', name: 'Mix Dorm Upper Bunk', room_type: 'DORM', capacity: 1, max_adults: 1, max_children: 0, price_per_night: '600.00', active: true },
  { id: 4, code: 'DM-3', name: 'Mix Dorm Lower Bunk', room_type: 'DORM', capacity: 1, max_adults: 1, max_children: 0, price_per_night: '600.00', active: true },
  { id: 5, code: 'DM-4', name: 'Mix Dorm Single Bed', room_type: 'DORM', capacity: 1, max_adults: 1, max_children: 0, price_per_night: '600.00', active: true }
];

test('selection validation should treat a blocked Airbnb room as unavailable for the selected stay', async () => {
  const originalQuery = db.query;

  try {
    db.query = async (sql, params) => {
      if (sql.includes('FROM rooms r') && sql.includes('WHERE r.active = TRUE')) {
        return { rows: roomCatalog };
      }

      if (sql.includes('FROM booking_rooms br')) {
        return { rows: [] };
      }

      if (sql.includes('FROM blocked_dates bd')) {
        return { rows: [] };
      }

      if (sql.includes('FROM external_booking_rooms ebr')) {
        return { rows: [{ room_id: 3 }] };
      }

      return { rows: [] };
    };

    const availableRooms = await selectionRepo.getSelectedRooms([2], '2025-01-10', '2025-01-12');
    assert.deepEqual(availableRooms.map(room => Number(room.id)), []);
  } finally {
    db.query = originalQuery;
  }
});

test('booking creation should fail when an Airbnb external booking overlaps a selected room', async () => {
  const originalConnect = db.connect;

  try {
    db.connect = async () => ({
      query: async (sql, params) => {
        if (sql.startsWith('BEGIN')) return { rows: [] };

        if (sql.includes("FROM rooms") && sql.includes("WHERE room_type = 'DORM'")) {
          return { rows: roomCatalog.filter(room => room.room_type === 'DORM') };
        }

        if (sql.includes('FROM rooms') && sql.includes('WHERE id = ANY')) {
          return { rows: roomCatalog.filter(room => [2].includes(room.id)) };
        }

        if (sql.includes('FROM booking_rooms br')) {
          return { rows: [] };
        }

        if (sql.includes('FROM blocked_dates')) {
          return { rows: [] };
        }

        if (sql.includes('FROM external_booking_rooms ebr')) {
          return { rows: [{ room_id: 3 }] };
        }

        if (sql.startsWith('ROLLBACK')) return { rows: [] };
        if (sql.startsWith('COMMIT')) return { rows: [] };

        return { rows: [] };
      },
      release() {}
    });

    await assert.rejects(
      () => bookingRepo.createBooking({
        bookingReference: 'BK-123',
        guestName: 'Test User',
        email: 'test@example.com',
        phone: '9999999999',
        adults: 2,
        children: 0,
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        roomIds: [2],
        bookingAccessTokenHash: 'abc123'
      }),
      { message: 'One or more selected rooms are no longer available.' }
    );
  } finally {
    db.connect = originalConnect;
  }
});

test('availability should exclude the exact Airbnb conflicting room and keep other private rooms available', async () => {
  const originalQuery = db.query;
  const originalConnect = db.connect;

  try {
    db.query = async (sql, params) => {
      if (sql.includes('FROM rooms r') && sql.includes('WHERE r.active = TRUE') && sql.includes('ORDER BY r.id')) {
        return {
          rows: [
            { id: 1, code: 'PR1', name: 'Private Room 1', room_type: 'PRIVATE', capacity: 2, max_adults: 2, max_children: 0, price_per_night: '1500.00', active: true },
            { id: 2, code: 'PR2', name: 'Private Room 2', room_type: 'PRIVATE', capacity: 2, max_adults: 2, max_children: 0, price_per_night: '1500.00', active: true }
          ]
        };
      }

      if (sql.includes('FROM rooms r') && sql.includes('WHERE r.id = ANY')) {
        return {
          rows: [
            { id: 1, code: 'PR1', name: 'Private Room 1', room_type: 'PRIVATE', capacity: 2, max_adults: 2, max_children: 0, price_per_night: '1500.00', active: true },
            { id: 2, code: 'PR2', name: 'Private Room 2', room_type: 'PRIVATE', capacity: 2, max_adults: 2, max_children: 0, price_per_night: '1500.00', active: true }
          ]
        };
      }

      if (sql.includes('FROM booking_rooms br')) {
        return { rows: [] };
      }

      if (sql.includes('FROM blocked_dates bd')) {
        return { rows: [] };
      }

      if (sql.includes('FROM external_booking_rooms ebr')) {
        return { rows: [{ room_id: 1 }] };
      }

      return { rows: [] };
    };

    db.connect = async () => ({
      query: async (sql, params) => {
        if (sql.startsWith('BEGIN')) return { rows: [] };
        if (sql.includes('FROM rooms') && sql.includes('WHERE room_type = \'DORM\'')) return { rows: [] };
        if (sql.includes('FROM rooms') && sql.includes('WHERE id = ANY')) return { rows: [{ id: 1, code: 'PR1', name: 'Private Room 1', room_type: 'PRIVATE', capacity: 2, max_adults: 2, max_children: 0, price_per_night: '1500.00', active: true }] };
        if (sql.includes('FROM booking_rooms br')) return { rows: [] };
        if (sql.includes('FROM blocked_dates')) return { rows: [] };
        if (sql.includes('FROM external_booking_rooms ebr')) return { rows: [{ room_id: 1 }] };
        if (sql.startsWith('ROLLBACK')) return { rows: [] };
        if (sql.startsWith('COMMIT')) return { rows: [] };
        return { rows: [] };
      },
      release() {}
    });

    const availability = await require('./AvailabilityRepo').getAvailability('2026-10-18', '2026-10-19', 1, 0);

    assert.equal(availability.rooms.some(room => Number(room.id) === 1), false);
    assert.equal(availability.rooms.some(room => Number(room.id) === 2), true);
    assert.equal(availability.privateRooms.available, 1);

    const selectedRooms = await selectionRepo.getSelectedRooms([1, 2], '2026-10-18', '2026-10-19');
    assert.equal(selectedRooms.some(room => Number(room.id) === 1), false);
    assert.equal(selectedRooms.some(room => Number(room.id) === 2), true);

    await assert.rejects(
      () => bookingRepo.createBooking({
        bookingReference: 'BK-456',
        guestName: 'Test User',
        email: 'test@example.com',
        phone: '9999999999',
        adults: 1,
        children: 0,
        checkIn: '2026-10-18',
        checkOut: '2026-10-19',
        roomIds: [1],
        bookingAccessTokenHash: 'abc456'
      }),
      { message: 'One or more selected rooms are no longer available.' }
    );
  } finally {
    db.query = originalQuery;
    db.connect = originalConnect;
  }
});
