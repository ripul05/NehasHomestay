const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = process.env.DATABASE_URL|| 'postgresql://user:pass@localhost:5432/test';

const db = require('./connection');
const { generateAirbnbExportCalendar } = require('../services/AirbnbCalendarService');

const originalQuery = db.query;

test('valid VCALENDAR output with correct dates and no PII', async () => {
  db.query = async (sql, params) => {
    if (sql.includes('UNION ALL') || sql.includes('FROM blocked_dates bd') || sql.includes('FROM external_booking_rooms ebr')) {
      return { rows: [
        { start_date: '2026-09-10', end_date: '2026-09-12' },
        { start_date: '2026-09-15', end_date: '2026-09-17' },
        { start_date: '2026-09-18', end_date: '2026-09-20' }
      ] };
    }

    return { rows: [] };
  };

  const ics = await generateAirbnbExportCalendar(1);

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260910/);
  assert.match(ics, /DTEND;VALUE=DATE:20260912/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260915/);
  assert.match(ics, /DTEND;VALUE=DATE:20260917/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260918/);
  assert.match(ics, /DTEND;VALUE=DATE:20260920/);
  assert.doesNotMatch(ics, /guest|email|phone|payment|booking|reference/i);
  assert.match(ics, /SUMMARY:Reserved/);
});

test('Full Dorm export blocks if any of the dorm beds are unavailable', async () => {
  db.query = async (sql, params) => {
    if (sql.includes('UNION ALL') || sql.includes('FROM booking_rooms br') || sql.includes('FROM blocked_dates bd') || sql.includes('FROM external_booking_rooms ebr')) {
      return { rows: [
        { start_date: '2026-09-12', end_date: '2026-09-14' }
      ] };
    }

    return { rows: [] };
  };

  const ics = await generateAirbnbExportCalendar(2);
  assert.match(ics, /DTSTART;VALUE=DATE:20260912/);
  assert.match(ics, /DTEND;VALUE=DATE:20260914/);
});

db.query = originalQuery;
