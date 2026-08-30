// server.js
const app = require('./app');
const connectDB = require('./configuration/db');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Fitpro Equips server is running on http://localhost:${PORT}`);
});