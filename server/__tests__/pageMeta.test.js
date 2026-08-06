// Tests de l'injection de métadonnées par page.
//
// Le problème d'origine : la SPA servait le même HTML sur toutes les routes,
// donc chaque article partagé sur LinkedIn affichait l'aperçu du portfolio.
// Ces tests vérifient que chaque route produit bien ses propres balises,
// et que du contenu venant de la base ne peut pas casser le HTML.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/botDb', () => ({ getBotConnection: () => null }));

const {
  injectMeta,
  staticMetaFor,
  articleMetaFrom,
  personJsonLd,
  articleJsonLd,
  escapeAttr,
  escapeJsonLd,
  truncate,
  SITE_URL,
} = require('../services/pageMeta');

// Template minimal reproduisant les balises réelles de client/index.html
const TEMPLATE = `<!doctype html>
<html lang="fr">
  <head>
    <title>Titre par défaut</title>
    <meta name="description" content="Description par défaut" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="OG par défaut" />
    <meta property="og:description" content="OG desc par défaut" />
    <meta property="og:image" content="https://gcn-data.fr/og-image.png" />
    <meta property="og:url" content="https://gcn-data.fr" />
    <meta name="twitter:title" content="TW par défaut" />
    <meta name="twitter:description" content="TW desc par défaut" />
    <meta property="twitter:image" content="https://gcn-data.fr/og-image.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const titleOf = (html) => (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
const attrOf = (html, key, kind = 'property') =>
  (html.match(new RegExp(`<meta\\s+${kind}="${key}"\\s+content="([^"]*)"`)) || [])[1];

describe('escapeAttr', () => {
  it('échappe les caractères qui casseraient un attribut HTML', () => {
    expect(escapeAttr('a "b" c')).toBe('a &quot;b&quot; c');
    expect(escapeAttr('<script>')).toBe('&lt;script&gt;');
    expect(escapeAttr('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('gère null et undefined sans planter', () => {
    expect(escapeAttr(null)).toBe('');
    expect(escapeAttr(undefined)).toBe('');
  });

  it("échappe l'esperluette avant les autres entités (pas de double échappement)", () => {
    expect(escapeAttr('&lt;')).toBe('&amp;lt;');
  });
});

describe('escapeJsonLd', () => {
  it('neutralise < pour qu\'une chaîne ne puisse pas fermer la balise script', () => {
    const out = escapeJsonLd({ a: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
  });

  it('produit du JSON valide', () => {
    const out = escapeJsonLd({ '@type': 'Person', name: 'Genaro' });
    expect(JSON.parse(out.replace(/\\u003c/g, '<'))['@type']).toBe('Person');
  });
});

describe('truncate', () => {
  it('laisse un texte court intact', () => {
    expect(truncate('court', 200)).toBe('court');
  });

  it('coupe sur une frontière de mot et ajoute une ellipse', () => {
    const out = truncate('mot '.repeat(100), 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it('normalise les espaces multiples et les retours ligne', () => {
    expect(truncate('a\n\n  b\tc')).toBe('a b c');
  });
});

describe('injectMeta', () => {
  it('remplace le titre et les descriptions', () => {
    const html = injectMeta(TEMPLATE, {
      title: 'Mon article',
      description: 'Mon extrait',
      url: 'https://gcn-data.fr/blog/mon-article',
    });
    expect(titleOf(html)).toBe('Mon article');
    expect(attrOf(html, 'description', 'name')).toBe('Mon extrait');
    expect(attrOf(html, 'og:title')).toBe('Mon article');
    expect(attrOf(html, 'og:description')).toBe('Mon extrait');
    expect(attrOf(html, 'twitter:title', 'name')).toBe('Mon article');
  });

  it('utilise les valeurs par défaut quand rien n\'est fourni', () => {
    const html = injectMeta(TEMPLATE, {});
    expect(titleOf(html)).toContain('Ingénieur IA');
    expect(attrOf(html, 'og:url')).toBe(SITE_URL);
  });

  it('ajoute un lien canonique', () => {
    const html = injectMeta(TEMPLATE, { url: 'https://gcn-data.fr/stack' });
    expect(html).toContain('<link rel="canonical" href="https://gcn-data.fr/stack" />');
    expect((html.match(/rel="canonical"/g) || []).length).toBe(1);
  });

  it('ajoute le JSON-LD seulement quand il est fourni', () => {
    expect(injectMeta(TEMPLATE, {})).not.toContain('ld+json');
    const html = injectMeta(TEMPLATE, { jsonLd: { '@type': 'Person' } });
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Person"');
  });

  it('garde un seul </head> et le HTML reste bien formé', () => {
    const html = injectMeta(TEMPLATE, { url: 'https://x.fr', jsonLd: { a: 1 } });
    expect((html.match(/<\/head>/g) || []).length).toBe(1);
    expect((html.match(/<head>/g) || []).length).toBe(1);
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('</head>'));
    expect(html.indexOf('ld+json')).toBeLessThan(html.indexOf('</head>'));
  });

  it('neutralise un titre contenant des guillemets ou du HTML', () => {
    const html = injectMeta(TEMPLATE, {
      title: 'Il a dit "bonjour" <script>alert(1)</script>',
      description: 'Un « test » & compagnie',
    });
    // Aucun attribut ne doit être refermé prématurément
    expect(attrOf(html, 'og:title')).not.toContain('"');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(attrOf(html, 'og:description')).toContain('&amp;');
  });

  it('tronque une description trop longue', () => {
    const html = injectMeta(TEMPLATE, { description: 'phrase. '.repeat(80) });
    expect(attrOf(html, 'og:description').length).toBeLessThanOrEqual(201);
  });
});

describe('staticMetaFor', () => {
  it('renvoie des métadonnées distinctes pour chaque page publique', () => {
    const titres = ['/', '/projects', '/blog', '/stack'].map((p) => staticMetaFor(p).title);
    expect(new Set(titres).size).toBe(4); // toutes différentes
  });

  it('construit une URL absolue correcte', () => {
    expect(staticMetaFor('/').url).toBe(SITE_URL);
    expect(staticMetaFor('/stack').url).toBe(`${SITE_URL}/stack`);
  });

  it('tolère une barre oblique finale', () => {
    expect(staticMetaFor('/stack/').title).toBe(staticMetaFor('/stack').title);
  });

  it('renvoie null pour une route inconnue (laisse la main au fallback)', () => {
    expect(staticMetaFor('/inconnue')).toBeNull();
    expect(staticMetaFor('/blog/un-article')).toBeNull();
  });

  it("expose le JSON-LD Person sur l'accueil uniquement", () => {
    expect(staticMetaFor('/').jsonLd['@type']).toBe('Person');
    expect(staticMetaFor('/stack').jsonLd).toBeUndefined();
  });
});

describe('articleMetaFrom', () => {
  const article = {
    title: 'Déployer un bot 24/7',
    excerpt: 'Les pièges du réseau.',
    slug: 'deployer-un-bot-24-7',
    tags: ['python', 'flyio'],
    publishedAt: new Date('2026-07-01T10:00:00Z'),
    updatedAt: new Date('2026-07-02T10:00:00Z'),
  };

  it('construit un titre, une URL et un type propres à l\'article', () => {
    const m = articleMetaFrom(article);
    expect(m.title).toBe('Déployer un bot 24/7 — Blog GCN');
    expect(m.url).toBe(`${SITE_URL}/blog/deployer-un-bot-24-7`);
    expect(m.type).toBe('article');
    expect(m.description).toBe('Les pièges du réseau.');
  });

  it('embarque un JSON-LD BlogPosting complet', () => {
    const ld = articleMetaFrom(article).jsonLd;
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('Déployer un bot 24/7');
    expect(ld.author.name).toContain('Nisus');
    expect(ld.mainEntityOfPage).toContain('/blog/deployer-un-bot-24-7');
    expect(ld.keywords).toBe('python, flyio');
  });

  it('reste fonctionnel sans extrait ni tags', () => {
    const m = articleMetaFrom({ title: 'T', slug: 's' });
    expect(m.description.length).toBeGreaterThan(0);
    expect(m.jsonLd.keywords).toBeUndefined();
  });
});

describe('jsonLd', () => {
  it('personJsonLd contient les liens sociaux et le bon type', () => {
    const p = personJsonLd();
    expect(p['@type']).toBe('Person');
    expect(p['@context']).toBe('https://schema.org');
    expect(p.sameAs.some((u) => u.includes('linkedin.com/in/gcnisus'))).toBe(true);
    expect(p.sameAs.some((u) => u.includes('github.com/Gnaro-Shaft'))).toBe(true);
  });

  it('articleJsonLd tronque la description', () => {
    const ld = articleJsonLd({ title: 'T', slug: 's', excerpt: 'x'.repeat(500) });
    expect(ld.description.length).toBeLessThanOrEqual(201);
  });
});

describe("régression — la page d'accueil doit être traitée comme les autres", () => {
  // express.static sert index.html pour "/" par défaut, ce qui court-circuitait
  // le fallback : l'accueil était la seule page sans lien canonique ni donnée
  // structurée, alors que son titre semblait correct (c'est celui du template).
  // Corrigé par `index: false` sur express.static.
  it('staticMetaFor("/") fournit bien canonical et JSON-LD', () => {
    const meta = staticMetaFor('/');
    expect(meta).not.toBeNull();
    expect(meta.url).toBe(SITE_URL);
    expect(meta.jsonLd['@type']).toBe('Person');
  });

  it("le HTML de l'accueil contient canonical et le bloc ld+json", () => {
    const html = injectMeta(TEMPLATE, staticMetaFor('/'));
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}" />`);
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Person"');
  });
});

describe('scénario complet — un article partagé sur LinkedIn', () => {
  it('produit un HTML dont les métadonnées décrivent l\'article, pas le portfolio', () => {
    const article = {
      title: 'A/B test embeddings : de 30 % à 90 % de Hit@1',
      excerpt: "J'ai changé le modèle d'embeddings et la précision a triplé.",
      slug: 'ab-test-embeddings',
      tags: ['rag', 'embeddings'],
      publishedAt: new Date('2026-06-17'),
    };
    const html = injectMeta(TEMPLATE, articleMetaFrom(article));

    // Ce que voit le robot LinkedIn
    expect(attrOf(html, 'og:title')).toContain('A/B test embeddings');
    expect(attrOf(html, 'og:description')).toContain('précision a triplé');
    expect(attrOf(html, 'og:type')).toBe('article');
    expect(attrOf(html, 'og:url')).toContain('/blog/ab-test-embeddings');

    // Et surtout : plus rien du portfolio générique
    expect(titleOf(html)).not.toContain('Ingénieur IA & Développeur');
    expect(attrOf(html, 'og:description')).not.toContain('Je construis des systèmes');
  });
});
