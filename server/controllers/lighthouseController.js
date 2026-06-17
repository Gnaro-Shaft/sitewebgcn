const LighthouseScore = require('../models/LighthouseScore');
const asyncHandler = require('../middleware/asyncHandler');

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Categories we surface on /stack. Google's API returns more (PWA, etc.)
// but those aren't relevant for a portfolio.
const CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'];

// Fetch Lighthouse scores from Google's PageSpeed Insights API.
// Pure function — exposed for unit tests.
async function fetchPageSpeed({ url, strategy }) {
  const params = new URLSearchParams({
    url,
    strategy, // 'mobile' or 'desktop'
  });
  CATEGORIES.forEach((c) => params.append('category', c));

  if (process.env.PAGESPEED_API_KEY) {
    params.set('key', process.env.PAGESPEED_API_KEY);
  }

  const res = await fetch(`${PAGESPEED_API}?${params.toString()}`, {
    headers: { 'User-Agent': 'gcn-data-lighthouse-cron' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PageSpeed API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const cats = data.lighthouseResult?.categories || {};
  const lighthouseVersion = data.lighthouseResult?.lighthouseVersion;

  // PageSpeed returns scores as 0..1; Lighthouse UI shows them as 0..100.
  const toPct = (s) => (s == null ? null : Math.round(s * 100));

  return {
    performance: toPct(cats.performance?.score),
    seo: toPct(cats.seo?.score),
    accessibility: toPct(cats.accessibility?.score),
    bestPractices: toPct(cats['best-practices']?.score),
    lighthouseVersion,
  };
}

// GET /api/lighthouse/latest — public, returns latest score per strategy
exports.getLatest = asyncHandler(async (req, res) => {
  const url = req.query.url || process.env.SITE_URL || 'https://gcn-data.fr';

  const [mobile, desktop] = await Promise.all([
    LighthouseScore.findOne({ url, strategy: 'mobile' }).sort({ fetchedAt: -1 }),
    LighthouseScore.findOne({ url, strategy: 'desktop' }).sort({ fetchedAt: -1 }),
  ]);

  res.json({
    success: true,
    data: {
      url,
      mobile: mobile ? formatScore(mobile) : null,
      desktop: desktop ? formatScore(desktop) : null,
    },
  });
});

function formatScore(doc) {
  return {
    performance: doc.performance,
    seo: doc.seo,
    accessibility: doc.accessibility,
    bestPractices: doc.bestPractices,
    fetchedAt: doc.fetchedAt,
    lighthouseVersion: doc.lighthouseVersion,
  };
}

// POST /api/lighthouse/refresh — cron-secured, fetches new scores
exports.refresh = asyncHandler(async (req, res) => {
  const provided = req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid cron secret' });
  }

  const url = req.body?.url || process.env.SITE_URL || 'https://gcn-data.fr';
  const strategies = ['mobile', 'desktop'];

  const results = await Promise.all(
    strategies.map(async (strategy) => {
      try {
        const scores = await fetchPageSpeed({ url, strategy });
        // Skip the save if PageSpeed returned a partial result (any null
        // score) — partial data would pollute the trend.
        if (Object.values(scores).some((v) => v === null && v !== scores.lighthouseVersion)) {
          return { strategy, error: 'Partial scores returned, skipping save' };
        }
        const saved = await LighthouseScore.create({
          url,
          strategy,
          performance: scores.performance,
          seo: scores.seo,
          accessibility: scores.accessibility,
          bestPractices: scores.bestPractices,
          lighthouseVersion: scores.lighthouseVersion,
        });
        return { strategy, scores: formatScore(saved) };
      } catch (err) {
        return { strategy, error: err.message };
      }
    })
  );

  res.json({ success: true, data: { url, results } });
});

// Exposed for unit tests — pure functions, no DB/network
exports._fetchPageSpeed = fetchPageSpeed;
exports._formatScore = formatScore;
