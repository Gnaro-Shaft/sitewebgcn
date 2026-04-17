const express = require('express');
const router = express.Router();
const { getTrades, getOpenTrades, getPerformance, getSignals } = require('../controllers/tradingController');
const { protect } = require('../middleware/auth');

// All trading routes are protected
router.get('/trades', protect, getTrades);
router.get('/trades/open', protect, getOpenTrades);
router.get('/performance', protect, getPerformance);
router.get('/signals', protect, getSignals);

module.exports = router;
