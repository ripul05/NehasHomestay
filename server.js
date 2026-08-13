const express = require('express');
const path = require('path');
const router = require('./routes/booking');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;
const availabilityRoutes =
  require("./routes/AvailabilityRoutes");
const bookingRoutes =
  require("./routes/BookingRoutes");


app.use("/api", availabilityRoutes);
app.use("/api", bookingRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.use(router);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
