const Article = require('../models/Article');
const asyncHandler = require('../middleware/asyncHandler');

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

  const [articles, total] = await Promise.all([
    Article.find(filter).select('-content').sort({ publishedAt: -1 }).skip(skip).limit(limit),
    Article.countDocuments(filter),
  ]);

  res.json({ success: true, count: articles.length, total, page, data: articles });
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

  res.json({ success: true, data: article });
});

// GET /api/articles/admin/all — admin, all articles
exports.getAllArticles = asyncHandler(async (req, res) => {
  const articles = await Article.find().sort({ createdAt: -1 });
  res.json({ success: true, count: articles.length, data: articles });
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

  article.published = !article.published;
  article.publishedAt = article.published ? new Date() : null;
  await article.save();

  res.json({ success: true, data: article });
});

// DELETE /api/articles/:id — admin
exports.deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findByIdAndDelete(req.params.id);

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  res.json({ success: true, data: {} });
});
