// Accès aux brouillons d'articles du site gnaro.fr, stockés dans un dépôt Git.
//
// Il n'y a PAS de base de données ici, et c'est délibéré : gnaro.fr est un site
// statique dont les articles sont des fichiers Markdown versionnés. Le dépôt
// est le magasin, ce tableau de bord n'est qu'une télécommande. Dupliquer les
// articles en base créerait deux vérités qui divergeraient au premier conflit.
//
// Sécurité — le jeton configuré ici peut écrire dans le dépôt du site. Il doit
// être un PAT à portée fine, limité à ce seul dépôt, droit « contents » en
// écriture, avec une date d'expiration. Rien d'autre.
//
// Variables d'environnement :
//   GNARO_GITHUB_TOKEN  obligatoire
//   GNARO_REPO          défaut « Gnaro-Shaft/gnaro »
//   GNARO_BRANCH        défaut « main »

const API = 'https://api.github.com';
const DOSSIER = 'src/content/blog';

function config() {
  const token = process.env.GNARO_GITHUB_TOKEN;
  if (!token) {
    const e = new Error(
      'Jeton GitHub absent sur le serveur (GNARO_GITHUB_TOKEN) : accès au dépôt gnaro impossible.'
    );
    e.statusCode = 503;
    e.expose = true;
    throw e;
  }
  return {
    token,
    repo: process.env.GNARO_REPO || 'Gnaro-Shaft/gnaro',
    branche: process.env.GNARO_BRANCH || 'main',
  };
}

/**
 * Message destiné à l'utilisateur du tableau de bord pour les refus de
 * GitHub qui ont une cause connue et une action claire. Le jeton est un PAT
 * à portée fine avec date d'expiration : le jour où il expire, l'API répond
 * 401 et, sans ceci, l'interface n'affichait que « Server Error » (vécu le
 * 5 septembre 2026). `null` pour tout autre statut : le message brut reste
 * réservé aux journaux.
 */
function messageGitHub(statut) {
  if (statut === 401) {
    return 'GitHub refuse le jeton du serveur (expiré ou révoqué). À renouveler : nouveau jeton à portée fine sur le dépôt gnaro, puis `fly secrets set GNARO_GITHUB_TOKEN=…`.';
  }
  if (statut === 403) {
    return 'GitHub refuse l’accès au dépôt gnaro : le jeton n’a pas le droit « contents », ou la limite d’appels est atteinte. Vérifier ses permissions.';
  }
  return null;
}

async function appel(chemin, options = {}) {
  const { token } = config();
  const reponse = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gcn-dashboard',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '');
    const explicite = messageGitHub(reponse.status);
    const e = new Error(
      explicite || `GitHub a répondu ${reponse.status} sur ${chemin}. ${corps.slice(0, 200)}`
    );
    // 404 et 409 remontent tels quels : « fichier introuvable » et « le
    // fichier a changé depuis la lecture » sont des situations normales que
    // l'interface doit savoir distinguer d'une panne.
    e.statusCode = [404, 409, 422].includes(reponse.status) ? reponse.status : 502;
    // Un message rédigé pour l'utilisateur peut traverser le masque de
    // production ; le message brut de GitHub, non.
    e.expose = Boolean(explicite);
    throw e;
  }

  return reponse.status === 204 ? null : reponse.json();
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

// Lecteur minimal, volontairement limité aux champs que le pipeline écrit.
// On n'ajoute pas js-yaml pour ça : la forme est connue et produite par nous.
// Tout ce qui sort de cette forme est ignoré plutôt que deviné — mieux vaut un
// champ absent qu'une valeur inventée.
function lireFrontmatter(brut) {
  const m = brut.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { donnees: {}, corps: brut };

  const donnees = {};
  const lignes = m[1].split('\n');

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    const paire = ligne.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!paire) continue;

    const [, cle, valeurBrute] = paire;
    const valeur = valeurBrute.trim();

    // Séquence sur plusieurs lignes : « cle: » suivi de lignes « - ... »
    if (valeur === '') {
      const items = [];
      while (i + 1 < lignes.length && /^\s+-\s/.test(lignes[i + 1])) {
        items.push(dequote(lignes[++i].replace(/^\s+-\s/, '').trim()));
      }
      donnees[cle] = items;
      continue;
    }

    if (valeur === 'true' || valeur === 'false') {
      donnees[cle] = valeur === 'true';
    } else if (valeur.startsWith('[') && valeur.endsWith(']')) {
      const dedans = valeur.slice(1, -1).trim();
      donnees[cle] = dedans === '' ? [] : dedans.split(',').map((v) => dequote(v.trim()));
    } else {
      donnees[cle] = dequote(valeur);
    }
  }

  return { donnees, corps: m[2] };
}

function dequote(v) {
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return v;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Contenu décodé et sha d'un fichier. Le sha est requis pour toute écriture. */
async function lireFichier(nomFichier) {
  const { repo, branche } = config();
  const donnees = await appel(
    `/repos/${repo}/contents/${DOSSIER}/${encodeURIComponent(nomFichier)}?ref=${encodeURIComponent(branche)}`
  );
  return {
    sha: donnees.sha,
    brut: Buffer.from(donnees.content || '', 'base64').toString('utf8'),
  };
}

/**
 * Tous les brouillons du dépôt, du plus récent au plus ancien.
 *
 * Un appel pour lister le dossier, puis un par fichier — l'API GitHub ne
 * renvoie pas le contenu dans un listing de répertoire. Acceptable : il y a
 * une poignée de brouillons, pas mille.
 */
async function listerBrouillons() {
  const { repo, branche } = config();

  let entrees;
  try {
    entrees = await appel(
      `/repos/${repo}/contents/${DOSSIER}?ref=${encodeURIComponent(branche)}`
    );
  } catch (e) {
    if (e.statusCode === 404) return []; // dossier absent : pas d'articles
    throw e;
  }

  const fichiers = (Array.isArray(entrees) ? entrees : []).filter(
    (e) => e.type === 'file' && e.name.endsWith('.md')
  );

  const articles = await Promise.all(
    fichiers.map(async (f) => {
      const { sha, brut } = await lireFichier(f.name);
      const { donnees, corps } = lireFrontmatter(brut);
      return {
        slug: f.name.replace(/\.md$/, ''),
        fichier: f.name,
        sha,
        titre: donnees.title || f.name,
        description: donnees.description || '',
        pubDate: donnees.pubDate || null,
        tags: Array.isArray(donnees.tags) ? donnees.tags : [],
        brouillon: donnees.draft === true,
        assisteParIA: donnees.aiAssisted === true,
        aVerifier: Array.isArray(donnees.aVerifier) ? donnees.aVerifier : [],
        // Preuves mécaniques du pipeline : chiffres retrouvés dans un commit
        // ou un diff. À lire, pas à cocher.
        verifie: Array.isArray(donnees.verifie) ? donnees.verifie : [],
        corps,
        motsEnviron: corps.split(/\s+/).filter(Boolean).length,
      };
    })
  );

  return articles
    .filter((a) => a.brouillon)
    .sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

async function ecrireFichier({ nomFichier, contenu, sha, message }) {
  const { repo, branche } = config();
  return appel(`/repos/${repo}/contents/${DOSSIER}/${encodeURIComponent(nomFichier)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(contenu, 'utf8').toString('base64'),
      sha,
      branch: branche,
    }),
  });
}

/**
 * Publie un brouillon : bascule `draft` à false et vide `aVerifier`.
 *
 * Le sha lu par l'appelant est transmis tel quel à GitHub, qui refuse
 * l'écriture s'il a changé entre-temps. C'est ce qui évite d'écraser une
 * correction faite en parallèle depuis un éditeur.
 *
 * `aiAssisted` n'est JAMAIS modifié : la mention de transparence exigée par
 * l'article 50 du règlement européen sur l'IA ne se retire pas en publiant.
 */
function appliquerPublication(brut) {
  const { donnees } = lireFrontmatter(brut);

  if (donnees.draft !== true) {
    const e = new Error("Cet article n'est pas un brouillon.");
    e.statusCode = 422;
    throw e;
  }

  // Les substitutions ne s'appliquent QU'AU frontmatter. Sans cette découpe,
  // une ligne du corps commençant par « draft: true » — dans un bloc de code
  // d'article, par exemple — serait modifiée elle aussi.
  const m = brut.match(/^(---\n)([\s\S]*?)(\n---\n?)([\s\S]*)$/);
  if (!m) {
    const e = new Error('Frontmatter introuvable — fichier inattendu, rien modifié.');
    e.statusCode = 422;
    throw e;
  }
  const [, ouverture, entete, fermeture, corps] = m;

  let nouvelEntete = entete.replace(/^draft:[ \t]*true[ \t]*$/m, 'draft: false');
  if (nouvelEntete === entete) {
    const e = new Error('Champ `draft: true` introuvable — rien modifié.');
    e.statusCode = 422;
    throw e;
  }

  // Un article publié n'a plus rien à vérifier, ou il n'aurait pas dû l'être.
  // Deux formes possibles : séquence sur plusieurs lignes, ou liste en ligne.
  // Les preuves (`verifie`) partent avec : elles n'ont de sens que pendant
  // la relecture.
  nouvelEntete = nouvelEntete
    .replace(/^aVerifier:[ \t]*\n(?:[ \t]+-[ \t].*(?:\n|$))*/m, 'aVerifier: []\n')
    .replace(/^aVerifier:[ \t]*\[[^\]]*\][ \t]*$/m, 'aVerifier: []')
    .replace(/^verifie:[ \t]*\n(?:[ \t]+-[ \t].*(?:\n|$))*/m, '')
    .replace(/^verifie:[ \t]*\[[^\]]*\][ \t]*\n?/m, '')
    .replace(/\n+(?=\n?$)/, '\n')
    .replace(/\n$/, '');

  return { contenu: ouverture + nouvelEntete + fermeture + corps, titre: donnees.title };
}

async function publier({ fichier, sha }) {
  const { brut, sha: shaActuel } = await lireFichier(fichier);

  if (sha && sha !== shaActuel) {
    const e = new Error('Le fichier a changé depuis son affichage — rechargez avant de publier.');
    e.statusCode = 409;
    throw e;
  }

  const { contenu, titre } = appliquerPublication(brut);

  await ecrireFichier({
    nomFichier: fichier,
    contenu,
    sha: shaActuel,
    message: `Publie : ${titre || fichier}`,
  });

  return { fichier, publie: true };
}

/** Supprime un brouillon. Irréversible côté fichier, retrouvable dans l'historique Git. */
async function supprimer({ fichier, sha }) {
  const { repo, branche } = config();
  const { brut, sha: shaActuel } = await lireFichier(fichier);

  if (sha && sha !== shaActuel) {
    const e = new Error('Le fichier a changé depuis son affichage — rechargez avant de supprimer.');
    e.statusCode = 409;
    throw e;
  }

  const { donnees } = lireFrontmatter(brut);
  if (donnees.draft !== true) {
    const e = new Error('Refus : cet article est publié, il ne se supprime pas depuis ici.');
    e.statusCode = 422;
    throw e;
  }

  await appel(`/repos/${repo}/contents/${DOSSIER}/${encodeURIComponent(fichier)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `Supprime le brouillon : ${donnees.title || fichier}`,
      sha: shaActuel,
      branch: branche,
    }),
  });

  return { fichier, supprime: true };
}

module.exports = {
  listerBrouillons,
  publier,
  supprimer,
  // exportés pour les tests
  lireFrontmatter,
  appliquerPublication,
  messageGitHub,
};
