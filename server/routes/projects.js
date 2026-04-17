const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateProject } = require('../middleware/validate');

// Admin (before :id to avoid route conflict)
router.get('/admin/all', protect, adminOnly, getAllProjects);

// Public
router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', protect, adminOnly, validateProject, createProject);
router.patch('/:id', protect, adminOnly, updateProject);
router.delete('/:id', protect, adminOnly, deleteProject);

module.exports = router;
