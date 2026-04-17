const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ success: false, error: 'Email already registered' });
  }

  const user = await User.create({ email, password });
  const token = user.generateToken();

  res.status(201).json({
    success: true,
    token,
    user: { id: user._id, email: user.email, role: user.role },
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

  const token = user.generateToken();

  res.json({
    success: true,
    token,
    user: { id: user._id, email: user.email, role: user.role },
  });
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: { id: req.user._id, email: req.user.email, role: req.user.role },
  });
});
