const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const asyncHandler = require('../middleware/asyncHandler');

// Refresh tokens live 7 days. Access tokens stay short (15min via JWT_EXPIRE)
// so a stolen access token has a small attack window. Refresh tokens are
// rotated on every use (each /refresh call revokes the old one and issues
// a new one) so replay is detectable.
const REFRESH_TOKEN_DAYS = 7;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

// Issue a fresh refresh token, persist its hash, return the raw token.
async function issueRefreshToken(user, req) {
  const raw = RefreshToken.generateRaw();
  await RefreshToken.create({
    tokenHash: RefreshToken.hash(raw),
    user: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    createdByIp: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
  });
  return raw;
}

function userPayload(user) {
  return { id: user._id, email: user.email, role: user.role };
}

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ success: false, error: 'Email already registered' });
  }

  const user = await User.create({ email, password });
  const accessToken = user.generateToken();
  const refreshToken = await issueRefreshToken(user, req);

  res.status(201).json({
    success: true,
    token: accessToken, // back-compat name for older clients
    accessToken,
    refreshToken,
    user: userPayload(user),
  });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const accessToken = user.generateToken();
  const refreshToken = await issueRefreshToken(user, req);

  res.json({
    success: true,
    token: accessToken, // back-compat name
    accessToken,
    refreshToken,
    user: userPayload(user),
  });
});

// POST /api/auth/refresh — exchange a refresh token for a new access+refresh pair
// Rotation: the old refresh token is revoked and a new one is issued. If
// somebody re-uses the old (revoked) refresh token, we detect replay and
// nuke ALL of that user's active sessions as a panic-button measure.
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(401).json({ success: false, error: 'Refresh token required' });
  }

  const tokenHash = RefreshToken.hash(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }

  // Replay detection: if this token was already revoked (via rotation), it
  // means it's been stolen and reused. Wipe all this user's sessions.
  if (stored.revoked) {
    await RefreshToken.updateMany(
      { user: stored.user, revoked: false },
      { $set: { revoked: true } }
    );
    return res.status(401).json({
      success: false,
      error: 'Refresh token reuse detected — all sessions invalidated',
    });
  }

  if (stored.expiresAt < new Date()) {
    return res.status(401).json({ success: false, error: 'Refresh token expired' });
  }

  const user = await User.findById(stored.user);
  if (!user) {
    return res.status(401).json({ success: false, error: 'User no longer exists' });
  }

  // Issue new pair
  const newAccessToken = user.generateToken();
  const newRefreshRaw = await issueRefreshToken(user, req);

  // Revoke the used refresh token + record its replacement (for forensics)
  stored.revoked = true;
  stored.replacedBy = RefreshToken.hash(newRefreshRaw);
  await stored.save();

  res.json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshRaw,
  });
});

// POST /api/auth/logout — revoke the refresh token so it can't be used again
exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    const tokenHash = RefreshToken.hash(refreshToken);
    await RefreshToken.updateOne({ tokenHash }, { $set: { revoked: true } });
  }
  res.json({ success: true });
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: { id: req.user._id, email: req.user.email, role: req.user.role },
  });
});
