const express = require("express");

const router = express.Router();

const roomRepo = require("./Database/RoomRepository");

router.get("/rooms", async (req, res) => {

    try {

        const rooms = await roomRepo.getAllRooms();

        res.json(rooms);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

module.exports = router;