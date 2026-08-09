const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('Booking route working');
});
router.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
module.exports = router;
