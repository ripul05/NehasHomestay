const db = require("./connection");

/**
 * Get all active rooms
 */
async function getAllRooms() {

    const query = `
        SELECT *
        FROM rooms
        WHERE active = TRUE
        ORDER BY id;
    `;

    const { rows } = await db.query(query);

    return rows;
}

/**
 * Get room by id
 */
async function getRoomById(id) {

    const query = `
        SELECT *
        FROM rooms
        WHERE id = $1
        LIMIT 1;
    `;

    const { rows } = await db.query(query, [id]);

    return rows[0] || null;
}

/**
 * Get room by room code
 */
async function getRoomByCode(code) {

    const query = `
        SELECT *
        FROM rooms
        WHERE code = $1
        LIMIT 1;
    `;

    const { rows } = await db.query(query, [code]);

    return rows[0] || null;
}

/**
 * Get all private rooms
 */
async function getPrivateRooms() {

    const query = `
        SELECT *
        FROM rooms
        WHERE room_type = 'PRIVATE'
        AND active = TRUE
        ORDER BY id;
    `;

    const { rows } = await db.query(query);

    return rows;
}

/**
 * Get all dorm beds
 */
async function getDormBeds() {

    const query = `
        SELECT *
        FROM rooms
        WHERE room_type = 'DORM'
        AND active = TRUE
        ORDER BY id;
    `;

    const { rows } = await db.query(query);

    return rows;
}

module.exports = {

    getAllRooms,

    getRoomById,

    getRoomByCode,

    getPrivateRooms,

    getDormBeds

};