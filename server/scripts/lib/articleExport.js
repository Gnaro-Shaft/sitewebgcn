// Transformations pures pour l'export des articles de l'ancien blog
// (gcn-data.fr, MongoDB) vers le format des articles de gnaro.fr
// (Markdown + frontmatter, schéma dans src/content.config.ts du dépôt gnaro).
//
// Aucun accès réseau ni base ici : tout est testable à partir d'un objet
// article brut. Le script server/scripts/exportArticles.js fait le reste.
//
// Décisions figées ici, à connaître avant de relire un fichier exporté :
//   - draft: true et aiAssisted: true, toujours. Les anciens articles sortaient
//     d'un pipeline Claude ; la mention IA (art. 50 AI Act) est due tant que
//     le texte n'a pas été entièrement récrit à la main.
//   - Le H1 qui ouvre le corps est retiré : gnaro.fr affiche le titre du
//     frontmatter. Si le H1 diffère du titre, il est conservé et signalé.
//   - Les liens vers gcn-data.fr sont laissés tels quels et signalés : leur
//     réécriture dépend des articles qui seront migrés, décision à venir.
//   - Le bloc `migration` n'existe pas dans le schéma gnaro.fr, qui l'ignore
//     sans erreur. Il porte la trace LinkedIn qui évite un second post.

const DESCRIPTION_MAX = 160;
const A_VERIFIER_MAX = 15;
// En dessous, ce n'est pas un article mais une amorce jamais développée.
const CORPS_MIN = 1000;

// --- YAML minimal -----------------------------------------------------------
// On n'a que des chaînes, booléens, nombres, dates, tableaux plats et objets
// imbriqués : un sérialiseur de vingt lignes vaut mieux qu'une dépendance.

function yamlString(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function yamlScalar(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return yamlString(v);
}

function toYaml(obj, indent = '') {
  const lignes = [];
  for (const [cle, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      lignes.push(`${indent}${cle}: [${val.map(yamlScalar).join(', ')}]`);
    } else if (typeof val === 'object' && !(val instanceof Date)) {
      lignes.push(`${indent}${cle}:`);
      lignes.push(toYaml(val, `${indent}  `));
    } else {
      lignes.push(`${indent}${cle}: ${yamlScalar(val)}`);
    }
  }
  return lignes.join('\n');
}

// --- Champs -----------------------------------------------------------------

function sansAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Étiquettes gnaro.fr : minuscules, sans accent, sans doublon.
function normaliserTags(tags) {
  const vus = new Set();
  for (const t of tags || []) {
    const n = sansAccents(String(t)).toLowerCase().trim().replace(/\s+/g, '-');
    if (n) vus.add(n);
  }
  return [...vus];
}

// Enlève la syntaxe Markdown d'un paragraphe pour en faire du texte plat.
function texteBrut(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Coupe à DESCRIPTION_MAX sur une frontière de mot, avec points de suspension.
function tronquer(s, max = DESCRIPTION_MAX) {
  if (s.length <= max) return s;
  const coupe = s.slice(0, max - 1);
  const dernierEspace = coupe.lastIndexOf(' ');
  return `${coupe.slice(0, dernierEspace > max / 2 ? dernierEspace : max - 1).trim()}…`;
}

function description(article, corps) {
  const source = article.excerpt && article.excerpt.trim()
    ? article.excerpt
    : corps.split(/\n\s*\n/).map(texteBrut).find((p) => p.length > 40) || article.title;
  return tronquer(texteBrut(source));
}

// Retire le titre d'ouverture (H1, parfois H2 dans les anciens articles)
// s'il reprend le titre. Retourne le corps et un éventuel signalement.
function retirerH1(content, title) {
  const m = content.match(/^\s*#{1,2}\s+(.+?)\s*\n+/);
  if (!m) return { corps: content.trim(), signalement: null };
  const memeTitre = sansAccents(m[1]).toLowerCase() === sansAccents(title).toLowerCase();
  if (memeTitre) return { corps: content.slice(m[0].length).trim(), signalement: null };
  return { corps: content.trim(), signalement: `H1 différent du titre : « ${m[1]} »` };
}

function sansBlocsDeCode(md) {
  return md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

// Phrases contenant un chiffre, hors blocs de code et hors années seules.
// Heuristique volontairement large : mieux vaut cocher une ligne inutile
// que publier un chiffre inventé.
function pointsAVerifier(corps) {
  const texte = texteBrut(sansBlocsDeCode(corps));
  const phrases = texte.split(/(?<=[.!?])\s+/);
  const retenues = [];
  for (const p of phrases) {
    const nombres = p.match(/\d+(?:[.,]\d+)?/g);
    if (!nombres) continue;
    if (nombres.every((n) => /^(19|20)\d\d$/.test(n))) continue;
    const phrase = p.replace(/^[-•]\s+/, '');
    retenues.push(phrase.length > 160 ? `${phrase.slice(0, 157)}…` : phrase);
    if (retenues.length === A_VERIFIER_MAX) break;
  }
  return retenues;
}

function signalements(article, corps, signalementH1) {
  const s = [];
  if (signalementH1) s.push(signalementH1);
  const liens = corps.match(/https?:\/\/(?:www\.)?gcn-data\.fr[^\s)]*/g);
  if (liens) s.push(`${liens.length} lien(s) vers gcn-data.fr`);
  if (/<(div|p|img|a |br|h[1-6]|table|span)\b/i.test(corps)) s.push('HTML brut dans le corps');
  if (/!\[/.test(corps)) s.push('image(s) à importer ou retirer');
  if (corps.length < CORPS_MIN) s.push(`corps très court (${corps.length} caractères)`);
  if (!article.excerpt) s.push('pas d’extrait : description tirée du premier paragraphe');
  if ((article.excerpt || '').length > DESCRIPTION_MAX) s.push('extrait coupé à 160 caractères');
  return s;
}

function traceReseau(bloc) {
  if (!bloc || !bloc.status || bloc.status === 'pending') return undefined;
  return {
    status: bloc.status,
    queuedAt: bloc.queuedAt,
    postedAt: bloc.postedAt,
    postUrn: bloc.postUrn,
    commentUrn: bloc.commentUrn,
    error: bloc.error,
    text: bloc.text,
    firstComment: bloc.firstComment,
  };
}

// Article brut (lean) → { fichier, frontmatter, corps, signalements }.
function convertir(article) {
  const { corps, signalement } = retirerH1(article.content || '', article.title || '');
  const flags = signalements(article, corps, signalement);
  const frontmatter = {
    title: article.title,
    description: description(article, corps),
    pubDate: article.publishedAt || article.createdAt,
    tags: normaliserTags(article.tags),
    draft: true,
    aiAssisted: true,
    aVerifier: pointsAVerifier(corps),
    migration: {
      source: `https://gcn-data.fr/blog/${article.slug}`,
      slug: article.slug,
      oldSlugs: (article.oldSlugs || []).length ? article.oldSlugs : undefined,
      published: Boolean(article.published),
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      views: article.views,
      linkedin: traceReseau(article.socialPosted?.linkedin),
      x: traceReseau(article.socialPosted?.x),
      signalements: flags.length ? flags : undefined,
    },
  };
  return { fichier: `${article.slug}.md`, frontmatter, corps, signalements: flags };
}

function enMarkdown({ frontmatter, corps }) {
  return `---\n${toYaml(frontmatter)}\n---\n\n${corps}\n`;
}

// Doublons probables : deux titres partageant la moitié de leurs mots
// significatifs. Retourne, par slug, la liste des slugs proches.
function doublonsProbables(articles) {
  const mots = (t) =>
    new Set(
      sansAccents(t).toLowerCase().match(/[a-z0-9]{4,}/g) || []
    );
  const jeux = articles.map((a) => ({ slug: a.slug, mots: mots(a.title || '') }));
  const resultat = {};
  for (const a of jeux) {
    for (const b of jeux) {
      if (a.slug >= b.slug || a.mots.size === 0 || b.mots.size === 0) continue;
      const commun = [...a.mots].filter((m) => b.mots.has(m)).length;
      if (commun / Math.min(a.mots.size, b.mots.size) >= 0.5) {
        (resultat[a.slug] ||= []).push(b.slug);
        (resultat[b.slug] ||= []).push(a.slug);
      }
    }
  }
  return resultat;
}

module.exports = {
  DESCRIPTION_MAX,
  toYaml,
  normaliserTags,
  tronquer,
  retirerH1,
  pointsAVerifier,
  convertir,
  enMarkdown,
  doublonsProbables,
};
