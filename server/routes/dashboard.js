const express = require('express');
const router = express.Router();
const { getWidgets, updateWidgets } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/widgets', protect, getWidgets);
router.patch('/widgets', protect, updateWidgets);

module.exports = router;
