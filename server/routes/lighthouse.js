const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getLatest, refresh } = require('../controllers/lighthouseController');

const IS_TEST = process.env.NODE_ENV === 'test';

function makeLimiter(opts) {
  return IS_TEST ? (req, res, next) => next() : rateLimit(opts);
}

// /refresh: cron is supposed to fire once a week. Backstop at 1 per 30min
// in case of replay or duplicate workflow runs.
const cronLimiter = makeLimiter({
  windowMs: 30 * 60 * 1000,
  max: 1,
  message: { success: false, error: 'Refresh endpoint already called recently' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/latest', getLatest);
router.post('/refresh', cronLimiter, refresh);

module.exports = router;
