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

function parseRange(query = {}) {
  const now = new Date();
  let since;
  let until = now;

  if (query.start && query.end) {
    const s = new Date(query.start);
    const e = new Date(query.end);
    if (!isNaN(s) && !isNaN(e) && s <= e) {
      since = s;
      until = e;
    }
  }

  if (!since) {
    const period = query.period || '7d';
    if (period === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (period === '30d') since = new Date(now - 30 * 24 * 60 * 60 * 1000);
    else if (period === 'all') since = new Date(0);
    else since = new Date(now - 7 * 24 * 60 * 60 * 1000);
  }

  const spanMs = until - since;
  const autoGranularity = spanMs <= 48 * 60 * 60 * 1000 ? 'hour' : 'day';
  const granularity = query.granularity === 'hour' || query.granularity === 'day'
    ? query.granularity
    : autoGranularity;

  return { since, until, granularity };
}

const BUCKET_FORMAT = {
  hour: '%Y-%m-%dT%H:00',
  day: '%Y-%m-%d',
};

// GET /api/analytics/summary — admin
exports.getSummary = asyncHandler(async (req, res) => {
  const { since, until, granularity } = parseRange(req.query);
  const bucketFmt = BUCKET_FORMAT[granularity];

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

  res.json({
    success: true,
    data: {
      since,
      until,
      granularity,
      totalViews,
      uniqueVisitors: uniqueAgg[0]?.total || 0,
      topPages: topPagesAgg.map((p) => ({ path: p._id, views: p.views })),
      topReferrers: topReferrersAgg.map((r) => ({ source: r._id, views: r.views })),
      deviceSplit: deviceAgg.map((d) => ({ device: d._id, views: d.views })),
      countries: countryAgg.map((c) => ({ country: c._id, views: c.views })),
      daily: dailyAgg,
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
