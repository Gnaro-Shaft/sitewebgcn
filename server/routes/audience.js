const express = require('express');
const router = express.Router();
const { resume } = require('../controllers/audienceController');
const { protect, adminOnly } = require('../middleware/auth');

// Des agrégats sans donnée personnelle, mais l'audience d'un site commercial
// n'a pas à être publique pour autant.
router.get('/resume', protect, adminOnly, resume);

module.exports = router;
