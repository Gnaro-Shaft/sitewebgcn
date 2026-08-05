// Tests de la translittération des slugs.
// Avant correction, « Déployer » devenait « d-ployer » : chaque mot accentué
// était détruit dans l'URL, donc aucun mot-clé français n'était indexable.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/botDb', () => ({ getBotConnection: () => null }));

const Article = require('../models/Article');
const slugify = Article.slugify;

describe('slugify', () => {
  it('translittère les accents au lieu de les remplacer par des tirets', () => {
    expect(slugify('Déployer un bot')).toBe('deployer-un-bot');
    expect(slugify('Générer des vidéos')).toBe('generer-des-videos');
    expect(slugify('Réentraîner un modèle')).toBe('reentrainer-un-modele');
    expect(slugify('User-Agent honnête')).toBe('user-agent-honnete');
    expect(slugify('Requêtes HTTP')).toBe('requetes-http');
  });

  it('gère la cédille, le tréma et les ligatures courantes', () => {
    expect(slugify('Ça marche')).toBe('ca-marche');
    expect(slugify('Noël en août')).toBe('noel-en-aout');
    expect(slugify('Où ça')).toBe('ou-ca');
  });

  it('ne produit jamais de tiret en début ou en fin', () => {
    expect(slugify('  ---Bonjour---  ')).toBe('bonjour');
    expect(slugify('!!! Attention !!!')).toBe('attention');
  });

  it('regroupe les séparateurs consécutifs en un seul tiret', () => {
    expect(slugify('A  —  B')).toBe('a-b');
    expect(slugify('Claude + ElevenLabs + Remotion')).toBe('claude-elevenlabs-remotion');
  });

  it('conserve les chiffres', () => {
    expect(slugify('Déployer 24/7 sur Fly.io')).toBe('deployer-24-7-sur-fly-io');
    expect(slugify('Passer de 30 % à 90 %')).toBe('passer-de-30-a-90');
  });

  it('accepte une entrée non-string sans planter', () => {
    expect(slugify(42)).toBe('42');
    expect(typeof slugify('')).toBe('string');
  });

  it('produit un slug stable (même entrée, même sortie)', () => {
    const t = 'Réentraîner un modèle ML toutes les 6h en production';
    expect(slugify(t)).toBe(slugify(t));
  });

  it('ne laisse plus aucun mot-clé tronqué sur les titres réels du blog', () => {
    const titres = [
      'Générer des vidéos TikTok avec Claude + ElevenLabs + Remotion',
      'Déployer un bot de trading 24/7 sur Fly.io : les pièges du réseau',
      'Réentraîner un modèle ML toutes les 6h en production',
    ];
    for (const t of titres) {
      const s = slugify(t);
      // Aucun tiret isolé résultant d'un accent supprimé (ex: « d-ployer »)
      expect(s).not.toMatch(/\b[a-z]-[a-z]{2,}/);
      expect(s).not.toContain('--');
    }
  });
});
