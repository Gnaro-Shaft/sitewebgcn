const express = require('express');
const router = express.Router();
const { downloadCV, getCvData, upsertCvData } = require('../controllers/cvController');
const { protect, adminOnly } = require('../middleware/auth');

// Public
router.get('/download', downloadCV);

// Admin
router.get('/data', protect, adminOnly, getCvData);
router.put('/data', protect, adminOnly, upsertCvData);

module.exports = router;
