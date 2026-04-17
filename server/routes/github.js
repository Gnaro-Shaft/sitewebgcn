const router = require('express').Router();
const { getSkills } = require('../controllers/githubController');

// GET /api/github/skills — public
router.get('/skills', getSkills);

module.exports = router;
