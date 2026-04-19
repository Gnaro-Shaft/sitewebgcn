const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getUsage, suggestTopics, generateArticle } = require('../controllers/aiController');
const { protect, adminOnly } = require('../middleware/auth');

// Stricter rate limit for AI endpoints (prevent runaway costs)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 generations per hour max
  message: { success: false, error: 'Too many AI requests — hourly limit reached' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/usage', protect, adminOnly, getUsage);
router.post('/suggest-topics', protect, adminOnly, aiLimiter, suggestTopics);
router.post('/generate-article', protect, adminOnly, aiLimiter, generateArticle);

module.exports = router;
