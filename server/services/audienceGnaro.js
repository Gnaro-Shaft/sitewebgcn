// Audience de gnaro.fr : lecture des agrégats calculés chaque nuit sur le VPS
// par deploy/serveur/audience.py du dépôt gnaro (dossier /var/lib/gnaro/audience).
//
// Ce ne sont que des comptes par jour : aucune adresse IP, aucun identifiant,
// aucun agent utilisateur. Le tableau de bord ne fait que les relire ; il ne
// mesure rien lui-même. Sans les fichiers (poste de développement, autre
// machine), la route répond 503 avec un message clair.
//
// Deux fichiers :
//   audience.csv  jour, pages_vues, contact_vues, ref_<origine>…, robot_<nom>…
//   pages.csv     jour, page, vues

const fs = require('fs/promises');
const path = require('path');

const DOSSIER = process.env.AUDIENCE_DIR || '/var/lib/gnaro/audience';
const CACHE_MS = 5 * 60 * 1000; // les fichiers changent une fois par nuit

// Regroupement des colonnes d'origine en familles lisibles.
const ORIGINES = {
  ia: ['ref_chatgpt', 'ref_perplexity', 'ref_claude', 'ref_gemini', 'ref_copilot'],
  moteurs: ['ref_moteurs'],
  linkedin: ['ref_linkedin'],
  plateformes: ['ref_malt', 'ref_freework'],
  autres: ['ref_autres'],
  direct: ['ref_aucun'],
};
const ROBOTS = {
  ia: ['robot_gptbot', 'robot_oai_searchbot', 'robot_claudebot', 'robot_perplexitybot', 'robot_google_extended'],
  moteurs: ['robot_googlebot', 'robot_bingbot'],
};

// CSV → tableau d'objets. Tolère BOM, CRLF, lignes vides ; ignore une ligne
// dont le nombre de colonnes ne correspond pas à l'en-tête plutôt que de tout
// rejeter : un jour malformé ne doit pas cacher les autres.
function parserCsv(texte) {
  const lignes = String(texte || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length === 0) return [];
  const colonnes = lignes[0].split(',').map((c) => c.trim());
  const rangs = [];
  for (const l of lignes.slice(1)) {
    const cases = l.split(',');
    if (cases.length !== colonnes.length) continue;
    const o = {};
    colonnes.forEach((c, i) => {
      const v = cases[i].trim();
      o[c] = c === 'jour' || c === 'page' ? v : Number(v);
      if (typeof o[c] === 'number' && !Number.isFinite(o[c])) o[c] = 0;
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.jour)) continue;
    rangs.push(o);
  }
  return rangs.sort((a, b) => (a.jour < b.jour ? -1 : 1));
}

const somme = (o, cles) => cles.reduce((n, c) => n + (o[c] || 0), 0);
const total = (rangs, f) => rangs.reduce((n, r) => n + f(r), 0);

// Résumé sur les `jours` derniers jours présents dans le fichier, comparé à la
// période de même longueur qui précède. On raisonne sur les jours PRÉSENTS :
// un jour sans trafic n'est pas écrit par audience.py, on ne l'invente pas.
function resumer(audience, pages, jours) {
  const n = Math.max(1, Math.min(365, Number(jours) || 30));
  const tous = parserCsv(audience);
  const rangsPages = parserCsv(pages);
  if (tous.length === 0) return { jours: n, vide: true, serie: [], pages: [], origines: {}, robots: {} };

  const dernier = tous[tous.length - 1].jour;
  const debut = decaler(dernier, -(n - 1));
  const debutAvant = decaler(debut, -n);
  const periode = tous.filter((r) => r.jour >= debut);
  const avant = tous.filter((r) => r.jour >= debutAvant && r.jour < debut);

  const vues = total(periode, (r) => r.pages_vues);
  const vuesAvant = total(avant, (r) => r.pages_vues);
  const origines = Object.fromEntries(Object.entries(ORIGINES).map(([k, cles]) => [k, total(periode, (r) => somme(r, cles))]));
  const robots = Object.fromEntries(Object.entries(ROBOTS).map(([k, cles]) => [k, total(periode, (r) => somme(r, cles))]));

  const parPage = new Map();
  for (const r of rangsPages) {
    if (r.jour < debut || r.jour > dernier) continue;
    parPage.set(r.page, (parPage.get(r.page) || 0) + r.vues);
  }
  const listePages = [...parPage.entries()]
    .map(([page, v]) => ({ page, vues: v, part: vues ? Math.round((1000 * v) / vues) / 10 : 0 }))
    .sort((a, b) => b.vues - a.vues);

  return {
    jours: n,
    vide: false,
    du: periode[0]?.jour || debut,
    au: dernier,
    vues,
    contact: total(periode, (r) => r.contact_vues),
    variation: vuesAvant ? Math.round((1000 * (vues - vuesAvant)) / vuesAvant) / 10 : null,
    joursAvecTrafic: periode.length,
    origines,
    robots,
    serie: periode.map((r) => ({
      jour: r.jour,
      vues: r.pages_vues,
      contact: r.contact_vues,
      ia: somme(r, ORIGINES.ia),
      moteurs: somme(r, ORIGINES.moteurs),
      linkedin: somme(r, ORIGINES.linkedin),
    })),
    pages: listePages,
  };
}

// AAAA-MM-JJ décalé de `d` jours, en UTC : les jours du fichier sont des
// étiquettes calendaires, pas des instants.
function decaler(jour, d) {
  const t = new Date(`${jour}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
}

let cache = null;
async function lireFichiers() {
  if (cache && Date.now() - cache.quand < CACHE_MS) return cache.contenu;
  let audience;
  let pages;
  try {
    [audience, pages] = await Promise.all([
      fs.readFile(path.join(DOSSIER, 'audience.csv'), 'utf8'),
      fs.readFile(path.join(DOSSIER, 'pages.csv'), 'utf8'),
    ]);
  } catch (err) {
    const e = new Error(`Audience indisponible : ${DOSSIER} illisible (${err.code || err.message}).`);
    e.statusCode = 503;
    throw e;
  }
  cache = { quand: Date.now(), contenu: { audience, pages } };
  return cache.contenu;
}

async function resume(jours) {
  const { audience, pages } = await lireFichiers();
  return resumer(audience, pages, jours);
}

module.exports = { parserCsv, resumer, resume, decaler, DOSSIER, ORIGINES, ROBOTS };
