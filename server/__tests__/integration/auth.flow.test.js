// Integration test — auth flow end-to-end.
// REAL Express app, REAL Mongoose (in-memory MongoDB), REAL bcrypt, REAL JWT.
// Only network calls to external services are mocked (we're testing OUR code).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

beforeAll(startServer, 30_000); // memory-server downloads MongoDB binary on first run
afterAll(stopServer);
beforeEach(cleanCollections);

describe('POST /api/auth/register', () => {
  it('creates a user, hashes password, returns a usable JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'goodpassword123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toMatch(/^eyJ/); // JWT header looks like "eyJ..."
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.password).toBeUndefined(); // never leak password
    expect(res.body.user.id).toBeTruthy();
  });

  it('rejects when validation fails (missing fields, weak password, bad email)', async () => {
    // Missing password
    let res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com' });
    expect(res.status).toBe(400);

    // Password too short (validator requires min 8)
    res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);

    // Invalid email
    res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'goodpassword' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate email at the API layer', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'goodpassword' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'differentpwd' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already/i);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: 'correctpassword' });
  });

  it('returns a token on correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^eyJ/);
    expect(res.body.user.email).toBe('login@example.com');
  });

  it('returns 401 with SAME message for wrong password (no user enumeration)', async () => {
    const wrongPwd = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'WRONG' });

    const noUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'never-registered@example.com', password: 'whatever' });

    expect(wrongPwd.status).toBe(401);
    expect(noUser.status).toBe(401);
    // Critical security property: identical response → attacker can't tell
    // if an email exists in the system.
    expect(wrongPwd.body.error).toBe(noUser.body.error);
    expect(wrongPwd.body.error).toMatch(/Invalid credentials/i);
  });
});

describe('GET /api/auth/me (protected route)', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@example.com', password: 'goodpassword' });
    token = res.body.token;
  });

  it('returns the current user with a valid bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the bearer is missing the Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', token); // no "Bearer "
    expect(res.status).toBe(401);
  });
});
