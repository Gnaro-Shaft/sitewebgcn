const jwt = require('jsonwebtoken');
const User = require('../models/User');
const loginLimiter = require('./loginLimiter');

// Protect middleware — JWT validation
const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authorized' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token invalid' });
  }
};

// Admin-only guard
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// Login auth middleware — rate limiting + replay attack protection
const loginAuth = (req, res, next) => {
  loginLimiter(req, res, next);
};

module.exports = { protect, adminOnly, loginAuth };
