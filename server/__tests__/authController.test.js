// Tests for the auth controller — register, login, getMe.
// Replaces User.findOne/create + RefreshToken.create directly with vi.fn()
// (vi.spyOn doesn't always work on inherited Mongoose static methods).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const auth = require('../controllers/authController');

const origUserFindOne = User.findOne;
const origUserCreate = User.create;
const origRefreshCreate = RefreshToken.create;
const origRefreshGenerateRaw = RefreshToken.generateRaw;
const origRefreshHash = RefreshToken.hash;

let findOne;
let create;
let refreshCreate;

beforeEach(() => {
  findOne = vi.fn();
  create = vi.fn();
  refreshCreate = vi.fn().mockResolvedValue({});
  User.findOne = findOne;
  User.create = create;
  RefreshToken.create = refreshCreate;
  // generateRaw and hash are pure — deterministic in tests
  RefreshToken.generateRaw = () => 'fake-refresh-token-' + 'a'.repeat(46);
  RefreshToken.hash = (raw) => 'hash-of-' + raw;
});

afterEach(() => {
  User.findOne = origUserFindOne;
  User.create = origUserCreate;
  RefreshToken.create = origRefreshCreate;
  RefreshToken.generateRaw = origRefreshGenerateRaw;
  RefreshToken.hash = origRefreshHash;
});

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function mockNext() {
  return vi.fn((err) => {
    if (err) throw err;
  });
}

describe('register', () => {
  it('returns 400 when email already exists', async () => {
    findOne.mockResolvedValue({ _id: 'existing', email: 'a@b.com' });

    const req = { body: { email: 'a@b.com', password: 'x' }, ip: '127.0.0.1', headers: {} };
    const res = mockRes();

    await auth.register(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Email already registered',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates user and returns 201 + access + refresh tokens when email is free', async () => {
    findOne.mockResolvedValue(null);
    create.mockResolvedValue({
      _id: 'newid',
      email: 'new@x.com',
      role: 'user',
      generateToken: () => 'JWT_FAKE',
    });

    const req = { body: { email: 'new@x.com', password: 'secret123' }, ip: '1.2.3.4', headers: {} };
    const res = mockRes();

    await auth.register(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.token).toBe('JWT_FAKE'); // back-compat alias
    expect(payload.accessToken).toBe('JWT_FAKE');
    expect(payload.refreshToken).toMatch(/^fake-refresh-token-/);
    expect(payload.user).toEqual({ id: 'newid', email: 'new@x.com', role: 'user' });
    expect(refreshCreate).toHaveBeenCalledTimes(1);
  });

  it('never leaks the password back in the response', async () => {
    findOne.mockResolvedValue(null);
    create.mockResolvedValue({
      _id: 'id',
      email: 'a@b.com',
      role: 'user',
      password: 'plaintext-must-stay-private',
      generateToken: () => 't',
    });

    const req = { body: { email: 'a@b.com', password: 'plaintext' }, headers: {} };
    const res = mockRes();
    await auth.register(req, res, mockNext());

    const payload = res.json.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain('plaintext-must-stay-private');
    expect(payload.user.password).toBeUndefined();
  });
});

describe('login', () => {
  function userWithSelect(returnedUser) {
    return {
      select: vi.fn().mockResolvedValue(returnedUser),
    };
  }

  it('returns 401 (Invalid credentials) when user does not exist', async () => {
    findOne.mockReturnValue(userWithSelect(null));

    const req = { body: { email: 'noone@x.com', password: 'whatever' }, headers: {} };
    const res = mockRes();
    await auth.login(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid credentials',
    });
  });

  it('returns 401 (same message) when password is wrong — no user enumeration', async () => {
    const user = {
      _id: 'id',
      email: 'a@b.com',
      role: 'user',
      comparePassword: vi.fn().mockResolvedValue(false),
      generateToken: () => 'unused',
    };
    findOne.mockReturnValue(userWithSelect(user));

    const req = { body: { email: 'a@b.com', password: 'WRONG' }, headers: {} };
    const res = mockRes();
    await auth.login(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid credentials',
    });
  });

  it('returns 200 + access + refresh + user when credentials are valid', async () => {
    const user = {
      _id: 'id1',
      email: 'admin@gcn.dev',
      role: 'admin',
      comparePassword: vi.fn().mockResolvedValue(true),
      generateToken: vi.fn().mockReturnValue('JWT_OK'),
    };
    findOne.mockReturnValue(userWithSelect(user));

    const req = { body: { email: 'admin@gcn.dev', password: 'good' }, headers: {} };
    const res = mockRes();
    await auth.login(req, res, mockNext());

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.accessToken).toBe('JWT_OK');
    expect(payload.token).toBe('JWT_OK'); // back-compat
    expect(payload.refreshToken).toMatch(/^fake-refresh-token-/);
    expect(payload.user).toEqual({ id: 'id1', email: 'admin@gcn.dev', role: 'admin' });
    expect(user.generateToken).toHaveBeenCalledTimes(1);
    expect(refreshCreate).toHaveBeenCalledTimes(1);
  });
});

describe('getMe', () => {
  it('returns the current user fields from req.user', async () => {
    const req = { user: { _id: 'meid', email: 'me@x.com', role: 'admin' } };
    const res = mockRes();
    await auth.getMe(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: { id: 'meid', email: 'me@x.com', role: 'admin' },
    });
  });
});
