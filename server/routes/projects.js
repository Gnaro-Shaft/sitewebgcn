const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  listGithubReposToImport,
  importFromGithub,
} = require('../controllers/projectController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateProject } = require('../middleware/validate');

// Admin endpoints (before :id to avoid route conflicts)
router.get('/admin/all', protect, adminOnly, getAllProjects);
router.get('/github-import', protect, adminOnly, listGithubReposToImport);
router.post('/github-import', protect, adminOnly, importFromGithub);

// Public
router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', protect, adminOnly, validateProject, createProject);
router.patch('/:id', protect, adminOnly, updateProject);
router.delete('/:id', protect, adminOnly, deleteProject);

module.exports = router;
