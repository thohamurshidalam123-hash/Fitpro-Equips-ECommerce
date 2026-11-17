const dotenv = require('dotenv');
dotenv.config();

// Import application and database configuration
const app = require('./app');
const connectDB = require('./configuration/db');

const PORT = process.env.PORT || 3000;

// Start the server only after connecting to MongoDB
const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Fitpro Equips server is running on http://localhost:${PORT}`);
    });
};

startServer();