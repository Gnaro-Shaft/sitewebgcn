// Redirections des anciennes URL publiques vers gnaro.fr : table pure, puis
// middleware monté dans une application Express nue (pas de base, pas de
// réseau). Une route témoin derrière le middleware prouve qu'il laisse
// passer ce qui ne le concerne pas.

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

const { destinationPour, ARTICLES, REPLI_BLOG } = require('../config/redirections');
const { redirectionsGnaro } = require('../middleware/redirectionsGnaro');

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

describe('middleware redirectionsGnaro', () => {
  const app = express();
  app.use(redirectionsGnaro);
  app.all(/.*/, (req, res) => res.status(200).send(`passe:${req.method}:${req.path}`));

  it('répond 301 vers gnaro.fr, chaîne de requête perdue, cache d’un jour', async () => {
    const r = await request(app).get('/blog/mon-article?utm_source=linkedin');
    expect(r.status).toBe(301);
    expect(r.headers.location).toBe('https://gnaro.fr/blog/');
    expect(r.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('redirige aussi HEAD', async () => {
    const r = await request(app).head('/projects');
    expect(r.status).toBe(301);
    expect(r.headers.location).toBe('https://gnaro.fr/projets/');
  });

  it('laisse passer POST, PUT et DELETE sur une ancienne URL', async () => {
    for (const m of ['post', 'put', 'delete']) {
      const r = await request(app)[m]('/blog/mon-article');
      expect(r.status).toBe(200);
      expect(r.text).toMatch(/^passe:/);
    }
  });

  it('ne touche jamais à /api ni aux pages du tableau de bord', async () => {
    for (const c of ['/api/projects', '/api/blog', '/dashboard', '/login', '/']) {
      const r = await request(app).get(c);
      expect(r.status).toBe(200);
      expect(r.text).toBe(`passe:GET:${c}`);
    }
  });
});
