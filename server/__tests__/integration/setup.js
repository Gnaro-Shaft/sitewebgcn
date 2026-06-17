// Shared setup for integration tests:
//   - Spins up an in-memory MongoDB (MongoDB Memory Server)
//   - Connects Mongoose to it
//   - Provides the Express `app` ready for supertest (no listen())
//   - Cleans collections between tests so they're independent
//   - Stops everything cleanly after the suite
//
// Why in-memory: tests run in <1s, no port collision with the dev server,
// no real Atlas credentials needed in CI, no orphan data to clean up.

// CRITICAL: set NODE_ENV before requiring app. app.js gates dotenv on this,
// and rate limiters check NODE_ENV at module load time.
process.env.NODE_ENV = 'test';
// Make all secrets present and benign so env-dependent code doesn't crash
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-' + 'x'.repeat(40);
process.env.JWT_EXPIRE = '15m';
process.env.AI_MONTHLY_BUDGET_USD = '5';
process.env.AI_YEARLY_BUDGET_USD = '50';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.SITE_URL = 'http://localhost';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../app');

let mongoServer;

async function startServer() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  // Build all indexes (e.g. unique email on User) — wait for them to be ready
  // before tests so the first inserts don't race the index creation.
  await Promise.all(
    Object.values(mongoose.connection.models).map((m) => m.syncIndexes())
  );
}

async function stopServer() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function cleanCollections() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { app, startServer, stopServer, cleanCollections };
