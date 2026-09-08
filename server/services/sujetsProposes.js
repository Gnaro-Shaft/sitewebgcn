// Dernière proposition de sujets du pipeline de rédaction de gnaro.fr, lue
// dans docs/suivi/sujets-proposes.json du dépôt (copie déposée par
// scripts/choisir-sujets.mjs après la décision). Lecture seule.
//
// Le fichier peut ne pas exister encore : la première proposition publiée
// le créera. On distingue ce cas d'une panne.

const gnaro = require('./gnaroRepo');

const CHEMIN = 'docs/suivi/sujets-proposes.json';
const CACHE_MS = 5 * 60 * 1000;

// Objet brut → forme servie. Refuse ce qui n'a pas la forme attendue.
function normaliser(brut) {
  let o;
  try {
    o = typeof brut === 'string' ? JSON.parse(brut) : brut;
  } catch {
    const e = new Error('Fichier des sujets illisible (JSON invalide).');
    e.statusCode = 502;
    e.expose = true;
    throw e;
  }
  if (!o || !Array.isArray(o.candidats)) {
    const e = new Error('Fichier des sujets sans liste de candidats.');
    e.statusCode = 502;
    e.expose = true;
    throw e;
  }
  const retenu = Number.isInteger(o.retenu) ? o.retenu : null;
  return {
    proposeLe: o.proposeLe || null,
    publieLe: o.publieLe || null,
    refuse: Boolean(o.refuse),
    reponse: typeof o.reponse === 'string' ? o.reponse : null,
    retenu,
    candidats: o.candidats.map((c, i) => ({
      projet: String(c.projet || ''),
      titre: String(c.titre || ''),
      angle: String(c.angle || ''),
      pourquoi: String(c.pourquoi || ''),
      retenu: retenu === i && !o.refuse,
    })),
  };
}

let cache = null;
async function derniere() {
  if (cache && Date.now() - cache.quand < CACHE_MS) return cache.contenu;
  let brut;
  try {
    ({ brut } = await gnaro.lireFichierDepot(CHEMIN));
  } catch (e) {
    if (e.statusCode === 404) {
      const contenu = { absente: true };
      cache = { quand: Date.now(), contenu };
      return contenu;
    }
    throw e;
  }
  const contenu = { absente: false, ...normaliser(brut) };
  cache = { quand: Date.now(), contenu };
  return contenu;
}

module.exports = { normaliser, derniere, CHEMIN };
