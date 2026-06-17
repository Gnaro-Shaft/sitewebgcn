const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getUsage, suggestTopics, generateArticle, autoDraft } = require('../controllers/aiController');
const { protect, adminOnly } = require('../middleware/auth');

const IS_TEST = process.env.NODE_ENV === 'test';

// Mirror of app.js's makeLimiter — in tests we don't want rate-limits to
// interfere with rapid request bursts from supertest. Real prod behavior
// is the canonical config below.
function makeLimiter(opts) {
  return IS_TEST ? (req, res, next) => next() : rateLimit(opts);
}

// Stricter rate limit for AI endpoints (prevent runaway costs)
const aiLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 generations per hour max
  message: { success: false, error: 'Too many AI requests — hourly limit reached' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Even stricter limit for the cron endpoint: max 1 call per 30 min.
// Cron is supposed to fire once a week, this is a sanity backstop in case
// someone replays the request or the workflow runs twice.
const cronLimiter = makeLimiter({
  windowMs: 30 * 60 * 1000,
  max: 1,
  message: { success: false, error: 'Cron endpoint already called recently' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/usage', protect, adminOnly, getUsage);
router.post('/suggest-topics', protect, adminOnly, aiLimiter, suggestTopics);
router.post('/generate-article', protect, adminOnly, aiLimiter, generateArticle);
// No JWT — auth by X-Cron-Secret header inside the controller
router.post('/auto-draft', cronLimiter, autoDraft);

module.exports = router;
