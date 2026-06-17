// Integration tests for the refresh token rotation flow.
// Covers happy path, rotation/replay detection, revocation, logout.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

beforeAll(startServer, 30_000);
afterAll(stopServer);
beforeEach(cleanCollections);

async function registerUser(email = 'rt@example.com', password = 'goodpassword') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password });
  return res.body; // { accessToken, refreshToken, user, ... }
}

describe('POST /api/auth/register & login — issue access + refresh', () => {
  it('register returns BOTH accessToken and refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'goodpassword' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toMatch(/^eyJ/); // JWT
    expect(res.body.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
    // Back-compat alias for older clients still works
    expect(res.body.token).toBe(res.body.accessToken);
  });

  it('login returns BOTH tokens', async () => {
    await registerUser('login@b.com', 'goodpassword');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@b.com', password: 'goodpassword' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('persists refresh token as hash, never raw', async () => {
    const { refreshToken } = await registerUser();
    const RefreshToken = require('../../models/RefreshToken');
    const all = await RefreshToken.find({});
    expect(all).toHaveLength(1);
    // The raw token must NEVER be in the DB
    expect(all[0].tokenHash).not.toBe(refreshToken);
    // It must match its sha256 hash
    expect(all[0].tokenHash).toBe(RefreshToken.hash(refreshToken));
  });
});

describe('POST /api/auth/refresh — token rotation', () => {
  it('exchanges a valid refresh token for a new pair', async () => {
    const { refreshToken: oldRefresh } = await registerUser();

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toMatch(/^eyJ/); // valid JWT shape
    expect(res.body.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.refreshToken).not.toBe(oldRefresh); // ROTATION: new value
    // Note: access token strings can be identical if issued in the same
    // second (JWT iat is in seconds). What matters is the OLD one no longer
    // grants new sessions — that's covered by the rotation/replay tests.
  });

  it('new access token can be used to hit /me', async () => {
    const { refreshToken } = await registerUser('me@x.com');
    const { body: refreshed } = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshed.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('me@x.com');
  });

  it('old refresh token cannot be reused after rotation', async () => {
    const { refreshToken: oldRefresh } = await registerUser();

    // First use — succeeds and rotates
    await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });

    // Second use of the SAME refresh token — must fail (replay)
    const replay = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh });

    expect(replay.status).toBe(401);
    expect(replay.body.error).toMatch(/reuse/i);
  });

  it('replay detection nukes ALL of the user\'s active refresh tokens', async () => {
    // Login twice → 2 active refresh tokens
    const a = await registerUser('many@x.com', 'goodpassword');
    const b = await request(app)
      .post('/api/auth/login')
      .send({ email: 'many@x.com', password: 'goodpassword' });

    const refreshA = a.refreshToken;
    const refreshB = b.body.refreshToken;

    // Use refreshA once (rotates → revoked)
    await request(app).post('/api/auth/refresh').send({ refreshToken: refreshA });

    // Replay the (now revoked) refreshA — triggers nuke
    await request(app).post('/api/auth/refresh').send({ refreshToken: refreshA });

    // refreshB (the *other* session) should now ALSO be invalid
    const sibling = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshB });

    expect(sibling.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'a'.repeat(64) });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid/i);
  });

  it('rejects when body has no refreshToken', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/required/i);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token so it cannot be used again', async () => {
    const { refreshToken } = await registerUser();

    const logout = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    // Try to use it — should fail
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    // A revoked-then-reused token triggers the replay flow → 401
    expect(reuse.status).toBe(401);
  });

  it('is idempotent and tolerant when no body is sent', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
