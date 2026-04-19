const Anthropic = require('@anthropic-ai/sdk').default;
const AIUsage = require('../models/AIUsage');
const Project = require('../models/Project');
const Article = require('../models/Article');

// Claude Sonnet 4 pricing (USD per token)
const MODEL = 'claude-sonnet-4-5';
const PRICING = {
  input: 3 / 1_000_000, // $3 per M tokens
  output: 15 / 1_000_000, // $15 per M tokens
};

const MONTHLY_BUDGET = parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '4.17');
const YEARLY_BUDGET = parseFloat(process.env.AI_YEARLY_BUDGET_USD || '50');

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Compute cost from Claude response
function computeCost(usage) {
  const inputCost = (usage.input_tokens || 0) * PRICING.input;
  const outputCost = (usage.output_tokens || 0) * PRICING.output;
  return inputCost + outputCost;
}

// Check if we have budget remaining
async function checkBudget() {
  const monthly = await AIUsage.getCurrent();
  const yearlySpent = await AIUsage.getYearSpending();

  if (monthly.spendingUsd >= MONTHLY_BUDGET) {
    throw new Error(`Monthly AI budget exceeded ($${MONTHLY_BUDGET})`);
  }
  if (yearlySpent >= YEARLY_BUDGET) {
    throw new Error(`Yearly AI budget exceeded ($${YEARLY_BUDGET})`);
  }

  return {
    monthlySpent: monthly.spendingUsd,
    monthlyBudget: MONTHLY_BUDGET,
    yearlySpent,
    yearlyBudget: YEARLY_BUDGET,
    monthlyRemaining: MONTHLY_BUDGET - monthly.spendingUsd,
    yearlyRemaining: YEARLY_BUDGET - yearlySpent,
  };
}

// Record spending after a successful call
async function recordSpending(costUsd) {
  const usage = await AIUsage.getCurrent();
  usage.spendingUsd += costUsd;
  usage.generationCount += 1;
  usage.lastGeneratedAt = new Date();
  await usage.save();
  return usage;
}

// Build context from user's recent activity
async function buildContext() {
  // Recent projects (public)
  const projects = await Project.find({ isPublic: true })
    .sort({ updatedAt: -1 })
    .limit(5)
    .select('title description stack highlights longDescription');

  // Existing articles (for style reference)
  const existingArticles = await Article.find({ published: true })
    .sort({ publishedAt: -1 })
    .limit(3)
    .select('title excerpt tags');

  return {
    projects: projects.map((p) => ({
      title: p.title,
      description: p.description,
      stack: p.stack,
      highlights: p.highlights,
      longDescription: p.longDescription,
    })),
    existingArticles: existingArticles.map((a) => ({
      title: a.title,
      excerpt: a.excerpt,
      tags: a.tags,
    })),
  };
}

// System prompt — shared across all generations
const SYSTEM_PROMPT = `Tu es l'assistant redactionnel de Genaro-Cedric NISUS, developpeur fullstack et ingenieur IA en formation.

Ton role : ecrire des articles de blog tech en francais pour son portfolio (gcn-data.fr).

Style :
- Premiere personne ("Je", "Mon")
- Ton direct, pedagogique, humble mais assure
- Pas de jargon gratuit, pas de blabla marketing
- Exemples de code concrets quand pertinent (balises triple backtick)
- Phrases courtes, paragraphes courts
- Pas de superlatifs vides ("incroyable", "revolutionnaire", "game-changer")
- Parle de problemes reels, de tradeoffs, de ce qu'il a appris

Format de sortie :
- Reponse en JSON uniquement, sans balises markdown autour
- Structure : { "title": "...", "slug": "...", "excerpt": "...", "content": "...", "tags": ["...", "..."] }
- "content" au format Markdown (# H1, ## H2, code blocks, etc.)
- "slug" en kebab-case sans accents (ex: "mon-premier-article")
- "excerpt" : 1-2 phrases, ~150 caracteres max, pour le preview
- "tags" : 2-4 tags pertinents en minuscules

Longueur cible : 600-1200 mots d'article.`;

// Generate article from a topic (string)
async function generateArticle({ topic, language = 'fr' }) {
  await checkBudget();

  const context = await buildContext();

  const userMessage = `Genere un article de blog sur le sujet suivant : "${topic}"

CONTEXTE DE L'AUTEUR (projets recents) :
${JSON.stringify(context.projects, null, 2)}

ARTICLES DEJA PUBLIES (pour reference du style, ne pas repeter) :
${JSON.stringify(context.existingArticles, null, 2)}

Genere l'article en JSON strict comme specifie dans ton role.
Langue : ${language === 'en' ? 'Anglais' : 'Francais'}.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const costUsd = computeCost(response.usage);
  const usage = await recordSpending(costUsd);

  // Parse JSON from response
  const rawText = response.content[0]?.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response is not valid JSON: ' + rawText.slice(0, 200));
  }
  const article = JSON.parse(jsonMatch[0]);

  return {
    article,
    costUsd,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    monthlySpent: usage.spendingUsd,
  };
}

// Suggest topics based on user's recent activity
async function suggestTopics({ count = 3 }) {
  await checkBudget();

  const context = await buildContext();

  const userMessage = `En te basant sur les projets de Genaro-Cedric, propose ${count} sujets d'articles de blog tech qu'il pourrait ecrire.

PROJETS :
${JSON.stringify(context.projects, null, 2)}

ARTICLES DEJA PUBLIES (ne pas proposer des sujets trop similaires) :
${JSON.stringify(context.existingArticles, null, 2)}

Format de reponse : JSON strict, tableau d'objets :
[
  { "title": "Titre accrocheur", "angle": "1 phrase decrivant l'angle", "tags": ["tag1", "tag2"] },
  ...
]

Les sujets doivent :
- Etre lies a ce qu'il a REELLEMENT fait (cite les projets/techno qu'il utilise)
- Raconter un apprentissage, une difficulte resolue, un choix technique
- Etre concrets, pas generiques ("Introduction a X" c'est mauvais)`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const costUsd = computeCost(response.usage);
  await recordSpending(costUsd);

  const rawText = response.content[0]?.text || '';
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('AI response is not valid JSON: ' + rawText.slice(0, 200));
  }
  const topics = JSON.parse(jsonMatch[0]);

  return { topics, costUsd };
}

module.exports = {
  generateArticle,
  suggestTopics,
  checkBudget,
  MODEL,
  MONTHLY_BUDGET,
  YEARLY_BUDGET,
};
