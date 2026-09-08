// Table des redirections 301 : la fonction destinationPour est la référence
// lisible de la règle que Caddy applique (bloc généré par generer-caddy.js,
// testé dans caddyRedirections.test.js).

import { describe, it, expect } from 'vitest';

const { destinationPour, ARTICLES, REPLI_BLOG } = require('../config/redirections');

describe('destinationPour', () => {
  it('connaît les pages fixes, avec ou sans slash final', () => {
    expect(destinationPour('/projects')).toBe('https://gnaro.fr/projets/');
    expect(destinationPour('/projects/')).toBe('https://gnaro.fr/projets/');
    expect(destinationPour('/stack')).toBe('https://gnaro.fr/projets/');
    expect(destinationPour('/rss.xml')).toBe('https://gnaro.fr/rss.xml');
    expect(destinationPour('/sitemap.xml')).toBe('https://gnaro.fr/sitemap-index.xml');
    expect(destinationPour('/blog')).toBe('https://gnaro.fr/blog/');
    expect(destinationPour('/blog///')).toBe('https://gnaro.fr/blog/');
  });

  it('replie un article inconnu sur l’index du blog, même avec un sous-chemin', () => {
    expect(destinationPour('/blog/un-article')).toBe(REPLI_BLOG);
    expect(destinationPour('/blog/un-article/')).toBe(REPLI_BLOG);
    expect(destinationPour('/blog/un-article/commentaires')).toBe(REPLI_BLOG);
    expect(destinationPour(`/blog/${'a'.repeat(5000)}`)).toBe(REPLI_BLOG);
  });

  it('suit la carte des articles migrés, insensible à la casse et à l’encodage', () => {
    ARTICLES['ancien-slug'] = 'nouveau-slug';
    ARTICLES['déjà-accentué'] = 'deja-accentue';
    try {
      expect(destinationPour('/blog/ancien-slug')).toBe('https://gnaro.fr/blog/nouveau-slug/');
      expect(destinationPour('/blog/Ancien-Slug/')).toBe('https://gnaro.fr/blog/nouveau-slug/');
      expect(destinationPour('/blog/d%C3%A9j%C3%A0-accentu%C3%A9')).toBe('https://gnaro.fr/blog/deja-accentue/');
    } finally {
      delete ARTICLES['ancien-slug'];
      delete ARTICLES['déjà-accentué'];
    }
  });

  it('replie sans planter sur un encodage invalide', () => {
    expect(destinationPour('/blog/%E0%A4%A')).toBe(REPLI_BLOG);
  });

  it('ignore tout le reste', () => {
    for (const c of ['/', '/login', '/dashboard', '/admin/gnaro', '/robots.txt', '/blogue', '/blog-2', '/api/blog', '/projectsX']) {
      expect(destinationPour(c)).toBeNull();
    }
  });
});
