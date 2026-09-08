// Table des redirections 301 des anciennes URL publiques de gcn-data.fr vers
// gnaro.fr, le site public depuis le 2 septembre 2026.
//
// Cette table ne sert plus à Express : c'est Caddy, sur le VPS, qui redirige
// avant même d'atteindre l'application, avec le bloc que
// deploy/serveur/generer-caddy.js génère d'ici. Un middleware Express l'a
// appliquée entre le 8 septembre 2026 et l'arrêt de Fly, le même jour.
// Modifier la table, relancer le générateur, rejouer preparer.sh.
//
// Deux couches, dans cet ordre :
//   1. PAGES     — chemins fixes, destination connue une fois pour toutes.
//   2. ARTICLES  — ancien slug → slug gnaro.fr, à remplir au fil du tri
//                  éditorial. Un slug absent de cette carte tombe sur le
//                  REPLI, l'index du blog : le lecteur d'un vieux post
//                  LinkedIn arrive sur un blog vivant, pas sur une erreur.
//
// Le repli suffit à garder les liens en vie, mais il ne transmet pas le
// référencement : pour Google, une redirection en masse vers un index vaut
// une page disparue. Seule une entrée précise dans ARTICLES le transmet.
// C'est acceptable pour un article abandonné, pas pour un article migré.
//
// Pour ajouter un article migré : une ligne par slug d'origine, anciens
// slugs compris (champ migration.oldSlugs de l'export), vers le nom du
// fichier déposé dans src/content/blog du dépôt gnaro.
//
const GNARO = 'https://gnaro.fr';

const PAGES = {
  '/blog': `${GNARO}/blog/`,
  '/projects': `${GNARO}/projets/`,
  '/stack': `${GNARO}/projets/`,
  '/rss.xml': `${GNARO}/rss.xml`,
  '/sitemap.xml': `${GNARO}/sitemap-index.xml`,
};

// ancien slug gcn-data.fr → slug gnaro.fr. Vide tant que le tri n'est pas fait.
const ARTICLES = {};

const REPLI_BLOG = `${GNARO}/blog/`;

// Destination pour un chemin donné, ou null si le chemin n'est pas une
// ancienne URL publique. Référence testable de la règle ; Caddy en est la
// traduction. La chaîne de requête est volontairement perdue, rien côté
// gnaro.fr ne la lirait.
function destinationPour(chemin) {
  const sansSlashFinal = chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin;
  if (PAGES[sansSlashFinal]) return PAGES[sansSlashFinal];

  const m = sansSlashFinal.match(/^\/blog\/([^/]+)/);
  if (!m) return null;

  let slug;
  try {
    slug = decodeURIComponent(m[1]).toLowerCase();
  } catch {
    return REPLI_BLOG; // encodage invalide : on ne devine pas, on replie
  }
  return ARTICLES[slug] ? `${GNARO}/blog/${ARTICLES[slug]}/` : REPLI_BLOG;
}

module.exports = { GNARO, PAGES, ARTICLES, REPLI_BLOG, destinationPour };
