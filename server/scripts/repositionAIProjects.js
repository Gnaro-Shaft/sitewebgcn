// One-shot migration: reposition the portfolio around the AI Engineer narrative.
//
// - Enriches Mnemo description with the 90% Hit@1 metric
// - Enriches Hyperliquid V8 description with ML details, adds ML tags to its stack
// - Reorders projects so IA projects (Mnemo, Jarvis Local, Hyperliquid V8) come first
//
// Idempotent — safe to run multiple times. Only updates fields that need updating.
// Skips projects that don't exist in DB (logs a warning, doesn't throw).
//
// USAGE (from repo root):
//   node server/scripts/repositionAIProjects.js
//
// Requires MONGODB_URI in .env (main DB, not BOT_MONGODB_URI). Dry-run mode
// available via `--dry-run` to preview changes without writing.

require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('../models/Project');

const DRY_RUN = process.argv.includes('--dry-run');

// Matcher can be `title` (exact match) or `titleContains` (substring, case-insensitive).
// I use `titleContains` because the exact stored titles may have subtle variations
// (e.g. "Hyperliquid Trading Bot V8" vs "hyperliquid-trading-bot-v8" vs "Hyperliquid Bot").
const UPDATES = [
  {
    matchBy: 'titleContains',
    match: 'mnemo',
    order: 1,
    descriptionOverride:
      "RAG self-hosted pour ma vault Obsidian. Optimisation A/B des modèles d'embeddings (bge-m3 vs nomic-embed-text) — Hit@1 passé de 30 % à 90 % sur benchmark de 20 queries. Stack : Qdrant + FastAPI + Docker Compose.",
    ensureStack: ['RAG', 'Embeddings', 'Qdrant', 'FastAPI', 'Python'],
  },
  {
    matchBy: 'titleContains',
    match: 'jarvis',
    order: 2,
    ensureStack: ['LLM', 'Multi-agent', 'Python'],
  },
  {
    matchBy: 'titleContains',
    match: 'hyperliquid',
    order: 3,
    descriptionOverride:
      "Bot de trading crypto (Hyperliquid) — scoring multi-timeframe filtré par un modèle ML (scikit-learn) avec réentraînement automatique toutes les 6h (pattern champion/challenger, holdout, garde anti-régression). Gestion du risque (exposure caps, circuit breaker), backtests réalistes, déployé 24/7 sur Fly.io.",
    ensureStack: ['Python', 'scikit-learn', 'Machine Learning', 'MongoDB', 'Fly.io'],
  },
  {
    matchBy: 'titleContains',
    match: 'tiktok',
    order: 4,
  },
  {
    matchBy: 'titleContains',
    match: 'gcn-api',
    order: 5,
  },
  {
    matchBy: 'titleContains',
    match: 'portfolio',
    order: 6,
  },
  {
    // Alias if the portfolio project is called "siteweb" or "siteweb-v2"
    matchBy: 'titleContains',
    match: 'siteweb',
    order: 6,
  },
];

async function findMatchingProject(update) {
  if (update.matchBy === 'title') {
    return Project.findOne({ title: update.match });
  }
  // Case-insensitive substring match — escape regex specials to be safe.
  const escaped = update.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Project.findOne({ title: { $regex: escaped, $options: 'i' } });
}

function computeChanges(project, update) {
  const changes = {};

  if (update.order != null && project.order !== update.order) {
    changes.order = { from: project.order, to: update.order };
  }
  if (
    update.descriptionOverride &&
    project.description !== update.descriptionOverride
  ) {
    changes.description = {
      from: (project.description || '').slice(0, 60) + '…',
      to: update.descriptionOverride.slice(0, 60) + '…',
    };
  }
  if (Array.isArray(update.ensureStack)) {
    const existing = new Set(project.stack || []);
    const missing = update.ensureStack.filter((s) => !existing.has(s));
    if (missing.length > 0) {
      changes.stack = { added: missing };
    }
  }
  return changes;
}

function buildPatch(project, update) {
  const patch = {};
  if (update.order != null) patch.order = update.order;
  if (update.descriptionOverride) patch.description = update.descriptionOverride;
  if (Array.isArray(update.ensureStack)) {
    const merged = [...new Set([...(project.stack || []), ...update.ensureStack])];
    patch.stack = merged;
  }
  return patch;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI missing from env. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connected to MongoDB${DRY_RUN ? ' (DRY-RUN MODE)' : ''}`);

  let updated = 0;
  let skipped = 0;
  const seenIds = new Set();

  for (const update of UPDATES) {
    const project = await findMatchingProject(update);
    if (!project) {
      console.log(`⚠️  No project matched \`${update.matchBy}=${update.match}\` — skipping.`);
      skipped++;
      continue;
    }

    if (seenIds.has(String(project._id))) {
      // Two aliases resolved to the same project (e.g. portfolio + siteweb).
      // Skip silently to avoid double-apply.
      continue;
    }
    seenIds.add(String(project._id));

    const changes = computeChanges(project, update);
    if (Object.keys(changes).length === 0) {
      console.log(`✓ ${project.title} — already up to date, no changes`);
      continue;
    }

    console.log(`\n→ ${project.title}`);
    for (const [field, change] of Object.entries(changes)) {
      console.log(`   ${field}:`, change);
    }

    if (!DRY_RUN) {
      const patch = buildPatch(project, update);
      await Project.findByIdAndUpdate(project._id, patch, { runValidators: true });
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}${DRY_RUN ? ' (DRY-RUN — no writes performed)' : ''}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Script failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
