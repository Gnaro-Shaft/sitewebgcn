const Article = require('../models/Article');
const AIUsage = require('../models/AIUsage');
const { generateArticle, suggestTopics, checkBudget, MODEL, MONTHLY_BUDGET, YEARLY_BUDGET } = require('../services/AIAgent');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/ai/usage — admin, current AI usage stats
exports.getUsage = asyncHandler(async (req, res) => {
  const budget = await checkBudget().catch((err) => ({ error: err.message }));
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
  const result = await suggestTopics({ count });
  res.json({ success: true, data: result });
});

// POST /api/ai/generate-article — admin, generate a draft article
exports.generateArticle = asyncHandler(async (req, res) => {
  const { topic, language = 'fr', autoSave = true } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Topic is required (min 3 chars)' });
  }

  const result = await generateArticle({ topic: topic.trim(), language });

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
