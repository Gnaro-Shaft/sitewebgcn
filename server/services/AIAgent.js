const Anthropic = require('@anthropic-ai/sdk').default;
const AIUsage = require('../models/AIUsage');
const Project = require('../models/Project');
const Article = require('../models/Article');
const Conversation = require('../models/Conversation');

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

// Fetch recent commit messages from the user's most-recently-pushed public
// repos. Two-step approach (the events feed truncates PushEvent payloads
// so we cannot rely on it):
//   1. GET /users/{u}/repos sorted by pushed_at → recent repos
//   2. For each repo pushed within `sinceDays`, GET /repos/{u}/{repo}/commits
//      with ?author={u}&since={iso} → real commit messages
//
// No auth → 60 req/h per IP, more than enough for a weekly cron.
async function fetchRecentGithubActivity({ user, sinceDays = 7 }) {
  if (!user) return { commits: [], repos: [] };

  const sinceMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  async function getJson(url) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'gcn-data-bot' } });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  const repos = await getJson(
    `https://api.github.com/users/${user}/repos?sort=pushed&per_page=20`
  );
  if (!Array.isArray(repos)) return { commits: [], repos: [] };

  // Keep only repos pushed within the window, skip forks/archived (noise).
  const activeRepos = repos.filter(
    (r) =>
      !r.fork &&
      !r.archived &&
      r.pushed_at &&
      new Date(r.pushed_at).getTime() >= sinceMs
  );

  // Fetch commits in parallel — each repo gets up to 20 of the user's commits
  // since the window start. Cap total at 30 messages in the final context.
  const commitsPerRepo = await Promise.all(
    activeRepos.map(async (r) => {
      const list = await getJson(
        `https://api.github.com/repos/${r.full_name}/commits?author=${encodeURIComponent(
          user
        )}&since=${encodeURIComponent(sinceIso)}&per_page=20`
      );
      if (!Array.isArray(list)) return [];
      return list
        .map((c) => ({
          repo: r.full_name,
          message: (c.commit?.message || '').split('\n')[0].slice(0, 200),
          at: c.commit?.author?.date || r.pushed_at,
        }))
        .filter((c) => c.message && !c.message.startsWith('Merge '));
    })
  );

  const commits = commitsPerRepo.flat().slice(0, 30);
  const reposTouched = [...new Set(commits.map((c) => c.repo))];

  return { commits, repos: reposTouched };
}

// Build context from user's recent activity
async function buildContext(userId) {
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

  // Recent conversations (for personalization context)
  let conversationContext = null;
  if (userId) {
    conversationContext = await fetchConversationContext({ userId });
  }

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
    conversationContext: conversationContext,
  };
}

// Fetch recent conversation context for AI personalization
async function fetchConversationContext({ userId, limit = 5 }) {
  if (!userId) return { conversations: [], context: null };

  const conversations = await Conversation.find({
    user: userId,
    archived: false
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('title summary tags type contextNotes updatedAt');

  if (conversations.length === 0) {
    return { conversations: [], context: null };
  }

  // Extract useful context from conversations
  const context = conversations.map(c => c.extractAiContext());

  return {
    conversations: conversations.map(c => ({
      title: c.title,
      summary: c.summary,
      tags: c.tags,
      type: c.type,
      updatedAt: c.updatedAt
    })),
    context: context,
    totalConversations: await Conversation.countDocuments({ user: userId, archived: false })
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
- Tire parti du contexte des conversations précédentes pour personnaliser le contenu

Format de sortie :
- Reponse en JSON uniquement, sans balises markdown autour
- Structure : { "title": "...", "slug": "...", "excerpt": "...", "content": "...", "tags": ["...", "..."] }
- "content" au format Markdown (# H1, ## H2, code blocks, etc.)
- "slug" en kebab-case sans accents (ex: "mon-premier-article")
- "excerpt" : 1-2 phrases, ~150 caracteres max, pour le preview
- "tags" : 2-4 tags pertinents en minuscules

Longueur cible : 600-1200 mots d'article.`;

// Generate article from a topic (string)
async function generateArticle({ topic, language = 'fr', userId }) {
  await checkBudget();

  const context = await buildContext(userId);

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
async function suggestTopics({ count = 3, userId }) {
  await checkBudget();

  const context = await buildContext(userId);

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

// Weekly auto-draft: Claude picks the best topic AND writes the article in
// a single API call, based on the user's last 7 days of GitHub activity +
// recent projects + existing articles + conversation context (to avoid repeating).
//
// Returns: { article, costUsd, inputTokens, outputTokens, monthlySpent }
async function generateWeeklyDraft({ githubUser, sinceDays = 7, language = 'fr', userId } = {}) {
  await checkBudget();

  const [context, activity] = await Promise.all([
    buildContext(userId),
    fetchRecentGithubActivity({ user: githubUser, sinceDays }),
  ]);

  // If there's no activity at all, return a clear signal upstream rather
  // than burning a Claude call on nothing.
  if (activity.commits.length === 0) {
    return { article: null, skipped: 'no-recent-activity', costUsd: 0 };
  }

  const userMessage = `Choisis UN sujet d'article de blog tech à partir de mon activité de ces 7 derniers jours, puis écris l'article complet.

ACTIVITÉ GITHUB (${activity.commits.length} commits sur ${activity.repos.length} repos) :
${JSON.stringify(activity.commits, null, 2)}

REPOS TOUCHÉS : ${activity.repos.join(', ')}

MES PROJETS RÉCENTS (contexte général) :
${JSON.stringify(context.projects, null, 2)}

ARTICLES DÉJÀ PUBLIÉS (NE PAS REPRENDRE LE MÊME ANGLE) :
${JSON.stringify(context.existingArticles, null, 2)}

INSTRUCTIONS :
1. Identifie UN problème concret que j'ai résolu cette semaine (cherche des patterns dans les commits)
2. Écris l'article en racontant : le contexte, le piège rencontré, la solution, la leçon
3. Tutoie le lecteur (ton blog), première personne pour moi
4. Si tu ne vois aucun sujet vraiment intéressant, choisis quand même le meilleur disponible — sortir un article moyen vaut mieux que rien

Réponds en JSON strict comme dans ton rôle.
Langue : ${language === 'en' ? 'Anglais' : 'Français'}.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const costUsd = computeCost(response.usage);
  const usage = await recordSpending(costUsd);

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
    activitySummary: {
      commitsAnalyzed: activity.commits.length,
      reposTouched: activity.repos,
    },
  };
}

module.exports = {
  generateArticle,
  suggestTopics,
  generateWeeklyDraft,
  checkBudget,
  // Pure functions, exposed for unit tests
  computeCost,
  fetchRecentGithubActivity,
  PRICING,
  MODEL,
  MONTHLY_BUDGET,
  YEARLY_BUDGET,
};
