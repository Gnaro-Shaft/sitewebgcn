// Export des articles de l'ancien blog gcn-data.fr en fichiers Markdown au
// format de gnaro.fr, avant la suppression de la collection (chantier de
// septembre 2026). Lecture seule sur la base : rien n'est modifié.
//
// Usage :
//   node server/scripts/exportArticles.js [--out <dossier>] [--dry-run]
//
// Dossier de sortie par défaut : ~/projects/10-en-cours/migration-articles-gnaro
// (hors dépôt, volontairement : ces fichiers sont une matière à trier, pas du
// code, et ils ne doivent pas partir dans un commit par accident).
//
// Produit :
//   <slug>.md      un fichier par article, frontmatter gnaro.fr + bloc migration
//   INDEX.md       tableau de tri : statut, LinkedIn, doublons probables, signalements
//   README.md      ce que signifient les champs et comment déposer un article
//
// Les règles de conversion sont dans lib/articleExport.js.

require('dotenv').config({ quiet: true });
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const Article = require('../models/Article');
const { convertir, enMarkdown, doublonsProbables } = require('./lib/articleExport');

const DEFAUT = path.join(os.homedir(), 'projects', '10-en-cours', 'migration-articles-gnaro');

function options(argv) {
  const o = { out: DEFAUT, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') o.out = path.resolve(argv[++i]);
    else if (argv[i] === '--dry-run') o.dryRun = true;
    else throw new Error(`option inconnue : ${argv[i]}`);
  }
  return o;
}

const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function ligneIndex(a, conv, doublons) {
  const li = a.socialPosted?.linkedin?.status || 'pending';
  const cellule = (s) => String(s).replace(/\|/g, '\\|');
  return [
    a.slug,
    cellule(a.title),
    a.published ? date(a.publishedAt) : 'brouillon',
    li === 'pending' ? '' : `${li}${a.socialPosted.linkedin.postedAt ? ` ${date(a.socialPosted.linkedin.postedAt)}` : ''}`,
    String((a.content || '').length),
    String(conv.frontmatter.aVerifier.length),
    (doublons[a.slug] || []).join(', '),
    cellule(conv.signalements.join(' ; ')),
  ].join(' | ');
}

function index(articles, convs, doublons) {
  const nb = (f) => articles.filter(f).length;
  return [
    '# Articles exportés de gcn-data.fr',
    '',
    `Export du ${date(new Date())}. ${articles.length} articles, ${nb((a) => a.published)} publiés, ` +
      `${nb((a) => a.socialPosted?.linkedin?.status === 'posted')} postés sur LinkedIn.`,
    '',
    'Colonne « doublons » : titres partageant la moitié de leurs mots ; à trancher à la lecture.',
    'Colonne « à vérifier » : phrases chiffrées, reprises dans `aVerifier` du frontmatter.',
    '',
    'slug | titre | publié le | LinkedIn | caractères | à vérifier | doublons probables | signalements',
    '--- | --- | --- | --- | --- | --- | --- | ---',
    ...articles.map((a, i) => ligneIndex(a, convs[i], doublons)),
    '',
  ].join('\n');
}

const README = `# Matière de migration vers gnaro.fr

Chaque fichier est un article de l'ancien blog gcn-data.fr, au format de
\`src/content/blog/\` du dépôt gnaro. Rien n'a été trié : c'est un export brut,
à lire avec INDEX.md.

## Ce que le frontmatter impose

- \`draft: true\` : l'article n'est pas construit tant qu'il n'est pas publié
  depuis le tableau de bord.
- \`aiAssisted: true\` : ces textes sortaient d'un pipeline Claude. La mention
  IA est due. Ne repasser à \`false\` qu'après une réécriture complète à la main.
- \`aVerifier\` : phrases chiffrées repérées automatiquement. À cocher ou à
  retirer avant publication, comme pour un brouillon du pipeline.
- \`description\` : extrait coupé à 160 caractères ; à relire, la coupe est
  mécanique.

## Le bloc \`migration\`

Ignoré par le schéma gnaro.fr (il ne fait pas échouer le build), il porte ce
qui disparaît avec la base : slug d'origine et anciens slugs (pour les
redirections 301), et la trace LinkedIn. **Un article dont \`linkedin.status\`
vaut \`posted\` a déjà son post** : la redirection de l'ancien lien suffit,
ne pas en refaire un.

## Déposer un article retenu

1. Copier le fichier dans \`src/content/blog/\` du dépôt gnaro, en gardant ou
   en changeant le slug (le nom du fichier fait l'URL).
2. Réécrire ou retirer les liens vers gcn-data.fr signalés dans INDEX.md.
3. Noter la correspondance ancien slug → nouveau slug pour le Caddyfile.
4. Le H1 du corps a été retiré quand il répétait le titre ; sinon il est
   signalé.
`;

async function main() {
  const { out, dryRun } = options(process.argv.slice(2));
  await mongoose.connect(process.env.MONGODB_URI);
  const articles = await Article.find({}).sort({ publishedAt: 1, createdAt: 1 }).lean();
  await mongoose.disconnect();

  const convs = articles.map(convertir);
  const doublons = doublonsProbables(articles);
  const indexMd = index(articles, convs, doublons);

  if (dryRun) {
    process.stdout.write(indexMd);
    return;
  }

  fs.mkdirSync(out, { recursive: true });
  for (const c of convs) fs.writeFileSync(path.join(out, c.fichier), enMarkdown(c));
  fs.writeFileSync(path.join(out, 'INDEX.md'), indexMd);
  fs.writeFileSync(path.join(out, 'README.md'), README);
  console.log(`${convs.length} articles écrits dans ${out}`);
}

main().catch((e) => {
  console.error(`Export interrompu : ${e.message}`);
  process.exit(1);
});
