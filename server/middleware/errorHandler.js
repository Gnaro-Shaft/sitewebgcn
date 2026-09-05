// En production, le message d'une erreur est masqué : il peut contenir un
// chemin, une requête, un détail d'implémentation. Exception : une erreur
// marquée `expose` par son auteur, rédigée pour l'utilisateur (« jeton
// GitHub refusé, à renouveler »). Sans cette porte, un tableau de bord
// n'affiche que « Server Error » et il faut aller lire les journaux.
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const masquer = process.env.NODE_ENV === 'production' && !err.expose;

  res.status(statusCode).json({
    success: false,
    error: masquer ? 'Server Error' : err.message,
  });
};

module.exports = errorHandler;
