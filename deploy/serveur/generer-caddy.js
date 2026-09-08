// Génère deploy/serveur/Caddyfile.gcn-data, le bloc Caddy du tableau de bord
// sur le VPS, à partir de la table server/config/redirections.js.
//
// La table est la source unique des redirections 301 : Express l'applique
// tant que l'application tourne sur Fly, Caddy l'appliquera sur le VPS
// avant même d'atteindre l'application. Ce script évite que les deux
// divergent ; un test vérifie que le fichier commité est à jour.
//
//   node deploy/serveur/generer-caddy.js          écrit le fichier
//   node deploy/serveur/generer-caddy.js --stdout  affiche seulement

const fs = require('fs');
const path = require('path');
const { PAGES, ARTICLES, REPLI_BLOG } = require('../../server/config/redirections');

const SORTIE = path.join(__dirname, 'Caddyfile.gcn-data');

function bloc() {
  const l = [];
  l.push('# --- gcn-data.fr : tableau de bord ------------------------------------------');
  l.push('# GÉNÉRÉ par deploy/serveur/generer-caddy.js depuis server/config/redirections.js.');
  l.push('# Ne pas éditer à la main : relancer le script, puis installer.sh.');
  l.push('#');
  l.push('# L\'application Node écoute sur 127.0.0.1:8080 (service systemd gcn-dashboard).');
  l.push('# Elle pose elle-même ses en-têtes de sécurité (helmet, CSP comprise) : Caddy');
  l.push('# n\'en ajoute pas, deux CSP se cumuleraient en intersection et casseraient les');
  l.push('# polices. Il retire seulement son nom et impose HTTPS.');
  l.push('');
  l.push('www.gcn-data.fr {');
  l.push('\theader -Server');
  l.push('\tredir https://gcn-data.fr{uri} permanent');
  l.push('}');
  l.push('');
  l.push('gcn-data.fr {');
  l.push('\theader {');
  l.push('\t\t-Server');
  l.push('\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"');
  l.push('\t}');
  l.push('\tencode zstd gzip');
  l.push('');
  l.push('\t# --- Anciennes URL publiques → gnaro.fr, en 301 -----------------------');
  l.push('\t# Articles migrés (slug ancien → slug gnaro.fr), avant le repli.');
  const slugs = Object.keys(ARTICLES).sort();
  if (slugs.length === 0) l.push('\t# (aucun pour l\'instant : la carte ARTICLES est vide)');
  for (const ancien of slugs) {
    l.push(`\tredir /blog/${ancien} https://gnaro.fr/blog/${ARTICLES[ancien]}/ permanent`);
    l.push(`\tredir /blog/${ancien}/ https://gnaro.fr/blog/${ARTICLES[ancien]}/ permanent`);
  }
  l.push('\t# Repli : tout autre article vers l\'index du blog.');
  l.push('\t@blog path /blog /blog/ /blog/*');
  l.push(`\tredir @blog ${REPLI_BLOG} permanent`);
  l.push('\t# Pages fixes.');
  for (const [chemin, cible] of Object.entries(PAGES)) {
    if (chemin === '/blog') continue;
    l.push(`\tredir ${chemin} ${cible} permanent`);
    l.push(`\tredir ${chemin}/ ${cible} permanent`);
  }
  l.push('');
  l.push('\treverse_proxy 127.0.0.1:8080');
  l.push('');
  l.push('\t# Journal d\'accès : adresses IP, donc quatorze jours au plus, comme gnaro.fr.');
  l.push('\tlog {');
  l.push('\t\toutput file /var/log/caddy/gcn-data.log {');
  l.push('\t\t\troll_size 10MiB');
  l.push('\t\t\troll_keep 14');
  l.push('\t\t\troll_keep_for 336h');
  l.push('\t\t}');
  l.push('\t}');
  l.push('}');
  return `${l.join('\n')}\n`;
}

if (require.main === module) {
  const texte = bloc();
  if (process.argv.includes('--stdout')) process.stdout.write(texte);
  else {
    fs.writeFileSync(SORTIE, texte);
    console.log(`écrit : ${path.relative(process.cwd(), SORTIE)}`);
  }
}

module.exports = { bloc, SORTIE };
