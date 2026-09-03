const User = require("../models/User");
const EmailService = require("../services/EmailService");
const Article = require('../models/Article');
const asyncHandler = require('../middleware/asyncHandler');

const linkedinPost = require('../services/linkedinPost');

// Publier un article n'enfile plus rien sur LinkedIn — ni ici, ni via le
// brouillon hebdomadaire. Un post ne part que si quelqu'un a ouvert le
// composeur du tableau de bord et écrit le texte. C'est la seule barrière
// qui tienne dans le temps : tant que la publication déclenchait le post,
// la forme du post était forcément produite par une machine.
//
// X n'a jamais eu de workflow n8n (coût de l'API) : les entrées s'y
// accumulaient en `queued` sans que rien ne les traite. Le champ reste
// dans le schéma pour le jour où un workflow X existera.

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
    // L'article n'existe pas sous ce slug — peut-être un ancien slug d'avant
    // la correction de la translittération. On répond alors avec le slug
    // courant pour que le client redirige, plutôt que d'afficher un 404 sur
    // un lien déjà partagé sur LinkedIn ou indexé par Google.
    const renamed = await Article.findOne({ oldSlugs: req.params.slug, published: true })
      .select('slug');
    if (renamed) {
      return res.status(301).json({
        success: false,
        error: 'Article moved',
        movedTo: renamed.slug,
      });
    }
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

  article.published = !article.published;
  article.publishedAt = article.published ? new Date() : null;

  await article.save();

  // `social: null` en permanence — conservé dans la réponse pour ne pas
  // casser les clients qui lisent ce champ. Publier ne poste plus.
  res.json({ success: true, data: article, social: null });
});

// POST /api/articles/:id/social-publish { text, firstComment }
// Admin — enfile le post LinkedIn écrit dans le composeur du tableau de bord.
// C'est le SEUL chemin qui met un article dans la file : sans texte rédigé,
// rien ne part. Un article déjà posté n'est pas remis en file (doublon).
exports.triggerSocialPublish = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  if (!article.published) {
    return res.status(400).json({ success: false, error: 'Article must be published first' });
  }

  if (article.socialPosted?.linkedin?.status === 'posted') {
    return res.status(409).json({
      success: false,
      error: 'Article déjà posté sur LinkedIn',
    });
  }

  const { text, firstComment } = req.body || {};

  const validation = linkedinPost.validatePostText(text);
  if (!validation.ok) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const commentValidation = linkedinPost.validateFirstComment(firstComment);
  if (!commentValidation.ok) {
    return res.status(400).json({ success: false, error: commentValidation.error });
  }

  // Commentaire laissé vide → l'URL canonique nue. L'API LinkedIn refuse un
  // commentaire vide et l'article partirait en `failed`. Une URL nue, c'est
  // un lien, pas une formule qui se répète de post en post.
  const comment = typeof firstComment === 'string' && firstComment.trim()
    ? firstComment.trim()
    : linkedinPost.articleUrl(article);

  const current = article.socialPosted?.linkedin;
  article.socialPosted = article.socialPosted || {};
  article.socialPosted.linkedin = {
    ...(current?.toObject?.() || current || {}),
    status: 'queued',
    queuedAt: new Date(),
    text: text.trim(),
    firstComment: comment,
    error: undefined,
  };

  await article.save();

  res.json({
    success: true,
    data: {
      article,
      queued: { linkedin: article.socialPosted.linkedin.status },
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

  // Auto-publié sur le blog, mais PAS enfilé sur LinkedIn. C'était le seul
  // chemin où un post partait sans que personne n'ait relu ni l'article ni
  // le post. Le mail de notification reste le point d'entrée humain.
  article.published = true;
  article.publishedAt = new Date();
  await article.save();

  // Fire-and-forget email notification
  EmailService.sendDraftNotification({
    article: { title: article.title, slug: article.slug },
    activitySummary: { commitsAnalyzed: 0, reposTouched: [] },
  }).catch((err) => {
    console.error('Failed to send draft notification email:', err.message);
  });

  res.status(201).json({ success: true, data: article, social: null });
});
