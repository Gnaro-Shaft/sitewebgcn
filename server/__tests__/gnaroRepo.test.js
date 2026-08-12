// Tests des fonctions pures de gnaroRepo — ni réseau, ni base.
//
// Ces deux fonctions décident du contenu écrit dans le dépôt Git de gnaro.fr.
// Une expression régulière trop gourmande y corromprait un article publié,
// et l'erreur ne se verrait qu'en ligne. D'où ces cas limites.

import { describe, it, expect } from 'vitest';

const { lireFrontmatter, appliquerPublication } = require('../services/gnaroRepo');

const brouillon = [
  '---',
  'title: "Un titre avec des \\"guillemets\\" dedans"',
  'description: "Une description : deux-points, virgule."',
  'pubDate: 2026-08-12',
  'tags: ["rag", "llm"]',
  'draft: true',
  'aiAssisted: true',
  'aVerifier:',
  '  - "42 % (pourcentage) — contexte, avec virgule"',
  '  - "« un client » suggère une mission — autre [contexte]"',
  '---',
  '',
  'Le corps de l\'article.',
].join('\n');

describe('lireFrontmatter', () => {
  it('lit les champs du pipeline, guillemets échappés compris', () => {
    const { donnees } = lireFrontmatter(brouillon);
    expect(donnees.title).toBe('Un titre avec des "guillemets" dedans');
    expect(donnees.draft).toBe(true);
    expect(donnees.aiAssisted).toBe(true);
    expect(donnees.tags).toEqual(['rag', 'llm']);
    expect(donnees.aVerifier).toHaveLength(2);
    expect(donnees.aVerifier[0]).toContain('42 %');
  });

  it('sépare le corps du frontmatter', () => {
    expect(lireFrontmatter(brouillon).corps.trim()).toBe("Le corps de l'article.");
  });

  it('accepte un article écrit à la main, sans aVerifier', () => {
    const { donnees } = lireFrontmatter('---\ntitle: "A"\ndraft: true\n---\nCorps.');
    expect(donnees.draft).toBe(true);
    expect(donnees.aVerifier).toBeUndefined();
  });

  it('ne jette pas sur un fichier sans frontmatter', () => {
    const { donnees, corps } = lireFrontmatter('Juste du texte.');
    expect(donnees).toEqual({});
    expect(corps).toBe('Juste du texte.');
  });
});

describe('appliquerPublication', () => {
  it('bascule draft et vide aVerifier', () => {
    const { contenu } = appliquerPublication(brouillon);
    const entete = contenu.split('---')[1];
    expect(entete).toMatch(/^draft: false$/m);
    expect(entete).toMatch(/^aVerifier: \[\]$/m);
  });

  it('ne retire JAMAIS aiAssisted', () => {
    // La mention de transparence de l'article 50 du règlement (UE) 2024/1689
    // ne disparaît pas au moment de publier. C'est le point le plus important
    // de ce fichier.
    expect(appliquerPublication(brouillon).contenu).toMatch(/^aiAssisted: true$/m);
  });

  it('ne touche pas au corps, même s\'il contient « draft: true »', () => {
    const piege = [
      '---', 'title: "A"', 'draft: true', '---', '',
      'Un texte qui parle de draft: true.', '',
      '```yaml', 'draft: true', 'aVerifier:', '  - piege', '```',
    ].join('\n');
    const { contenu } = appliquerPublication(piege);
    const [, entete, corps] = contenu.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    // Seul le frontmatter est modifié.
    expect(entete).toMatch(/^draft: false$/m);
    expect(entete).not.toMatch(/draft: true/);

    // Le corps ressort intact : la phrase ET le bloc de code gardent leur
    // « draft: true », qui n'est que du texte.
    expect(corps).toContain('Un texte qui parle de draft: true.');
    expect(corps).toContain('  - piege');
    expect(corps.match(/draft: true/g)).toHaveLength(2);
  });

  it('gère aVerifier en liste sur une ligne', () => {
    const src = '---\ntitle: "A"\ndraft: true\naVerifier: ["42 %"]\n---\nCorps.';
    expect(appliquerPublication(src).contenu).toMatch(/^aVerifier: \[\]$/m);
  });

  it('refuse un article déjà publié', () => {
    const src = '---\ntitle: "A"\ndraft: false\n---\nCorps.';
    expect(() => appliquerPublication(src)).toThrow(/pas un brouillon/);
  });

  it('refuse un fichier sans champ draft', () => {
    expect(() => appliquerPublication('---\ntitle: "A"\n---\nCorps.')).toThrow();
  });

  it('refuse un fichier sans frontmatter plutôt que de deviner', () => {
    expect(() => appliquerPublication('Juste du texte.')).toThrow();
  });

  it('expose un statut 422 exploitable par l\'API', () => {
    try {
      appliquerPublication('---\ntitle: "A"\ndraft: false\n---\nCorps.');
      throw new Error('aurait dû jeter');
    } catch (e) {
      expect(e.statusCode).toBe(422);
    }
  });
});
