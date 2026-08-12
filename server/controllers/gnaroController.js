// Brouillons du site gnaro.fr — lecture, publication, suppression.
//
// Le magasin est le dépôt Git de gnaro.fr, pas MongoDB : voir
// services/gnaroRepo.js pour le pourquoi.

const asyncHandler = require('../middleware/asyncHandler');
const gnaro = require('../services/gnaroRepo');

// GET /api/gnaro/drafts
const listerBrouillons = asyncHandler(async (req, res) => {
  const data = await gnaro.listerBrouillons();
  res.json({ success: true, count: data.length, data });
});

// PATCH /api/gnaro/drafts/:fichier/publish
//
// Le sha transmis par l'interface est celui du fichier tel qu'il a été
// affiché. GitHub refuse l'écriture s'il a changé : on ne peut donc pas
// écraser une correction faite entre-temps depuis un éditeur.
const publierBrouillon = asyncHandler(async (req, res) => {
  const data = await gnaro.publier({
    fichier: req.params.fichier,
    sha: req.body?.sha,
  });
  res.json({ success: true, data });
});

// DELETE /api/gnaro/drafts/:fichier
const supprimerBrouillon = asyncHandler(async (req, res) => {
  const data = await gnaro.supprimer({
    fichier: req.params.fichier,
    sha: req.body?.sha,
  });
  res.json({ success: true, data });
});

module.exports = {
  listerBrouillons,
  publierBrouillon,
  supprimerBrouillon,
};
