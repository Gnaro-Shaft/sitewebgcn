import { describe, it, expect } from 'vitest';
import {
  toYaml,
  normaliserTags,
  tronquer,
  retirerH1,
  pointsAVerifier,
  convertir,
  enMarkdown,
  doublonsProbables,
} from '../scripts/lib/articleExport.js';

const base = {
  title: 'Un titre suffisamment long pour le schéma',
  slug: 'un-titre',
  content:
    '# Un titre suffisamment long pour le schéma\n\nPremier paragraphe avec 42 tests et 90 % de réussite.\n\n```js\nconst x = 100;\n```\n\nPublié en 2026 sans autre chiffre.\n\n' +
    'Un long paragraphe sans le moindre nombre, qui sert à dépasser le seuil du corps court. '.repeat(12),
  excerpt: 'Un extrait court.',
  tags: ['Node', 'sécurité', 'node', 'Machine Learning'],
  published: true,
  publishedAt: new Date('2026-05-02T10:00:00Z'),
  createdAt: new Date('2026-05-01T10:00:00Z'),
  views: 12,
  oldSlugs: ['un-titre-ancien'],
  socialPosted: {
    linkedin: { status: 'posted', postedAt: new Date('2026-05-03T08:00:00Z'), postUrn: 'urn:li:share:1' },
    x: { status: 'pending' },
  },
};

describe('toYaml', () => {
  it('échappe guillemets, antislashs et retours à la ligne', () => {
    expect(toYaml({ t: 'a "b" \\ c\nd' })).toBe('t: "a \\"b\\" \\\\ c\\nd"');
  });
  it('sérialise dates, booléens, tableaux et objets imbriqués', () => {
    const y = toYaml({ d: new Date('2026-05-02T23:59:00Z'), b: true, l: ['x', 1], o: { k: 'v' }, vide: undefined });
    expect(y).toBe('d: 2026-05-02\nb: true\nl: ["x", 1]\no:\n  k: "v"');
  });
});

describe('normaliserTags', () => {
  it('minuscules, sans accent, sans doublon, espaces en tirets', () => {
    expect(normaliserTags(['Node', 'sécurité', 'node', 'Machine Learning', ' '])).toEqual([
      'node', 'securite', 'machine-learning',
    ]);
  });
  it('tolère un tableau absent', () => {
    expect(normaliserTags(undefined)).toEqual([]);
  });
});

describe('tronquer', () => {
  it('ne touche pas une chaîne courte', () => {
    expect(tronquer('court', 10)).toBe('court');
  });
  it('coupe sur un espace et ajoute des points de suspension sans dépasser', () => {
    const r = tronquer('un deux trois quatre cinq six sept', 20);
    expect(r.length).toBeLessThanOrEqual(20);
    expect(r.endsWith('…')).toBe(true);
    expect(r).toBe('un deux trois…');
  });
});

describe('retirerH1', () => {
  it('retire le H1 qui répète le titre, accents et casse ignorés', () => {
    const { corps, signalement } = retirerH1('# Sécurité API\n\ncorps', 'securite api');
    expect(corps).toBe('corps');
    expect(signalement).toBeNull();
  });
  it('retire aussi un titre répété en H2', () => {
    expect(retirerH1('## Titre\n\ncorps', 'Titre').corps).toBe('corps');
  });
  it('conserve et signale un H1 différent', () => {
    const { corps, signalement } = retirerH1('# Autre\n\ncorps', 'Titre');
    expect(corps).toBe('# Autre\n\ncorps');
    expect(signalement).toMatch(/Autre/);
  });
  it('ne fait rien sans H1', () => {
    expect(retirerH1('corps seul', 'Titre').corps).toBe('corps seul');
  });
});

describe('pointsAVerifier', () => {
  it('retient les phrases chiffrées hors code et hors années seules', () => {
    const r = pointsAVerifier(base.content.replace(/^# .*\n+/, ''));
    expect(r).toEqual(['Premier paragraphe avec 42 tests et 90 % de réussite.']);
  });
  it('renvoie une liste vide sans chiffre', () => {
    expect(pointsAVerifier('Rien à signaler ici.')).toEqual([]);
  });
  it('retire la puce d’une ligne de liste', () => {
    expect(pointsAVerifier('- La latence : 5 secondes.')).toEqual(['La latence : 5 secondes.']);
  });
});

describe('convertir', () => {
  it('produit un frontmatter gnaro.fr complet avec la trace de migration', () => {
    const { fichier, frontmatter, corps, signalements } = convertir(base);
    expect(fichier).toBe('un-titre.md');
    expect(frontmatter.draft).toBe(true);
    expect(frontmatter.aiAssisted).toBe(true);
    expect(frontmatter.description).toBe('Un extrait court.');
    expect(frontmatter.pubDate).toEqual(base.publishedAt);
    expect(frontmatter.tags).toEqual(['node', 'securite', 'machine-learning']);
    expect(frontmatter.migration.linkedin.postUrn).toBe('urn:li:share:1');
    expect(frontmatter.migration.x).toBeUndefined();
    expect(frontmatter.migration.oldSlugs).toEqual(['un-titre-ancien']);
    expect(corps.startsWith('Premier paragraphe')).toBe(true);
    expect(signalements).toEqual([]);
  });
  it('signale liens gcn-data, HTML, extrait absent, et prend la date de création en repli', () => {
    const a = {
      ...base,
      excerpt: undefined,
      published: false,
      publishedAt: undefined,
      content: 'Voir <br> https://gcn-data.fr/blog/x et un paragraphe assez long pour servir de description ici.',
      socialPosted: undefined,
    };
    const { frontmatter, signalements } = convertir(a);
    expect(frontmatter.pubDate).toEqual(base.createdAt);
    expect(frontmatter.description.length).toBeLessThanOrEqual(160);
    expect(frontmatter.migration.linkedin).toBeUndefined();
    expect(signalements).toEqual(
      expect.arrayContaining([expect.stringMatching(/gcn-data/), 'HTML brut dans le corps', expect.stringMatching(/extrait/)])
    );
  });
  it('signale un corps trop court pour être un article', () => {
    const { signalements } = convertir({ ...base, content: '# Un titre suffisamment long pour le schéma\n\nDeux lignes.' });
    expect(signalements).toEqual([expect.stringMatching(/corps très court \(\d+ caractères\)/)]);
  });
  it('coupe un extrait trop long à 160 caractères et le signale', () => {
    const { frontmatter, signalements } = convertir({ ...base, excerpt: 'mot '.repeat(60) });
    expect(frontmatter.description.length).toBeLessThanOrEqual(160);
    expect(signalements).toContain('extrait coupé à 160 caractères');
  });
});

describe('enMarkdown', () => {
  it('assemble un fichier lisible par un parseur de frontmatter', () => {
    const md = enMarkdown(convertir(base));
    expect(md.startsWith('---\ntitle: "Un titre')).toBe(true);
    expect(md).toMatch(/\n---\n\nPremier paragraphe/);
    expect(md).toContain('pubDate: 2026-05-02');
  });
});

describe('doublonsProbables', () => {
  it('rapproche deux titres qui partagent la moitié de leurs mots', () => {
    const r = doublonsProbables([
      { slug: 'a', title: 'Déployer un bot de trading Python sur Fly.io' },
      { slug: 'b', title: 'Déployer un bot Python 24/7 sur Fly.io : les pièges' },
      { slug: 'c', title: 'Authentification JWT dans Express' },
    ]);
    expect(r.a).toEqual(['b']);
    expect(r.b).toEqual(['a']);
    expect(r.c).toBeUndefined();
  });
});
