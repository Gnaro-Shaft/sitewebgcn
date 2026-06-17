const Article = require('../models/Article');
const User = require('../models/User');
const AIUsage = require('../models/AIUsage');
// Import as namespace (not destructured) so vi.spyOn() from tests can
// replace methods at runtime. Destructured imports capture the reference
// at module load and become un-mockable.
const AIAgent = require('../services/AIAgent');
const EmailService = require('../services/EmailService');
const asyncHandler = require('../middleware/asyncHandler');
const { MODEL, MONTHLY_BUDGET, YEARLY_BUDGET } = AIAgent;

// GET /api/ai/usage — admin, current AI usage stats
exports.getUsage = asyncHandler(async (req, res) => {
  const budget = await AIAgent.checkBudget().catch((err) => ({ error: err.message }));
  const monthly = await AIUsage.getCurrent();
  const yearlySpent = await AIUsage.getYearSpending();

  res.json({
    success: true,
    data: {
      model: MODEL,
      monthlyBudget: MONTHLY_BUDGET,
      yearlyBudget: YEARLY_BUDGET,
      monthlySpent: monthly.spendingUsd,
      monthlyRemaining: Math.max(MONTHLY_BUDGET - monthly.spendingUsd, 0),
      yearlySpent,
      yearlyRemaining: Math.max(YEARLY_BUDGET - yearlySpent, 0),
      generationCount: monthly.generationCount,
      lastGeneratedAt: monthly.lastGeneratedAt,
      currentMonth: monthly.month,
      error: budget.error || null,
    },
  });
});

// POST /api/ai/suggest-topics — admin, generate topic suggestions
exports.suggestTopics = asyncHandler(async (req, res) => {
  const { count = 3 } = req.body;
  const result = await AIAgent.suggestTopics({ count });
  res.json({ success: true, data: result });
});

// POST /api/ai/generate-article — admin, generate a draft article
exports.generateArticle = asyncHandler(async (req, res) => {
  const { topic, language = 'fr', autoSave = true } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Topic is required (min 3 chars)' });
  }

  const result = await AIAgent.generateArticle({ topic: topic.trim(), language });

  let savedArticle = null;
  if (autoSave && result.article) {
    // Auto-save as draft
    const articleData = {
      title: result.article.title,
      slug: result.article.slug,
      excerpt: result.article.excerpt,
      content: result.article.content,
      tags: result.article.tags || [],
      published: false,
      author: req.user._id,
    };

    // Ensure unique slug
    let slugBase = articleData.slug;
    let slugSuffix = 0;
    while (await Article.findOne({ slug: articleData.slug })) {
      slugSuffix += 1;
      articleData.slug = `${slugBase}-${slugSuffix}`;
    }

    savedArticle = await Article.create(articleData);
  }

  res.json({
    success: true,
    data: {
      article: savedArticle || result.article,
      costUsd: result.costUsd,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      monthlySpent: result.monthlySpent,
      saved: !!savedArticle,
    },
  });
});

// POST /api/ai/auto-draft — cron-only, generate a weekly draft from GitHub activity
// Auth via X-Cron-Secret header (not JWT, no user session)
exports.autoDraft = asyncHandler(async (req, res) => {
  const provided = req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid cron secret' });
  }

  const githubUser = process.env.GITHUB_USER || 'Gnaro-Shaft';
  const result = await AIAgent.generateWeeklyDraft({
    githubUser,
    sinceDays: 7,
    language: 'fr',
  });

  if (result.skipped === 'no-recent-activity') {
    return res.json({
      success: true,
      skipped: 'no-recent-activity',
      message: 'No GitHub commits in the last 7 days — no draft generated.',
    });
  }

  if (!result.article) {
    return res.status(500).json({ success: false, error: 'No article returned by AI' });
  }

  // Find an admin user to attribute the draft to (required by Article.author)
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    return res.status(500).json({ success: false, error: 'No admin user found' });
  }

  // Ensure unique slug
  const articleData = {
    title: result.article.title,
    slug: result.article.slug,
    excerpt: result.article.excerpt,
    content: result.article.content,
    tags: result.article.tags || [],
    published: false,
    author: admin._id,
  };
  let slugBase = articleData.slug;
  let slugSuffix = 0;
  while (await Article.findOne({ slug: articleData.slug })) {
    slugSuffix += 1;
    articleData.slug = `${slugBase}-${slugSuffix}`;
  }
  const savedArticle = await Article.create(articleData);

  // Fire-and-forget email notification — don't fail the cron if SMTP is down
  EmailService.sendDraftNotification({
    article: result.article,
    activitySummary: result.activitySummary,
  }).catch((err) => {
    console.error('Failed to send draft notification email:', err.message);
  });

  res.json({
    success: true,
    data: {
      articleId: savedArticle._id,
      title: savedArticle.title,
      slug: savedArticle.slug,
      tags: savedArticle.tags,
      costUsd: result.costUsd,
      monthlySpent: result.monthlySpent,
      commitsAnalyzed: result.activitySummary.commitsAnalyzed,
      reposTouched: result.activitySummary.reposTouched,
    },
  });
});
