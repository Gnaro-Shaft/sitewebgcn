const express = require('express');
const router = express.Router();
const {
  getAccounts,
  getAuthUrl,
  connectAccount,
  getProfile,
  getVideos,
  publish,
  disconnect,
} = require('../controllers/tiktokController');
const { protect } = require('../middleware/auth');
const multer = require('multer');

// Upload vidéo en multipart/form-data (multer, en mémoire). Évite le base64
// et le conflit avec le parser express.json global (limite 10mb) de server.js.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB max
});

// Toutes les routes TikTok sont protégées par JWT
router.get('/accounts', protect, getAccounts);
router.get('/auth-url/:niche', protect, getAuthUrl);
router.post('/connect', protect, connectAccount);
router.get('/profile/:niche', protect, getProfile);
router.get('/videos/:niche', protect, getVideos);
router.post('/publish', protect, upload.single('video'), publish);
router.delete('/:niche', protect, disconnect);

module.exports = router;
