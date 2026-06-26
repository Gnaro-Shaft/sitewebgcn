// Integration tests for the bot V8 observability endpoints:
//   - GET /api/trading/decisions
//   - GET /api/bot/status
//
// The bot DB itself is mocked (we don't run the real bot during tests),
// but auth + Express + middleware are real.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

// Mock the bot DB connection — getBotConnection() returns a stub with
// a collection() method we can rewire per test.
const botDbConfig = require('../../config/botDb');

// Holds the per-test stub returned by getBotConnection()
let botConnStub = null;
let getBotConnectionSpy;

beforeAll(async () => {
  await startServer();
  getBotConnectionSpy = vi
    .spyOn(botDbConfig, 'getBotConnection')
    .mockImplementation(() => botConnStub);
}, 30_000);
afterAll(async () => {
  getBotConnectionSpy?.mockRestore();
  await stopServer();
});
beforeEach(async () => {
  await cleanCollections();
  botConnStub = null;
});

async function registerAdmin() {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@example.com', password: 'adminpassword' });
  const User = require('../../models/User');
  await User.updateOne({ _id: reg.body.user.id }, { $set: { role: 'admin' } });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'adminpassword' });
  return login.body.accessToken || login.body.token;
}

// Build a collection stub that returns the given docs from find().sort().limit().toArray()
function fakeBotConn(collectionsMap) {
  return {
    collection: (name) => {
      const fixtures = collectionsMap[name] || { findOne: null, find: [] };
      return {
        // Chainable find for the decisions endpoint
        find: () => ({
          sort: () => ({
            limit: () => ({
              toArray: async () => fixtures.find || [],
            }),
          }),
        }),
        // findOne for the singleton bot_status endpoint
        findOne: async () => fixtures.findOne || null,
      };
    },
  };
}

describe('GET /api/trading/decisions', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/trading/decisions');
    expect(res.status).toBe(401);
  });

  it('returns 503 when bot DB connection is unavailable', async () => {
    botConnStub = null;
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/trading/decisions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Bot database unavailable/);
  });

  it('returns decisions with summary counts (accepted vs refused)', async () => {
    botConnStub = fakeBotConn({
      decisions: {
        find: [
          { status: 'accepted', score: 5, side: 'long' },
          { status: 'accepted', score: 4, side: 'short' },
          { status: 'refused', motif: 'risk', score: 5 },
          { status: 'refused', motif: 'circuit_breaker', score: 3 },
          { status: 'refused', motif: 'exposure', score: 4 },
        ],
      },
    });
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/trading/decisions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
    expect(res.body.summary).toEqual({ accepted: 2, refused: 3 });
  });

  it('silently ignores invalid status/motif filters (does not 400)', async () => {
    botConnStub = fakeBotConn({ decisions: { find: [] } });
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/trading/decisions?status=nonsense&motif=alsoNope')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/bot/status', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/bot/status');
    expect(res.status).toBe(401);
  });

  it('returns 503 when bot DB connection is unavailable', async () => {
    botConnStub = null;
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/bot/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('returns null data + NO_HEARTBEAT_YET reason when no heartbeat written', async () => {
    botConnStub = fakeBotConn({ bot_status: { findOne: null } });
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/bot/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(res.body.reason).toBe('NO_HEARTBEAT_YET');
  });

  it('returns heartbeat with _fresh=true when updated within 10 min', async () => {
    const recent = new Date(Date.now() - 2 * 60 * 1000); // 2 min ago
    botConnStub = fakeBotConn({
      bot_status: {
        findOne: {
          _id: 'current',
          running: true,
          ws_alive: true,
          daily_pnl: 12.5,
          kill_switch: false,
          updatedAt: recent,
        },
      },
    });
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/bot/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.running).toBe(true);
    expect(res.body.data._fresh).toBe(true);
    expect(res.body.data._ageMs).toBeGreaterThanOrEqual(0);
  });

  it('marks heartbeat as stale (_fresh=false) when older than 10 min', async () => {
    const old = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago
    botConnStub = fakeBotConn({
      bot_status: {
        findOne: {
          _id: 'current',
          running: true,
          updatedAt: old,
        },
      },
    });
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/bot/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data._fresh).toBe(false);
  });
});
