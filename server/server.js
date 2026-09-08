// Production entry point — wires the Express app to DB + HTTP listener.
require('dotenv').config({ override: true });
const connectDB = require('./config/db');
const { connectBotDB } = require('./config/botDb');
const app = require('./app');

// Connect to MongoDB (both clusters)
connectDB();
connectBotDB();

// Port 8080 par défaut. HOST permet de n'écouter que sur l'adresse locale :
// sur le VPS, Caddy est le seul à devoir joindre l'application (l'unité
// systemd fixe HOST=127.0.0.1). Sans HOST, toutes les interfaces, comme
// l'attendait Fly.
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT} [${process.env.NODE_ENV}]`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
