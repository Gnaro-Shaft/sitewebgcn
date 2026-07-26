const User = require("../models/User");
const EmailService = require("../services/EmailService");
const Article = require('../models/Article');
const asyncHandler = require('../middleware/asyncHandler');

// Helper: mark the LinkedIn + X status for an article and return a diff of
// what changed. Callers save the article themselves. Deliberately keeps
// state changes explicit so the controller reads linearly.
function enqueueSocialPost(article) {
  const now = new Date();
  article.socialPosted = article.socialPosted || {};
  ['linkedin', 'x'].forEach((platform) => {
    const current = article.socialPosted[platform] || {};
    // Only queue if not already queued/posted — no double-queueing.
    if (current.status === 'posted') return;
    article.socialPosted[platform] = {
      ...(current.toObject?.() || current),
      status: 'queued',
      queuedAt: now,
      error: undefined,
    };
  });
}

// Approx 200 wpm reading rate. Math.max(1, …) avoids "0 min" for very
// short articles (a 1-word teaser still shows "1 min").
function calculateReadingTime(content) {
  if (!content || typeof content !== 'string') return 1;
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// Add a readingTime field to the JSON-serialized article. Optionally
// strip content (useful for list endpoints — saves bandwidth, the listing
// only needs the excerpt).
function withReadingTime(doc, { stripContent = false } = {}) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.readingTime = calculateReadingTime(obj.content);
  if (stripContent) delete obj.content;
  return obj;
}

// Exposed for unit tests
exports._calculateReadingTime = calculateReadingTime;
exports._withReadingTime = withReadingTime;

// GET /api/articles — public, only published (with pagination)
exports.getArticles = asyncHandler(async (req, res) => {
  const { tag } = req.query;
  const filter = { published: true };

  if (tag) {
    filter.tags = { $in: tag.split(',') };
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // We need `content` to compute readingTime, then strip it before sending.
  // Net bandwidth: ~6 bytes extra per article (readingTime int) vs the prior
  // shape. Trade-off: one extra projection on a small page-size collection.
  const [articles, total] = await Promise.all([
    Article.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit),
    Article.countDocuments(filter),
  ]);

  const data = articles.map((a) => withReadingTime(a, { stripContent: true }));
  res.json({ success: true, count: data.length, total, page, data });
});

// GET /api/articles/:slug — public, by slug (increments views)
exports.getArticleBySlug = asyncHandler(async (req, res) => {
  const article = await Article.findOneAndUpdate(
    { slug: req.params.slug, published: true },
    { $inc: { views: 1 } },
    { returnDocument: 'after' }
  );

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  res.json({ success: true, data: withReadingTime(article) });
});

// GET /api/articles/admin/all — admin, all articles
exports.getAllArticles = asyncHandler(async (req, res) => {
  const articles = await Article.find().sort({ createdAt: -1 });
  const data = articles.map((a) => withReadingTime(a));
  res.json({ success: true, count: data.length, data });
});

// POST /api/articles — admin, create draft
exports.createArticle = asyncHandler(async (req, res) => {
  req.body.author = req.user._id;
  const article = await Article.create(req.body);
  res.status(201).json({ success: true, data: article });
});

// PATCH /api/articles/:id — admin, update
exports.updateArticle = asyncHandler(async (req, res) => {
  const article = await Article.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  res.json({ success: true, data: article });
});

// PATCH /api/articles/:id/publish — admin, publish toggle
exports.publishArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  const wasPublished = article.published;
  article.published = !article.published;
  article.publishedAt = article.published ? new Date() : null;

  // Enqueue for social posting on FIRST publication only (not republish,
  // not unpublish). n8n on homeserv01 polls /api/social/pending every ~5 min
  // and takes over from there.
  const isFirstPublish = article.published && !wasPublished &&
    article.socialPosted?.linkedin?.status !== 'posted' &&
    article.socialPosted?.x?.status !== 'posted';

  let socialResults = null;
  if (isFirstPublish) {
    enqueueSocialPost(article);
    socialResults = { queued: true };
  }

  await article.save();
  res.json({ success: true, data: article, social: socialResults });
});

// POST /api/articles/:id/social-publish — admin, re-queue for social posting.
// Used by the admin UI's "Push to LinkedIn" button (also re-triggers failed
// articles). Flips status back to 'queued' regardless of previous state
// (except 'posted' — that stays 'posted' unless we explicitly want to re-post,
// which we don't right now).
exports.triggerSocialPublish = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  if (!article.published) {
    return res.status(400).json({ success: false, error: 'Article must be published first' });
  }

  enqueueSocialPost(article);
  await article.save();

  res.json({
    success: true,
    data: {
      article,
      queued: {
        linkedin: article.socialPosted?.linkedin?.status,
        x: article.socialPosted?.x?.status,
      },
    },
  });
});

// DELETE /api/articles/:id — admin
exports.deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findByIdAndDelete(req.params.id);

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  res.json({ success: true, data: {} });
});

// POST /api/articles/hermes-draft — cron-only, create draft from Hermes
// Auth via X-Cron-Secret header (not JWT, no user session)
exports.hermesDraft = asyncHandler(async (req, res) => {
  const provided = req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid cron secret' });
  }

  // Find an admin user to attribute the draft to
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    return res.status(500).json({ success: false, error: 'No admin user found' });
  }

  req.body.author = admin._id;
  const article = await Article.create(req.body);

  // Auto-publish and queue for LinkedIn + X posting
  article.published = true;
  article.publishedAt = new Date();
  enqueueSocialPost(article);
  await article.save();

  // Fire-and-forget email notification
  EmailService.sendDraftNotification({
    article: { title: article.title, slug: article.slug },
    activitySummary: { commitsAnalyzed: 0, reposTouched: [] },
  }).catch((err) => {
    console.error('Failed to send draft notification email:', err.message);
  });

  res.status(201).json({ success: true, data: article, social: { queued: true } });
});
