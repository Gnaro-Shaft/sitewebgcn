const Article = require('../models/Article');
const asyncHandler = require('../middleware/asyncHandler');
// Namespace import so vi.spyOn in tests can intercept builder calls if we
// ever need it. Not strictly required today but cheap insurance.
const linkedinPost = require('../services/linkedinPost');

// Shared-secret check for all /api/social/* endpoints. The secret lives
// in env (N8N_SHARED_SECRET) and is passed as X-N8N-Secret header. Missing
// or wrong secret → 401. Same pattern as X-Cron-Secret on the auto-draft
// endpoint (Phase 16).
function checkN8nSecret(req, res) {
  const provided = req.headers['x-n8n-secret'];
  const expected = process.env.N8N_SHARED_SECRET;
  if (!expected || provided !== expected) {
    res.status(401).json({ success: false, error: 'Invalid n8n secret' });
    return false;
  }
  return true;
}

// GET /api/social/pending?platform=linkedin
// Returns the articles waiting to be posted, with the pre-built payload.
// n8n polls this on a schedule (every ~5 min).
exports.getPending = asyncHandler(async (req, res) => {
  if (!checkN8nSecret(req, res)) return;

  const platform = req.query.platform === 'x' ? 'x' : 'linkedin';
  const statusPath = `socialPosted.${platform}.status`;

  // We only surface `queued` items. `pending` (never triggered) and
  // `posted` (done) are ignored. `failed` stays visible in the admin UI
  // but isn't re-polled automatically — a manual re-trigger flips it back
  // to `queued`.
  const articles = await Article.find({
    published: true,
    [statusPath]: 'queued',
  }).sort({ [`socialPosted.${platform}.queuedAt`]: 1 }).limit(50);

  // Le texte n'est plus construit ici : il a été écrit à la main dans le
  // composeur du tableau de bord et stocké sur l'article à l'enfilement.
  // Le contrat servi à n8n est identique ({ text, firstComment }) — le
  // workflow homeserv01 n'a pas besoin d'être réimporté.
  //
  // Une entrée `queued` sans texte ne peut pas être postée : n8n enverrait
  // `null` dans le corps du post. Ça n'arrive que pour une entrée enfilée
  // avant que le texte devienne obligatoire — on la laisse en base et on ne
  // la sert pas, plutôt que de publier une coquille.
  const data = articles
    .filter((a) => a.socialPosted?.[platform]?.text)
    .map((a) => ({
      articleId: String(a._id),
      slug: a.slug,
      title: a.title,
      tags: a.tags,
      queuedAt: a.socialPosted?.[platform]?.queuedAt,
      text: a.socialPosted[platform].text,
      firstComment: a.socialPosted[platform].firstComment || null,
      url: linkedinPost.articleUrl(a),
    }));

  res.json({ success: true, count: data.length, data });
});

// POST /api/social/mark-posted { articleId, platform, postUrn, commentUrn }
// n8n calls this after a successful post + first-comment.
exports.markPosted = asyncHandler(async (req, res) => {
  if (!checkN8nSecret(req, res)) return;

  const { articleId, platform, postUrn, commentUrn } = req.body || {};
  if (!articleId || !platform) {
    return res.status(400).json({ success: false, error: 'articleId and platform required' });
  }
  if (!['linkedin', 'x'].includes(platform)) {
    return res.status(400).json({ success: false, error: 'platform must be linkedin or x' });
  }

  const article = await Article.findById(articleId);
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  // Only overwrite the platform we're marking. Preserve the other platform's
  // state and the rest of the doc.
  article.socialPosted = article.socialPosted || {};
  article.socialPosted[platform] = {
    ...(article.socialPosted[platform]?.toObject?.() || article.socialPosted[platform] || {}),
    status: 'posted',
    postedAt: new Date(),
    postUrn: postUrn || undefined,
    commentUrn: commentUrn || undefined,
    error: undefined,
  };
  await article.save();

  res.json({ success: true, data: { articleId, platform, status: 'posted' } });
});

// POST /api/social/mark-failed { articleId, platform, error }
// n8n calls this when a LinkedIn API error persists across its own retries.
// Failed articles are NOT re-polled — admin must click "Re-queue" to retry.
exports.markFailed = asyncHandler(async (req, res) => {
  if (!checkN8nSecret(req, res)) return;

  const { articleId, platform, error } = req.body || {};
  if (!articleId || !platform) {
    return res.status(400).json({ success: false, error: 'articleId and platform required' });
  }
  if (!['linkedin', 'x'].includes(platform)) {
    return res.status(400).json({ success: false, error: 'platform must be linkedin or x' });
  }

  const article = await Article.findById(articleId);
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  article.socialPosted = article.socialPosted || {};
  article.socialPosted[platform] = {
    ...(article.socialPosted[platform]?.toObject?.() || article.socialPosted[platform] || {}),
    status: 'failed',
    error: String(error || 'unknown').slice(0, 500),
  };
  await article.save();

  res.json({ success: true, data: { articleId, platform, status: 'failed' } });
});
