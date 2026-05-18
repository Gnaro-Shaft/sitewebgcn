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

// Parser JSON dédié à l'upload vidéo (base64) — limite élargie à 60mb,
// la limite globale de server.js (10mb) étant trop basse pour une vidéo.
const videoJson = express.json({ limit: '60mb' });

// Toutes les routes TikTok sont protégées par JWT
router.get('/accounts', protect, getAccounts);
router.get('/auth-url/:niche', protect, getAuthUrl);
router.post('/connect', protect, connectAccount);
router.get('/profile/:niche', protect, getProfile);
router.get('/videos/:niche', protect, getVideos);
router.post('/publish', protect, videoJson, publish);
router.delete('/:niche', protect, disconnect);

module.exports = router;
