const express = require('express');
const router = express.Router();
const {
  listerBrouillons,
  citations,
  sujets,
  publierBrouillon,
  supprimerBrouillon,
} = require('../controllers/gnaroController');
const { protect, adminOnly } = require('../middleware/auth');

// Aucune route publique ici : ces brouillons ne sont pas destinés à être lus
// avant publication, et les écritures touchent un dépôt Git tiers.
router.get('/drafts', protect, adminOnly, listerBrouillons);
router.get('/citations', protect, adminOnly, citations);
router.get('/sujets', protect, adminOnly, sujets);
router.patch('/drafts/:fichier/publish', protect, adminOnly, publierBrouillon);
router.delete('/drafts/:fichier', protect, adminOnly, supprimerBrouillon);

module.exports = router;
