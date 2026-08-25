function normalizeDormName(value) {
    return String(value || "").trim().toLowerCase();
}

function isDormBundleRoom(room) {
    if (!room || room.room_type !== "DORM") {
        return false;
    }

    const name = normalizeDormName(room.name);

    return (
        (/mix\s*dorm/.test(name) || /mixed\s*dorm/.test(name)) &&
        /3\s*beds?\s*to\s*book/.test(name)
    ) || (
        /whole\s*dorm/.test(name) ||
        /complete\s*dorm/.test(name)
    );
}

function isDormBedRoom(room) {
    if (!room || room.room_type !== "DORM") {
        return false;
    }

    if (isDormBundleRoom(room)) {
        return false;
    }

    const name = normalizeDormName(room.name);

    return (
        /upper\s*bunk/.test(name) ||
        /lower\s*bunk/.test(name) ||
        /single\s*bed/.test(name) ||
        /dorm\s*bed/.test(name) ||
        /bed\s*\d+/.test(name) ||
        /mix\s*dorm/.test(name) ||
        /mixed\s*dorm/.test(name)
    );
}

function getDormRelations(rooms = []) {
    const bundleRooms = rooms.filter(isDormBundleRoom);
    const bedRooms = rooms.filter(isDormBedRoom);

    return {
        bundleRooms,
        bedRooms,
        bundleIds: bundleRooms.map(room => Number(room.id)),
        bedIds: bedRooms.map(room => Number(room.id))
    };
}

function expandDormSelectionIds(roomIds = [], rooms = []) {
    const selectedSet = new Set(
        roomIds.map(id => Number(id))
    );

    const mixedDormRooms = rooms.filter(room => {
        if (!room || room.room_type !== "DORM") {
            return false;
        }

        const name = normalizeDormName(room.name);
        return name.includes("mix dorm") || name.includes("mixed dorm");
    });

    const selectedBundle = mixedDormRooms.find(room => {
        return isDormBundleRoom(room) && selectedSet.has(Number(room.id));
    });

    if (!selectedBundle) {
        return [...selectedSet];
    }

    const group = getDormGroupForRoom(selectedBundle, mixedDormRooms);

    return [...new Set([
        ...selectedSet,
        ...(group ? group.roomIds : [])
    ])];
}

function getDormGroupForRoom(room, rooms = []) {
    if (!room || room.room_type !== "DORM") {
        return null;
    }

    const name = normalizeDormName(room.name);
    if (!(name.includes("mix dorm") || name.includes("mixed dorm"))) {
        return {
            roomIds: [Number(room.id)],
            bundleIds: [],
            bedIds: []
        };
    }

    const dormRooms = rooms.filter(item => {
        if (!item || item.room_type !== "DORM") {
            return false;
        }

        const itemName = normalizeDormName(item.name);
        return itemName.includes("mix dorm") || itemName.includes("mixed dorm");
    });

    const relations = getDormRelations(dormRooms);

    return {
        roomIds: [
            ...relations.bedIds,
            ...relations.bundleIds
        ],
        bundleIds: relations.bundleIds,
        bedIds: relations.bedIds
    };
}

function getDormBundleIds(rooms = []) {
    return rooms
        .filter(item => isDormBundleRoom(item))
        .map(item => Number(item.id));
}

function getDormBedIds(rooms = []) {
    return rooms
        .filter(item => isDormBedRoom(item))
        .map(item => Number(item.id));
}

function collapseDormInventory(rooms = []) {
    const nonDormRooms = rooms.filter(room => room.room_type !== "DORM");
    const dormRooms = rooms.filter(room => room.room_type === "DORM");
    const bundleRoom = dormRooms.find(isDormBundleRoom) || null;
    const bedRooms = dormRooms.filter(isDormBedRoom);

    if (!bundleRoom) {
        return rooms;
    }

    const bundleGroup = getDormGroupForRoom(bundleRoom, dormRooms);
    const bedIds = bundleGroup ? bundleGroup.bedIds : [];
    const bundleVisible = bedIds.length >= 3;

    const visibleDormRooms = bundleVisible
        ? [...bedRooms, bundleRoom]
        : bedRooms;

    return [
        ...nonDormRooms,
        ...visibleDormRooms
    ];
}

function filterAvailableDormRooms(rooms = [], unavailableRoomIds = []) {
    const unavailableSet = new Set(
        unavailableRoomIds.map(id => Number(id))
    );

    const filtered = rooms.filter(room => {
        if (room.room_type !== "DORM") {
            return true;
        }

        if (isDormBundleRoom(room)) {
            const group = getDormGroupForRoom(room, rooms);
            const bedIds = group ? group.bedIds : [];
            return (
                bedIds.length >= 3 &&
                bedIds.every(id => !unavailableSet.has(id))
            );
        }

        return !unavailableSet.has(Number(room.id));
    });

    return collapseDormInventory(filtered);
}

function validateDormSelection(roomIds = [], rooms = []) {
    const selectedSet = new Set(
        roomIds.map(id => Number(id))
    );

    const bundleSelected = rooms
        .filter(isDormBundleRoom)
        .some(room => selectedSet.has(Number(room.id)));

    const bedSelected = rooms
        .filter(isDormBedRoom)
        .some(room => selectedSet.has(Number(room.id)));

    if (bundleSelected && bedSelected) {
        const error = new Error(
            "The mixed dorm can be booked either as the full dorm or as individual beds, not both together."
        );

        error.code = "DORM_SELECTION_CONFLICT";
        throw error;
    }

    return true;
}

module.exports = {
    isDormBundleRoom,
    isDormBedRoom,
    getDormGroupForRoom,
    expandDormSelectionIds,
    getDormBundleIds,
    getDormBedIds,
    collapseDormInventory,
    filterAvailableDormRooms,
    validateDormSelection
};
