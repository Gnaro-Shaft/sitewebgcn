const express = require('express');
const router = express.Router();
const {
  getPending,
  markPosted,
  markFailed,
} = require('../controllers/socialQueueController');

// All routes are gated by X-N8N-Secret inside the controller — no
// middleware wrapper needed. n8n on homeserv01 is the only expected caller.
router.get('/pending', getPending);
router.post('/mark-posted', markPosted);
router.post('/mark-failed', markFailed);

module.exports = router;
