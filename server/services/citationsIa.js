// Citations de gnaro.fr par les assistants d'IA : lecture de
// docs/suivi/citations.md dans le dépôt gnaro, relevé à la main une fois par
// mois (voir la méthode décrite dans le fichier lui-même).
//
// Le Markdown est la source ; ici on le lit, on ne l'écrit jamais. Format
// attendu : une table « Requêtes cibles » (N°, Requête, Article), puis des
// sections « ### AAAA-MM-JJ — titre » contenant chacune une table
// N° | Perplexity | ChatGPT | Claude | Google (aperçu IA). Une cellule vaut
// oui, partiel, non, ou « non vérifié : … », parfois suivie d'une
// parenthèse (« non (aperçu présent) »).

const gnaro = require('./gnaroRepo');

const CHEMIN = 'docs/suivi/citations.md';
const SYSTEMES = ['perplexity', 'chatgpt', 'claude', 'google'];
const CACHE_MS = 10 * 60 * 1000;

function cellules(ligne) {
  return ligne.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

// « non (aperçu présent) » → { valeur: 'non', apercu: true }
function lireCellule(texte) {
  const t = String(texte || '').toLowerCase();
  let valeur = 'inconnu';
  if (t.startsWith('oui')) valeur = 'oui';
  else if (t.startsWith('partiel')) valeur = 'partiel';
  else if (t.startsWith('non vérifié') || t.startsWith('non verifie')) valeur = 'non_verifie';
  else if (t.startsWith('non')) valeur = 'non';
  let apercu = null;
  if (/aperçu présent|apercu present/.test(t)) apercu = true;
  else if (/pas d.aperçu|pas d.apercu/.test(t)) apercu = false;
  return { valeur, apercu };
}

// Lignes de table dont la première cellule est un numéro.
function lignesNumerotees(bloc) {
  return bloc.split('\n').map(cellules).filter((c) => /^\d+$/.test(c[0] || ''));
}

function parserCitations(md) {
  const texte = String(md || '').replace(/\r\n/g, '\n');
  const requetes = [];
  const mReq = texte.match(/## Requêtes cibles\n([\s\S]*?)(?=\n## |$)/);
  if (mReq) {
    for (const c of lignesNumerotees(mReq[1])) {
      requetes.push({ n: Number(c[0]), requete: c[1] || '', article: c[2] || '' });
    }
  }
  const releves = [];
  const partie = texte.split(/\n## Relevés\n/)[1] || '';
  for (const section of partie.split(/\n(?=### )/)) {
    const m = section.match(/^### (\d{4}-\d{2}-\d{2})\s*(?:[—-]\s*(.*))?$/m);
    if (!m) continue;
    const resultats = {};
    for (const c of lignesNumerotees(section)) {
      if (c.length < 5) continue;
      resultats[Number(c[0])] = Object.fromEntries(SYSTEMES.map((s, i) => [s, lireCellule(c[i + 1])]));
    }
    if (Object.keys(resultats).length === 0) continue;
    releves.push({ date: m[1], titre: (m[2] || '').trim(), resultats });
  }
  releves.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { requetes, releves };
}

const cite = (v) => v === 'oui' || v === 'partiel';

function decompte(releve) {
  const parSysteme = Object.fromEntries(SYSTEMES.map((s) => [s, { oui: 0, partiel: 0, non: 0, nonVerifie: 0 }]));
  for (const r of Object.values(releve.resultats)) {
    for (const s of SYSTEMES) {
      const v = r[s]?.valeur;
      if (v === 'oui') parSysteme[s].oui++;
      else if (v === 'partiel') parSysteme[s].partiel++;
      else if (v === 'non_verifie') parSysteme[s].nonVerifie++;
      else if (v === 'non') parSysteme[s].non++;
    }
  }
  const total = Object.values(parSysteme).reduce((n, x) => n + x.oui + x.partiel, 0);
  return { parSysteme, total, requetes: Object.keys(releve.resultats).length };
}

function resumer({ requetes, releves }) {
  if (releves.length === 0) return { vide: true, requetes, releves: [] };
  const dernier = releves[releves.length - 1];
  const precedent = releves.length > 1 ? releves[releves.length - 2] : null;
  const d = decompte(dernier);
  const p = precedent ? decompte(precedent) : null;
  return {
    vide: false,
    dernier: { date: dernier.date, titre: dernier.titre, ...d },
    precedent: p ? { date: precedent.date, total: p.total } : null,
    evolution: p ? d.total - p.total : null,
    nbReleves: releves.length,
    requetes: requetes.map((q) => ({
      ...q,
      dernier: dernier.resultats[q.n] || null,
      historique: releves.map((r) => ({ date: r.date, citee: SYSTEMES.some((s) => cite(r.resultats[q.n]?.[s]?.valeur)) })),
    })),
  };
}

let cache = null;
async function citations() {
  if (cache && Date.now() - cache.quand < CACHE_MS) return cache.contenu;
  const { brut } = await gnaro.lireFichierDepot(CHEMIN);
  const contenu = resumer(parserCitations(brut));
  cache = { quand: Date.now(), contenu };
  return contenu;
}

module.exports = { parserCitations, resumer, citations, lireCellule, SYSTEMES, CHEMIN };
