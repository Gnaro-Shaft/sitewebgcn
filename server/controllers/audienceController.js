// Audience de gnaro.fr — relecture des agrégats du VPS (services/audienceGnaro.js).

const asyncHandler = require('../middleware/asyncHandler');
const audience = require('../services/audienceGnaro');

// GET /api/audience/resume?jours=30   (7 à 365, 30 par défaut)
const resume = asyncHandler(async (req, res) => {
  const jours = Math.min(365, Math.max(7, parseInt(req.query.jours, 10) || 30));
  const data = await audience.resume(jours);
  res.json({ success: true, data });
});

module.exports = { resume };
