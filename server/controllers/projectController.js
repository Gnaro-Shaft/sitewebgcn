const Project = require('../models/Project');
const asyncHandler = require('../middleware/asyncHandler');

const GITHUB_USER = 'Gnaro-Shaft';

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

// GET /api/projects/github-import — admin, list GitHub repos not yet in DB
exports.listGithubReposToImport = asyncHandler(async (req, res) => {
  // Fetch all public repos
  const ghRes = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`
  );
  if (!ghRes.ok) {
    return res.status(502).json({ success: false, error: 'GitHub API error' });
  }
  const repos = await ghRes.json();

  // Get existing projects (match by githubUrl)
  const existing = await Project.find({}).select('githubUrl');
  const existingUrls = new Set(existing.map((p) => (p.githubUrl || '').toLowerCase()));

  // Filter out forks, archived, and already-imported repos
  const newRepos = repos
    .filter((r) => !r.fork && !r.archived)
    .filter((r) => !existingUrls.has(r.html_url.toLowerCase()))
    .map((r) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description || '',
      htmlUrl: r.html_url,
      homepage: r.homepage || '',
      language: r.language,
      topics: r.topics || [],
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
    }));

  res.json({ success: true, count: newRepos.length, data: newRepos });
});

// POST /api/projects/github-import — admin, import selected repos
exports.importFromGithub = asyncHandler(async (req, res) => {
  const { repoNames } = req.body;

  if (!Array.isArray(repoNames) || repoNames.length === 0) {
    return res.status(400).json({ success: false, error: 'repoNames must be a non-empty array' });
  }

  // Fetch all repos to get full data
  const ghRes = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`
  );
  if (!ghRes.ok) {
    return res.status(502).json({ success: false, error: 'GitHub API error' });
  }
  const repos = await ghRes.json();

  const created = [];
  const errors = [];

  for (const name of repoNames) {
    const repo = repos.find((r) => r.name === name);
    if (!repo) {
      errors.push({ name, error: 'Repo not found on GitHub' });
      continue;
    }

    // Skip if already exists (race condition guard)
    const existing = await Project.findOne({ githubUrl: repo.html_url });
    if (existing) {
      errors.push({ name, error: 'Already imported' });
      continue;
    }

    // Build basic stack from language + topics
    const stack = [];
    if (repo.language) stack.push(repo.language);
    if (Array.isArray(repo.topics)) {
      for (const t of repo.topics.slice(0, 5)) {
        if (!stack.includes(t)) stack.push(t);
      }
    }

    try {
      const project = await Project.create({
        title: repo.name,
        description: repo.description || `Repo GitHub : ${repo.name}`,
        stack,
        githubUrl: repo.html_url,
        liveUrl: repo.homepage || '',
        isPublic: false, // Hidden by default — admin must enrich + publish
        featured: false,
      });
      created.push(project);
    } catch (err) {
      errors.push({ name, error: err.message });
    }
  }

  res.json({
    success: true,
    imported: created.length,
    errorCount: errors.length,
    data: { created, errors },
  });
});

// DELETE /api/projects/:id — admin
exports.deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndDelete(req.params.id);

  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  res.json({ success: true, data: {} });
});
