const express = require('express');
const router = express.Router();
const {
  getArticles,
  getArticleBySlug,
  getAllArticles,
  createArticle,
  updateArticle,
  publishArticle,
  deleteArticle,
} = require('../controllers/articleController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateArticle } = require('../middleware/validate');

// Admin (before :slug to avoid route conflict)
router.get('/admin/all', protect, adminOnly, getAllArticles);
router.post('/', protect, adminOnly, validateArticle, createArticle);
router.patch('/:id/publish', protect, adminOnly, publishArticle);
router.patch('/:id', protect, adminOnly, updateArticle);
router.delete('/:id', protect, adminOnly, deleteArticle);

// Public
router.get('/', getArticles);
router.get('/:slug', getArticleBySlug);

module.exports = router;
