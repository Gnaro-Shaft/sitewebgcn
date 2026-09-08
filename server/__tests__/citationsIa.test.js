// Parseur du suivi des citations : Markdown synthétique, aucun réseau.

import { describe, it, expect, vi, afterEach } from 'vitest';

const { parserCitations, resumer, lireCellule } = require('../services/citationsIa');

const MD = `# Suivi des citations

## Méthode

Blabla.

## Requêtes cibles

| N° | Requête | Article |
| --- | --- | --- |
| 1 | Combien coûte un assistant IA ? | /blog/cout/ |
| 2 | RAG ou fine-tuning ? | /blog/rag/ |
| 3 | Données chez OpenAI ? | /blog/donnees/ |

## Relevés

### 2026-09-08 — état de référence

Texte libre avant la table.

| N° | Perplexity | ChatGPT | Claude | Google (aperçu IA) |
| --- | --- | --- | --- | --- |
| 1 | non | non | non | non (aperçu présent) |
| 2 | non | non | non | non (pas d'aperçu) |
| 3 | non | non | non | non (aperçu présent) |

### 2026-09-08 — relevé mensuel (rodage)

| N° | Perplexity | ChatGPT | Claude | Google (aperçu IA) |
| --- | --- | --- | --- | --- |
| 1 | non | non | non | non (aperçu présent) |

### 2026-10-01 — relevé mensuel

| N° | Perplexity | ChatGPT | Claude | Google (aperçu IA) |
| --- | --- | --- | --- | --- |
| 1 | oui | non | non vérifié : limite | partiel (aperçu présent) |
| 2 | partiel | non | non | non (pas d'aperçu) |
| 3 | non vérifié : limite | Oui | non | non |
`;

describe('lireCellule', () => {
  it('normalise les valeurs et lit la présence d’aperçu', () => {
    expect(lireCellule('non (aperçu présent)')).toEqual({ valeur: 'non', apercu: true });
    expect(lireCellule("non (pas d'aperçu)")).toEqual({ valeur: 'non', apercu: false });
    expect(lireCellule('non vérifié : limite')).toEqual({ valeur: 'non_verifie', apercu: null });
    expect(lireCellule('Oui')).toEqual({ valeur: 'oui', apercu: null });
    expect(lireCellule('partiel')).toEqual({ valeur: 'partiel', apercu: null });
    expect(lireCellule('')).toEqual({ valeur: 'inconnu', apercu: null });
  });
});

describe('parserCitations', () => {
  const p = parserCitations(MD);
  it('lit les requêtes cibles', () => {
    expect(p.requetes).toEqual([
      { n: 1, requete: 'Combien coûte un assistant IA ?', article: '/blog/cout/' },
      { n: 2, requete: 'RAG ou fine-tuning ?', article: '/blog/rag/' },
      { n: 3, requete: 'Données chez OpenAI ?', article: '/blog/donnees/' },
    ]);
  });
  it('lit trois relevés, deux le même jour, triés par date', () => {
    expect(p.releves.map((r) => [r.date, r.titre])).toEqual([
      ['2026-09-08', 'état de référence'], ['2026-09-08', 'relevé mensuel (rodage)'], ['2026-10-01', 'relevé mensuel'],
    ]);
    expect(Object.keys(p.releves[1].resultats)).toEqual(['1']);
    expect(p.releves[2].resultats[1].claude).toEqual({ valeur: 'non_verifie', apercu: null });
    expect(p.releves[2].resultats[1].google).toEqual({ valeur: 'partiel', apercu: true });
  });
  it('ne plante pas sans table ni relevé', () => {
    expect(parserCitations('# Rien')).toEqual({ requetes: [], releves: [] });
    expect(parserCitations('')).toEqual({ requetes: [], releves: [] });
  });
});

describe('resumer', () => {
  it('compte le dernier relevé par système, compare au précédent, trace l’historique par requête', () => {
    const r = resumer(parserCitations(MD));
    expect(r.vide).toBe(false);
    expect(r.dernier.date).toBe('2026-10-01');
    expect(r.dernier.parSysteme.perplexity).toEqual({ oui: 1, partiel: 1, non: 0, nonVerifie: 1 });
    expect(r.dernier.parSysteme.chatgpt).toEqual({ oui: 1, partiel: 0, non: 2, nonVerifie: 0 });
    expect(r.dernier.total).toBe(4); // perplexity oui+partiel, chatgpt oui, google partiel
    expect(r.precedent).toEqual({ date: '2026-09-08', total: 0 });
    expect(r.evolution).toBe(4);
    expect(r.nbReleves).toBe(3);
    expect(r.requetes[0].historique.map((h) => h.citee)).toEqual([false, false, true]);
    expect(r.requetes[1].historique[1].citee).toBe(false); // absente du relevé de rodage
  });
  it('signale un fichier sans relevé', () => {
    expect(resumer(parserCitations('## Requêtes cibles\n| N° | R | A |\n| 1 | q | /a/ |')).vide).toBe(true);
  });
});

describe('lireFichierDepot', () => {
  const repo = require('../services/gnaroRepo');
  const origFetch = global.fetch;
  const origToken = process.env.GNARO_GITHUB_TOKEN;
  afterEach(() => { global.fetch = origFetch; process.env.GNARO_GITHUB_TOKEN = origToken; });

  it('lit un fichier par son chemin et décode le contenu', async () => {
    process.env.GNARO_GITHUB_TOKEN = 'jeton-test';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ sha: 'abc', content: Buffer.from('# Bonjour').toString('base64') }) });
    const r = await repo.lireFichierDepot('docs/suivi/citations.md');
    expect(r).toEqual({ sha: 'abc', brut: '# Bonjour' });
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/contents\/docs\/suivi\/citations\.md\?ref=/);
  });
  it('refuse un chemin qui remonte', async () => {
    process.env.GNARO_GITHUB_TOKEN = 'jeton-test';
    await expect(repo.lireFichierDepot('../.env')).rejects.toMatchObject({ statusCode: 400 });
  });
});
