// Injection des métadonnées par page dans le HTML servi.
//
// Le site est une SPA : React pose <title> et og:* après exécution du
// JavaScript. Or les robots de LinkedIn, X, Slack et WhatsApp n'exécutent
// pas de JavaScript — ils lisent le HTML brut du serveur, identique sur
// toutes les routes. Résultat : chaque article partagé affichait l'aperçu
// générique du portfolio.
//
// Ce module réécrit les balises du template avant l'envoi, à partir de la
// route demandée. Les fonctions sont pures et testées séparément du
// câblage Express.

const SITE_URL = process.env.SITE_URL || 'https://gcn-data.fr';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const DEFAULTS = {
  title: 'Genaro-Cédric NISUS — Ingénieur IA & Développeur',
  description:
    "Je construis des systèmes d'IA de qualité production : RAG évalué à 90 % de précision, assistant multi-agents, bot de trading avec ML déployé 24/7.",
  type: 'website',
};

// Échappe pour insertion dans un attribut HTML entre guillemets doubles.
function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Échappe pour insertion dans un bloc <script type="application/ld+json">.
// JSON.stringify gère les guillemets ; il reste à neutraliser `<` pour
// qu'une chaîne contenant "</script>" ne ferme pas la balise.
function escapeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// Tronque proprement une description sur une frontière de mot.
function truncate(text, max = 200) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

// Réécrit les balises du template avec les valeurs fournies.
// Ne touche qu'aux balises déjà présentes : si le template évolue, les
// balises manquantes sont simplement ignorées plutôt que dupliquées.
function injectMeta(template, meta = {}) {
  const title = escapeAttr(meta.title || DEFAULTS.title);
  const description = escapeAttr(truncate(meta.description || DEFAULTS.description));
  const image = escapeAttr(meta.image || DEFAULT_IMAGE);
  const url = escapeAttr(meta.url || SITE_URL);
  const type = escapeAttr(meta.type || DEFAULTS.type);

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/, `$1${type}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="twitter:image"\s+content=")[^"]*(")/, `$1${image}$2`);

  // Lien canonique — évite que /blog/x et /blog/x?utm=… soient vus comme
  // deux pages distinctes.
  html = html.replace(
    /<\/head>/,
    `  <link rel="canonical" href="${url}" />\n  </head>`
  );

  if (meta.jsonLd) {
    html = html.replace(
      /<\/head>/,
      `  <script type="application/ld+json">${escapeJsonLd(meta.jsonLd)}</script>\n  </head>`
    );
  }

  return html;
}

// Donnée structurée décrivant la personne — alimente le panneau de
// connaissances quand quelqu'un cherche le nom.
function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Genaro-Cédric Nisus',
    url: SITE_URL,
    jobTitle: 'Ingénieur IA & Développeur',
    sameAs: [
      'https://github.com/Gnaro-Shaft',
      'https://www.linkedin.com/in/gcnisus/',
    ],
    knowsAbout: [
      'Retrieval-Augmented Generation',
      'Machine Learning',
      'Python',
      'Node.js',
      'React',
    ],
  };
}

// Donnée structurée d'article — débloque les résultats enrichis.
function articleJsonLd(article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: truncate(article.excerpt, 200),
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: { '@type': 'Person', name: 'Genaro-Cédric Nisus', url: SITE_URL },
    publisher: { '@type': 'Person', name: 'Genaro-Cédric Nisus', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`,
    keywords: Array.isArray(article.tags) ? article.tags.join(', ') : undefined,
  };
}

// Métadonnées des pages fixes. Les routes dynamiques (articles) sont
// résolues séparément car elles nécessitent un accès base.
const STATIC_PAGES = {
  '/': {
    title: DEFAULTS.title,
    description: DEFAULTS.description,
    jsonLd: personJsonLd(),
  },
  '/projects': {
    title: 'Projets — Genaro-Cédric NISUS',
    description:
      "Mnemo (RAG self-hosted, 90 % Hit@1), Jarvis Local (assistant multi-agents), bot de trading Hyperliquid avec filtre ML déployé 24/7, et le reste.",
  },
  '/blog': {
    title: 'Blog — Genaro-Cédric NISUS',
    description:
      "Mes apprentissages sur l'IA appliquée, le RAG, l'automatisation et la donnée. Articles techniques : ce qui a marché, ce qui m'a pris la tête, et pourquoi.",
  },
  '/stack': {
    title: 'Stack technique — Genaro-Cédric NISUS',
    description:
      "L'architecture de ce site : décisions techniques, compromis assumés et leçons tirées. Scores Lighthouse mesurés chaque semaine.",
  },
};

function staticMetaFor(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const meta = STATIC_PAGES[clean];
  if (!meta) return null;
  return { ...meta, url: `${SITE_URL}${clean === '/' ? '' : clean}` };
}

function articleMetaFrom(article) {
  return {
    title: `${article.title} — Blog GCN`,
    description: article.excerpt || DEFAULTS.description,
    url: `${SITE_URL}/blog/${article.slug}`,
    type: 'article',
    jsonLd: articleJsonLd(article),
  };
}

module.exports = {
  injectMeta,
  staticMetaFor,
  articleMetaFrom,
  personJsonLd,
  articleJsonLd,
  escapeAttr,
  escapeJsonLd,
  truncate,
  SITE_URL,
  DEFAULTS,
  STATIC_PAGES,
};
