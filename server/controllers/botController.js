// Namespace import (not destructured) so vi.spyOn(botDb, 'getBotConnection')
// in tests intercepts at call time instead of capturing at load time.
const botDb = require('../config/botDb');
const getBotConnection = () => botDb.getBotConnection();

// GET /api/bot/status — returns the singleton heartbeat doc written every
// ~5 min by the bot's HealthMonitor. The bot upserts to _id="current" so we
// always find the latest snapshot at a stable path.
exports.getBotStatus = async (req, res) => {
  const conn = getBotConnection();
  if (!conn) {
    return res.status(503).json({ success: false, error: 'Bot database unavailable' });
  }

  const doc = await conn.collection('bot_status').findOne({ _id: 'current' });

  if (!doc) {
    // No heartbeat written yet — the bot is either fresh-installed or
    // never ran. Tell the frontend explicitly so the widget can show
    // "no data yet" rather than treating it as an outage.
    return res.status(200).json({
      success: true,
      data: null,
      reason: 'NO_HEARTBEAT_YET',
    });
  }

  // Derive a "fresh" boolean — bot writes every 5 min, so anything older
  // than 10 min is suspect and the widget should show a warning pill.
  // Use updatedAt if Mongoose-style timestamps were on, else fall back.
  const updatedAt = doc.updatedAt || doc.updated_at || doc.timestamp;
  const ageMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : null;
  const fresh = ageMs != null && ageMs < 10 * 60 * 1000;

  res.json({
    success: true,
    data: { ...doc, _ageMs: ageMs, _fresh: fresh },
  });
};
