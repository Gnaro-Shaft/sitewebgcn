// Régénère les slugs de tous les articles avec la translittération corrigée.
//
// Avant : « Déployer un bot… »  →  d-ployer-un-bot…      (mot-clé détruit)
// Après : « Déployer un bot… »  →  deployer-un-bot…      (mot-clé préservé)
//
// L'ancien slug est conservé dans `oldSlugs[]` pour que
// getArticleBySlug puisse répondre 301 et ne casse aucun lien déjà
// partagé sur LinkedIn ou indexé par Google.
//
// USAGE (depuis la racine du dépôt) :
//   node server/scripts/fixArticleSlugs.js --dry-run   # prévisualiser
//   node server/scripts/fixArticleSlugs.js             # appliquer
//
// Idempotent : relançable sans risque, ne touche que ce qui change.

require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI absent de l\'environnement. Abandon.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connecté à MongoDB${DRY_RUN ? '  (MODE DRY-RUN — aucune écriture)' : ''}\n`);

  const articles = await Article.find().select('title slug oldSlugs');
  console.log(`${articles.length} articles à examiner.\n`);

  let changed = 0;
  let unchanged = 0;
  const collisions = new Map(); // slug → nb d'occurrences

  for (const a of articles) {
    let target = Article.slugify(a.title);

    // Collision avec un autre article portant le même titre translittéré
    const seen = collisions.get(target) || 0;
    if (seen > 0) {
      target = `${target}-${seen + 1}`;
    }
    collisions.set(Article.slugify(a.title), seen + 1);

    if (target === a.slug) {
      unchanged++;
      continue;
    }

    changed++;
    console.log(`→ ${a.title.slice(0, 62)}${a.title.length > 62 ? '…' : ''}`);
    console.log(`  ancien : ${a.slug}`);
    console.log(`  nouveau: ${target}\n`);

    if (!DRY_RUN) {
      const oldSlugs = Array.isArray(a.oldSlugs) ? a.oldSlugs : [];
      if (a.slug && !oldSlugs.includes(a.slug)) oldSlugs.push(a.slug);
      // updateOne pour ne pas déclencher le hook pre('save') qui recalculerait
      await Article.updateOne({ _id: a._id }, { $set: { slug: target, oldSlugs } });
    }
  }

  console.log('─'.repeat(60));
  console.log(`Modifiés : ${changed}   ·   Inchangés : ${unchanged}`);
  if (DRY_RUN) {
    console.log('\nDRY-RUN — relance sans --dry-run pour appliquer.');
  } else if (changed > 0) {
    console.log('\n⚠️  Pense à régénérer le sitemap et à resoumettre dans la Search Console.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Le script a échoué :', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
