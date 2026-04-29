const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  trackPageView,
  getSummary,
  getTimeseries,
  getArticleStats,
} = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many tracking requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/track', trackLimiter, trackPageView);
router.get('/summary', protect, adminOnly, getSummary);
router.get('/timeseries', protect, adminOnly, getTimeseries);
router.get('/articles', protect, adminOnly, getArticleStats);

module.exports = router;
