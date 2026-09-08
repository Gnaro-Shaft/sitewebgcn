// Le bloc Caddy commité doit être celui que produit la table des redirections.
// Sinon, Express (Fly) et Caddy (VPS) divergent sans que personne ne le voie.

import { describe, it, expect } from 'vitest';
import fs from 'fs';

const { bloc, SORTIE } = require('../../deploy/serveur/generer-caddy.js');
const { PAGES, REPLI_BLOG } = require('../config/redirections');

describe('bloc Caddy gcn-data.fr', () => {
  const texte = bloc();

  it('est identique au fichier commité (relancer generer-caddy.js sinon)', () => {
    expect(fs.readFileSync(SORTIE, 'utf8')).toBe(texte);
  });

  it('redirige chaque page fixe, avec et sans slash, et replie le blog', () => {
    for (const [chemin, cible] of Object.entries(PAGES)) {
      if (chemin === '/blog') continue;
      expect(texte).toContain(`redir ${chemin} ${cible} permanent`);
      expect(texte).toContain(`redir ${chemin}/ ${cible} permanent`);
    }
    expect(texte).toContain('@blog path /blog /blog/ /blog/*');
    expect(texte).toContain(`redir @blog ${REPLI_BLOG} permanent`);
  });

  it('proxifie vers le service local et borne les journaux à quatorze jours', () => {
    expect(texte).toContain('reverse_proxy 127.0.0.1:8080');
    expect(texte).toContain('roll_keep_for 336h');
    expect(texte).not.toMatch(/Content-Security-Policy/);
  });
});
