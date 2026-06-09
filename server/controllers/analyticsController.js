const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PageView = require('../models/PageView');
const asyncHandler = require('../middleware/asyncHandler');

const BOT_REGEX = /bot|crawl|spider|slurp|bing|duckduck|yandex|baidu|facebook|whatsapp|telegram|preview/i;

async function isAdminRequest(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role');
    return user?.role === 'admin';
  } catch {
    return false;
  }
}

function parseUserAgent(ua = '') {
  if (!ua) return { device: 'unknown', browser: '' };
  if (BOT_REGEX.test(ua)) return { device: 'bot', browser: '' };

  let device = 'desktop';
  if (/Tablet|iPad/i.test(ua)) device = 'tablet';
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device = 'mobile';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) browser = 'Safari';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';
  else browser = 'Other';

  return { device, browser };
}

function hashSession(ip, ua) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update(`${ip}|${ua}|${day}|${process.env.JWT_SECRET || 'salt'}`)
    .digest('hex')
    .slice(0, 32);
}

// POST /api/analytics/track — public
exports.trackPageView = asyncHandler(async (req, res) => {
  const { path, referrer = '', articleSlug = null } = req.body || {};

  if (!path || typeof path !== 'string' || path.length > 500) {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }

  const ua = req.headers['user-agent'] || '';
  const { device, browser } = parseUserAgent(ua);

  if (device === 'bot') {
    return res.json({ success: true, skipped: 'bot' });
  }

  if (await isAdminRequest(req)) {
    return res.json({ success: true, skipped: 'admin' });
  }

  const ip = req.ip || req.connection?.remoteAddress || '';
  const sessionId = hashSession(ip, ua);

  const country =
    req.headers['fly-client-country'] ||
    req.headers['cf-ipcountry'] ||
    '';

  await PageView.create({
    path: path.slice(0, 500),
    referrer: String(referrer).slice(0, 500),
    country: String(country).toUpperCase().slice(0, 4),
    device,
    browser,
    sessionId,
    articleSlug: articleSlug ? String(articleSlug).slice(0, 200) : null,
  });

  res.json({ success: true });
});

function startOfDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d) {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfYear(d) {
  const x = new Date(d);
  x.setUTCMonth(0, 1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// Compute current and previous range for a given period preset.
// `previous` is the equivalent range immediately before — used for delta.
function rangeForPeriod(period, now = new Date()) {
  switch (period) {
    case 'today': {
      const since = startOfDay(now);
      const prevUntil = since;
      const prevSince = new Date(prevUntil.getTime() - 24 * 60 * 60 * 1000);
      return { since, until: now, prevSince, prevUntil };
    }
    case '7d': {
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevSince = new Date(since.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { since, until: now, prevSince, prevUntil: since };
    }
    case '30d': {
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prevSince = new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { since, until: now, prevSince, prevUntil: since };
    }
    case 'month': {
      const since = startOfMonth(now);
      const prevSince = startOfMonth(new Date(since.getTime() - 1));
      return { since, until: now, prevSince, prevUntil: since };
    }
    case 'year': {
      const since = startOfYear(now);
      const prevSince = startOfYear(new Date(since.getTime() - 1));
      return { since, until: now, prevSince, prevUntil: since };
    }
    case 'all': {
      return { since: new Date(0), until: now, prevSince: null, prevUntil: null };
    }
    case '24h':
    default: {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const prevSince = new Date(since.getTime() - 24 * 60 * 60 * 1000);
      return { since, until: now, prevSince, prevUntil: since };
    }
  }
}

function autoGranularity(spanMs) {
  if (spanMs <= 48 * 60 * 60 * 1000) return 'hour';
  if (spanMs <= 90 * 24 * 60 * 60 * 1000) return 'day';
  return 'month';
}

function parseRange(query = {}) {
  const now = new Date();
  let since;
  let until = now;
  let prevSince = null;
  let prevUntil = null;

  if (query.start && query.end) {
    const s = new Date(query.start);
    const e = new Date(query.end);
    if (!isNaN(s) && !isNaN(e) && s <= e) {
      since = s;
      until = e;
      // Previous = same span immediately before
      const span = until - since;
      prevUntil = since;
      prevSince = new Date(since.getTime() - span);
    }
  }

  if (!since) {
    const period = query.period || '7d';
    const r = rangeForPeriod(period, now);
    since = r.since;
    until = r.until;
    prevSince = r.prevSince;
    prevUntil = r.prevUntil;
  }

  const spanMs = until - since;
  const valid = ['hour', 'day', 'month'];
  const granularity = valid.includes(query.granularity)
    ? query.granularity
    : autoGranularity(spanMs);

  return { since, until, granularity, prevSince, prevUntil };
}

const BUCKET_FORMAT = {
  hour: '%Y-%m-%dT%H:00',
  day: '%Y-%m-%d',
  month: '%Y-%m',
};

// Compute totals for a given range (used for both current + previous periods)
async function computeTotals(since, until) {
  const match = { createdAt: { $gte: since, $lte: until } };
  const [totalViews, uniqueAgg, mobileAgg] = await Promise.all([
    PageView.countDocuments(match),
    PageView.aggregate([
      { $match: match },
      { $group: { _id: '$sessionId' } },
      { $count: 'total' },
    ]),
    PageView.countDocuments({ ...match, device: 'mobile' }),
  ]);
  return {
    totalViews,
    uniqueVisitors: uniqueAgg[0]?.total || 0,
    mobileViews: mobileAgg,
  };
}

// Compute delta % between current and previous (rounded, capped, null-safe)
function computeDelta(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null; // null = "new" (avoid +Infinity)
  return Math.round(((current - previous) / previous) * 1000) / 10; // 1 decimal
}

// GET /api/analytics/summary — admin
exports.getSummary = asyncHandler(async (req, res) => {
  const { since, until, granularity, prevSince, prevUntil } = parseRange(req.query);
  const bucketFmt = BUCKET_FORMAT[granularity];
  const compare = req.query.compare !== 'false' && prevSince && prevUntil;

  const baseMatch = { createdAt: { $gte: since, $lte: until } };

  const [totalViews, uniqueAgg, topPagesAgg, topReferrersAgg, deviceAgg, dailyAgg, countryAgg] =
    await Promise.all([
      PageView.countDocuments(baseMatch),
      PageView.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$sessionId' } },
        { $count: 'total' },
      ]),
      PageView.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$path', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),
      PageView.aggregate([
        { $match: { ...baseMatch, referrer: { $ne: '' } } },
        {
          $group: {
            _id: {
              $arrayElemAt: [
                { $split: [{ $arrayElemAt: [{ $split: ['$referrer', '://'] }, 1] }, '/'] },
                0,
              ],
            },
            views: { $sum: 1 },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),
      PageView.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$device', views: { $sum: 1 } } },
      ]),
      PageView.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format: bucketFmt, date: '$createdAt' } },
            views: { $sum: 1 },
            sessions: { $addToSet: '$sessionId' },
          },
        },
        { $project: { bucket: '$_id', views: 1, unique: { $size: '$sessions' }, _id: 0 } },
        { $sort: { bucket: 1 } },
      ]),
      PageView.aggregate([
        { $match: { ...baseMatch, country: { $ne: '' } } },
        { $group: { _id: '$country', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),
    ]);

  const uniqueVisitors = uniqueAgg[0]?.total || 0;
  const mobileViews = deviceAgg.find((d) => d._id === 'mobile')?.views || 0;

  let comparison = null;
  if (compare) {
    const prev = await computeTotals(prevSince, prevUntil);
    comparison = {
      previous: {
        since: prevSince,
        until: prevUntil,
        totalViews: prev.totalViews,
        uniqueVisitors: prev.uniqueVisitors,
        mobileViews: prev.mobileViews,
      },
      delta: {
        totalViews: computeDelta(totalViews, prev.totalViews),
        uniqueVisitors: computeDelta(uniqueVisitors, prev.uniqueVisitors),
        mobileViews: computeDelta(mobileViews, prev.mobileViews),
      },
    };
  }

  res.json({
    success: true,
    data: {
      since,
      until,
      granularity,
      totalViews,
      uniqueVisitors,
      topPages: topPagesAgg.map((p) => ({ path: p._id, views: p.views })),
      topReferrers: topReferrersAgg.map((r) => ({ source: r._id, views: r.views })),
      deviceSplit: deviceAgg.map((d) => ({ device: d._id, views: d.views })),
      countries: countryAgg.map((c) => ({ country: c._id, views: c.views })),
      daily: dailyAgg,
      comparison,
    },
  });
});

// GET /api/analytics/timeseries — admin, one row per bucket with breakdown
exports.getTimeseries = asyncHandler(async (req, res) => {
  const { since, until, granularity } = parseRange(req.query);
  const bucketFmt = BUCKET_FORMAT[granularity];

  const data = await PageView.aggregate([
    { $match: { createdAt: { $gte: since, $lte: until } } },
    {
      $group: {
        _id: {
          bucket: { $dateToString: { format: bucketFmt, date: '$createdAt' } },
          device: '$device',
        },
        views: { $sum: 1 },
        sessions: { $addToSet: '$sessionId' },
      },
    },
    {
      $group: {
        _id: '$_id.bucket',
        views: { $sum: '$views' },
        unique: { $sum: { $size: '$sessions' } },
        devices: { $push: { device: '$_id.device', views: '$views' } },
      },
    },
    { $project: { bucket: '$_id', views: 1, unique: 1, devices: 1, _id: 0 } },
    { $sort: { bucket: 1 } },
  ]);

  const rows = data.map((row) => {
    const byDevice = Object.fromEntries(row.devices.map((d) => [d.device, d.views]));
    return {
      bucket: row.bucket,
      views: row.views,
      unique: row.unique,
      mobile: byDevice.mobile || 0,
      tablet: byDevice.tablet || 0,
      desktop: byDevice.desktop || 0,
      bot: byDevice.bot || 0,
    };
  });

  res.json({ success: true, data: { since, until, granularity, rows } });
});

// GET /api/analytics/articles — admin
exports.getArticleStats = asyncHandler(async (req, res) => {
  const { since, until } = parseRange({ ...req.query, period: req.query.period || '30d' });

  const data = await PageView.aggregate([
    { $match: { createdAt: { $gte: since, $lte: until }, articleSlug: { $ne: null } } },
    {
      $group: {
        _id: '$articleSlug',
        views: { $sum: 1 },
        unique: { $addToSet: '$sessionId' },
      },
    },
    { $project: { slug: '$_id', views: 1, unique: { $size: '$unique' }, _id: 0 } },
    { $sort: { views: -1 } },
    { $limit: 20 },
  ]);

  res.json({ success: true, data });
});

// Exposed for unit tests — pure functions, no DB/network
exports._rangeForPeriod = rangeForPeriod;
exports._parseRange = parseRange;
exports._computeDelta = computeDelta;
exports._autoGranularity = autoGranularity;
