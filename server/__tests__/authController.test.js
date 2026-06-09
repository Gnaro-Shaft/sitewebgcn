// Tests for the auth controller — register, login, getMe.
// Approach: replace User.findOne/create directly with our own functions
// before each test, restore after. This works regardless of whether the
// methods are own properties or inherited from Mongoose's base Model.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const User = require('../models/User');
const auth = require('../controllers/authController');

const origFindOne = User.findOne;
const origCreate = User.create;

let findOne;
let create;

beforeEach(() => {
  findOne = vi.fn();
  create = vi.fn();
  User.findOne = findOne;
  User.create = create;
});

afterEach(() => {
  User.findOne = origFindOne;
  User.create = origCreate;
});

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function mockNext() {
  return vi.fn((err) => {
    // If asyncHandler caught an error and called next(err), surface it so
    // failing tests don't just silently report "not called".
    if (err) throw err;
  });
}

describe('register', () => {
  it('returns 400 when email already exists', async () => {
    findOne.mockResolvedValue({ _id: 'existing', email: 'a@b.com' });

    const req = { body: { email: 'a@b.com', password: 'x' } };
    const res = mockRes();

    await auth.register(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Email already registered',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates user and returns 201 + token when email is free', async () => {
    findOne.mockResolvedValue(null);
    create.mockResolvedValue({
      _id: 'newid',
      email: 'new@x.com',
      role: 'user',
      generateToken: () => 'JWT_FAKE',
    });

    const req = { body: { email: 'new@x.com', password: 'secret123' } };
    const res = mockRes();

    await auth.register(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      token: 'JWT_FAKE',
      user: { id: 'newid', email: 'new@x.com', role: 'user' },
    });
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

    const req = { body: { email: 'a@b.com', password: 'plaintext' } };
    const res = mockRes();
    await auth.register(req, res, mockNext());

    const payload = res.json.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain('plaintext-must-stay-private');
    expect(payload.user.password).toBeUndefined();
  });
});

describe('login', () => {
  function userWithSelect(returnedUser) {
    // login does User.findOne(...).select('+password') — chain mock
    return {
      select: vi.fn().mockResolvedValue(returnedUser),
    };
  }

  it('returns 401 (Invalid credentials) when user does not exist', async () => {
    findOne.mockReturnValue(userWithSelect(null));

    const req = { body: { email: 'noone@x.com', password: 'whatever' } };
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

    const req = { body: { email: 'a@b.com', password: 'WRONG' } };
    const res = mockRes();
    await auth.login(req, res, mockNext());

    // Same error message as for non-existent user — key security property:
    // an attacker cannot tell which emails are registered.
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid credentials',
    });
  });

  it('returns 200 + token + user when credentials are valid', async () => {
    const user = {
      _id: 'id1',
      email: 'admin@gcn.dev',
      role: 'admin',
      comparePassword: vi.fn().mockResolvedValue(true),
      generateToken: vi.fn().mockReturnValue('JWT_OK'),
    };
    findOne.mockReturnValue(userWithSelect(user));

    const req = { body: { email: 'admin@gcn.dev', password: 'good' } };
    const res = mockRes();
    await auth.login(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      token: 'JWT_OK',
      user: { id: 'id1', email: 'admin@gcn.dev', role: 'admin' },
    });
    expect(user.generateToken).toHaveBeenCalledTimes(1);
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
