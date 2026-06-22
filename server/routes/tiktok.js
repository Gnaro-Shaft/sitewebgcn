const express = require('express');
const router = express.Router();
const {
  getAccounts,
  getAuthUrl,
  connectAccount,
  getProfile,
  getVideos,
  getCreatorInfo,
  publish,
  uploadDraft,
  disconnect,
} = require('../controllers/tiktokController');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const os = require('os');

// Upload vidéo en multipart/form-data, écrit sur DISQUE temporaire (pas en RAM).
// memoryStorage chargeait toute la vidéo en mémoire → OOM kill sur petite machine.
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB max
});

// Toutes les routes TikTok sont protégées par JWT
router.get('/accounts', protect, getAccounts);
router.get('/auth-url/:niche', protect, getAuthUrl);
router.post('/connect', protect, connectAccount);
router.get('/profile/:niche', protect, getProfile);
router.get('/videos/:niche', protect, getVideos);
router.get('/creator-info/:niche', protect, getCreatorInfo);
router.post('/publish', protect, upload.single('video'), publish);
router.post('/upload-draft', protect, upload.single('video'), uploadDraft);
router.delete('/:niche', protect, disconnect);

module.exports = router;
