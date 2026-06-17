const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadImageMiddleware } = require('../middleware/uploadMiddleware');
const { uploadImage } = require('../controllers/uploadController');

router.post('/image', protect, uploadImageMiddleware, uploadImage);

module.exports = router;
