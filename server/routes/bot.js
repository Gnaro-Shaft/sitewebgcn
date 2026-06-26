const express = require('express');
const router = express.Router();
const { getBotStatus } = require('../controllers/botController');
const { protect } = require('../middleware/auth');

router.get('/status', protect, getBotStatus);

module.exports = router;
