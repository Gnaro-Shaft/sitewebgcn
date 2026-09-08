// Redirige en 301 les anciennes URL publiques de gcn-data.fr vers gnaro.fr.
// La table est dans config/redirections.js ; ici seulement la mécanique.
//
// GET et HEAD uniquement : un autre verbe sur une ancienne URL publique n'a
// pas de sens et une 301 le transformerait en GET silencieux. /api n'est
// jamais concerné, quel que soit le chemin.

const { destinationPour } = require('../config/redirections');

function redirectionsGnaro(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) return next();

  const destination = destinationPour(req.path);
  if (!destination) return next();

  res.set('Cache-Control', 'public, max-age=86400');
  return res.redirect(301, destination);
}

module.exports = { redirectionsGnaro };
