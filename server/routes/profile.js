const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  recordArticleFeedback,
} = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

// All profile routes require authentication
router.use(protect);

router.get('/', getProfile);
router.patch('/', updateProfile);
router.post('/article-feedback', recordArticleFeedback);

module.exports = router;
