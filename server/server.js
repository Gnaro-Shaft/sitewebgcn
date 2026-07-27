// Production entry point — wires the Express app to DB + HTTP listener.
require('dotenv').config({ override: true });
const connectDB = require('./config/db');
const { connectBotDB } = require('./config/botDb');
const app = require('./app');

// Connect to MongoDB (both clusters)
connectDB();
connectBotDB();

// Fly.io expects port 8080 (configured in fly.toml)
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
