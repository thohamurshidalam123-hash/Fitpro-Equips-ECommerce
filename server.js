const dotenv = require('dotenv');
dotenv.config();

// Load environment variables before importing modules that use them.
const app = require('./app');
const connectDB = require('./configuration/db');

// Connect to Database
connectDB();

const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Fitpro Equips server is running on http://localhost:${PORT}`);
});