const Project = require('../models/Project');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/projects — public, only isPublic: true
exports.getProjects = asyncHandler(async (req, res) => {
  const { stack } = req.query;
  const filter = { isPublic: true };

  if (stack) {
    filter.stack = { $in: stack.split(',') };
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    Project.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  res.json({ success: true, count: projects.length, total, page, data: projects });
});

// GET /api/projects/:id — public
exports.getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project || !project.isPublic) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  res.json({ success: true, data: project });
});

// GET /api/projects/all — admin, includes non-public
exports.getAllProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find().sort({ order: 1, createdAt: -1 });
  res.json({ success: true, count: projects.length, data: projects });
});

// POST /api/projects — admin
exports.createProject = asyncHandler(async (req, res) => {
  const project = await Project.create(req.body);
  res.status(201).json({ success: true, data: project });
});

// PATCH /api/projects/:id — admin
exports.updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  res.json({ success: true, data: project });
});

// DELETE /api/projects/:id — admin
exports.deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndDelete(req.params.id);

  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  res.json({ success: true, data: {} });
});
