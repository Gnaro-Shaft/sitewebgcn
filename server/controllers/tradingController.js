const { getBotConnection } = require('../config/botDb');

const HL_WALLET = process.env.HL_WALLET;

// Fetch real positions from Hyperliquid API
async function getHyperliquidPositions() {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: HL_WALLET }),
    });
    const data = await res.json();
    return data.assetPositions || [];
  } catch {
    return [];
  }
}

// GET /api/trading/trades — recent trades
exports.getTrades = async (req, res) => {
  const conn = getBotConnection();
  if (!conn) {
    return res.status(503).json({ success: false, error: 'Bot database unavailable' });
  }

  const limit = parseInt(req.query.limit) || 50;
  const trades = await conn.collection('trades')
    .find({})
    .sort({ datetime: -1 })
    .limit(limit)
    .toArray();

  res.json({ success: true, count: trades.length, data: trades });
};

// GET /api/trading/trades/open — currently open positions (cross-checked with Hyperliquid)
exports.getOpenTrades = async (req, res) => {
  // Source of truth: Hyperliquid API (real positions on exchange)
  const hlPositions = await getHyperliquidPositions();

  // Map HL positions to a cleaner format
  const openPositions = hlPositions
    .filter((p) => p.position && parseFloat(p.position.szi) !== 0)
    .map((p) => {
      const pos = p.position;
      const size = parseFloat(pos.szi);
      return {
        pair: `${pos.coin}/USDC:USDC`,
        coin: pos.coin,
        side: size > 0 ? 'long' : 'short',
        size: Math.abs(size),
        entry_price: parseFloat(pos.entryPx),
        liquidation_price: parseFloat(pos.liquidationPx) || null,
        unrealized_pnl: parseFloat(pos.unrealizedPnl),
        margin_used: parseFloat(pos.marginUsed),
        leverage: pos.leverage ? pos.leverage.value : null,
      };
    });

  res.json({ success: true, count: openPositions.length, data: openPositions });
};

// GET /api/trading/performance — stats aggregated
exports.getPerformance = async (req, res) => {
  const conn = getBotConnection();
  if (!conn) {
    return res.status(503).json({ success: false, error: 'Bot database unavailable' });
  }

  const days = parseInt(req.query.days) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const closedTrades = await conn.collection('trades')
    .find({ action: 'close' })
    .sort({ datetime: -1 })
    .toArray();

  // Filter by date
  const recentTrades = closedTrades.filter((t) => {
    const d = new Date(t.datetime);
    return d >= since;
  });

  const totalTrades = recentTrades.length;
  const wins = recentTrades.filter((t) => parseFloat(t.pnl) > 0);
  const losses = recentTrades.filter((t) => parseFloat(t.pnl) <= 0);

  const totalPnl = recentTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
  const grossProfit = wins.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0));

  const winrate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  // Daily PnL for chart
  const dailyPnl = {};
  for (const t of recentTrades) {
    const day = new Date(t.datetime).toISOString().slice(0, 10);
    dailyPnl[day] = (dailyPnl[day] || 0) + parseFloat(t.pnl || 0);
  }

  // Cumulative PnL
  const sortedDays = Object.keys(dailyPnl).sort();
  let cumulative = 0;
  const cumulativePnl = sortedDays.map((day) => {
    cumulative += dailyPnl[day];
    return { date: day, pnl: dailyPnl[day], cumulative };
  });

  res.json({
    success: true,
    data: {
      totalTrades,
      wins: wins.length,
      losses: losses.length,
      winrate: Math.round(winrate * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      profitFactor: profitFactor === Infinity ? 'Inf' : Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      cumulativePnl,
      days,
    },
  });
};

// Map a raw score (-9..+9) to a signal_level bucket (-2..+2)
// Used as a fallback when the bot didn't write signal_level itself.
function scoreToLevel(score) {
  if (typeof score !== 'number') return 0;
  if (score <= -4) return -2;
  if (score <= -2) return -1;
  if (score <= 1) return 0;
  if (score <= 3) return 1;
  return 2;
}

// Resolve the level from any of the possible fields (V8 bot uses signal_level,
// older versions used signal_score, very old ones only had score/raw_score)
function resolveLevel(s) {
  if (typeof s.signal_level === 'number') return s.signal_level;
  if (typeof s.signal_score === 'number') return s.signal_score;
  return scoreToLevel(s.score ?? s.raw_score);
}

// GET /api/trading/signals — recent signals
exports.getSignals = async (req, res) => {
  const conn = getBotConnection();
  if (!conn) {
    return res.status(503).json({ success: false, error: 'Bot database unavailable' });
  }

  const limit = parseInt(req.query.limit) || 50;
  const signals = await conn.collection('signals')
    .find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  // Signal distribution by level (-2..+2) + enriched with resolved fields
  const distribution = { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 };
  const enriched = signals.map((s) => {
    const level = resolveLevel(s);
    const key = String(level);
    if (distribution[key] !== undefined) {
      distribution[key]++;
    }
    return {
      ...s,
      // Expose normalized fields so the frontend doesn't have to know about
      // the bot's evolving schema.
      level,
      score: s.score ?? s.raw_score ?? 0,
    };
  });

  res.json({
    success: true,
    count: enriched.length,
    data: enriched,
    distribution,
  });
};

// Exposed for unit tests — pure functions, no DB/network
exports._scoreToLevel = scoreToLevel;
exports._resolveLevel = resolveLevel;
