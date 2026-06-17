// Vitest config — exposes two test profiles:
//
//   npm test                 → unit tests only (fast, no DB, default for CI quick feedback)
//   npm run test:integration → integration tests only (in-memory MongoDB, supertest)
//   npm run test:all         → both
//
// Selection is done via VITEST_INCLUDE env var, set by each npm script.
import { defineConfig } from 'vitest/config';

const include = process.env.VITEST_INCLUDE
  ? process.env.VITEST_INCLUDE.split(',')
  : ['server/__tests__/**/*.test.js'];

const exclude = process.env.VITEST_EXCLUDE
  ? process.env.VITEST_EXCLUDE.split(',')
  : [];

export default defineConfig({
  test: {
    include,
    exclude,
    // Integration tests share an in-memory MongoDB and need to NOT step on
    // each other. Run them sequentially in a single fork to avoid port +
    // model-registry collisions.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    // Integration tests boot mongo-memory-server (binary download on first run)
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
