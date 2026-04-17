const asyncHandler = require('../middleware/asyncHandler');

const GITHUB_USER = 'gnaro-shaft';

// In-memory cache (1h TTL)
let skillsCache = null;
let skillsCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Mapping: dependency name → { display name, category }
const DEP_MAP = {
  // Frontend
  react: { name: 'React', category: 'frontend', featured: true },
  'react-dom': { name: 'React', category: 'frontend', featured: true },
  'react-native': { name: 'React Native', category: 'frontend', featured: false },
  vue: { name: 'Vue.js', category: 'frontend', featured: true },
  vite: { name: 'Vite', category: 'frontend', featured: false },
  tailwindcss: { name: 'Tailwind CSS', category: 'frontend', featured: true },
  '@tailwindcss/vite': { name: 'Tailwind CSS', category: 'frontend', featured: true },
  'react-router': { name: 'React Router', category: 'frontend', featured: false },
  'react-router-dom': { name: 'React Router', category: 'frontend', featured: false },
  axios: { name: 'Axios', category: 'frontend', featured: false },
  i18next: { name: 'i18next', category: 'frontend', featured: false },

  // Backend
  express: { name: 'Express', category: 'backend', featured: true },
  mongoose: { name: 'MongoDB', category: 'backend', featured: true },
  jsonwebtoken: { name: 'JWT Auth', category: 'backend', featured: false },
  bcrypt: { name: 'Bcrypt', category: 'backend', featured: false },
  cors: { name: 'CORS', category: 'backend', featured: false },
  nodemailer: { name: 'Nodemailer', category: 'backend', featured: false },
  pdfkit: { name: 'PDFKit', category: 'backend', featured: false },

  // Python / AI
  ccxt: { name: 'CCXT', category: 'ai', featured: true },
  pandas: { name: 'Pandas', category: 'ai', featured: true },
  numpy: { name: 'NumPy', category: 'ai', featured: false },
  pymongo: { name: 'PyMongo', category: 'ai', featured: false },
  'pymongo[srv]': { name: 'PyMongo', category: 'ai', featured: false },
  websockets: { name: 'WebSockets', category: 'ai', featured: false },
  requests: { name: 'Requests', category: 'ai', featured: false },
};

// Mapping: GitHub language → { display name, category }
const LANG_MAP = {
  JavaScript: { name: 'JavaScript', category: 'frontend', featured: true },
  TypeScript: { name: 'TypeScript', category: 'frontend', featured: true },
  Python: { name: 'Python', category: 'ai', featured: true },
  HTML: { name: 'HTML / CSS', category: 'frontend', featured: false },
  CSS: { name: 'HTML / CSS', category: 'frontend', featured: false },
  Shell: { name: 'Shell / Bash', category: 'backend', featured: false },
  Dockerfile: { name: 'Docker', category: 'backend', featured: false },
};

// Always include these (not detectable via GitHub)
const ALWAYS_INCLUDE = [
  { name: 'Git / GitHub', category: 'backend', featured: false },
  { name: 'REST API', category: 'backend', featured: false },
  { name: 'Linux', category: 'backend', featured: false },
  { name: 'Vercel / Render', category: 'backend', featured: false },
  { name: 'LLM Integration', category: 'ai', featured: true },
  { name: 'Automation', category: 'ai', featured: false },
  { name: 'Data Analysis', category: 'ai', featured: false },
];

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// GET /api/github/skills — dynamic skills from GitHub repos (cached 1h)
exports.getSkills = asyncHandler(async (req, res) => {
  // Return cache if fresh
  if (skillsCache && Date.now() - skillsCacheTime < CACHE_TTL) {
    return res.json(skillsCache);
  }

  {
    // 1. Fetch all repos
    const repos = await fetchJSON(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`
    );
    if (!Array.isArray(repos)) {
      return res.status(502).json({ success: false, error: 'GitHub API error' });
    }

    const skills = new Map(); // name → { name, category, featured, repoCount }

    // 2. Process each repo: languages + dependencies
    await Promise.all(
      repos.map(async (repo) => {
        // Languages
        const langs = await fetchJSON(
          `https://api.github.com/repos/${GITHUB_USER}/${repo.name}/languages`
        );
        if (langs) {
          for (const lang of Object.keys(langs)) {
            const mapped = LANG_MAP[lang];
            if (mapped && !skills.has(mapped.name)) {
              skills.set(mapped.name, { ...mapped, repoCount: 1 });
            } else if (mapped && skills.has(mapped.name)) {
              skills.get(mapped.name).repoCount++;
            }
          }
        }

        // package.json (JS/Node repos)
        const pkg = await fetchJSON(
          `https://raw.githubusercontent.com/${GITHUB_USER}/${repo.name}/${repo.default_branch || 'main'}/package.json`
        );
        if (pkg) {
          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
          };
          for (const dep of Object.keys(allDeps || {})) {
            const mapped = DEP_MAP[dep];
            if (mapped && !skills.has(mapped.name)) {
              skills.set(mapped.name, { ...mapped, repoCount: 1 });
            }
          }
        }

        // requirements.txt (Python repos)
        const reqTxt = await fetchText(
          `https://raw.githubusercontent.com/${GITHUB_USER}/${repo.name}/${repo.default_branch || 'main'}/requirements.txt`
        );
        if (reqTxt) {
          const lines = reqTxt.split('\n').map((l) => l.trim().toLowerCase().split('==')[0].split('>=')[0]);
          for (const dep of lines) {
            const mapped = DEP_MAP[dep];
            if (mapped && !skills.has(mapped.name)) {
              skills.set(mapped.name, { ...mapped, repoCount: 1 });
            }
          }
        }
      })
    );

    // 3. Add always-included skills
    for (const s of ALWAYS_INCLUDE) {
      if (!skills.has(s.name)) {
        skills.set(s.name, { ...s, repoCount: 0 });
      }
    }

    // 4. Group by category
    const groups = {
      frontend: [],
      ai: [],
      backend: [],
    };

    for (const skill of skills.values()) {
      const cat = groups[skill.category];
      if (cat) {
        cat.push({
          name: skill.name,
          featured: skill.featured,
          repoCount: skill.repoCount || 0,
        });
      }
    }

    // Sort: featured first, then by repoCount
    for (const cat of Object.values(groups)) {
      cat.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured - a.featured;
        return b.repoCount - a.repoCount;
      });
    }

    const result = {
      success: true,
      data: groups,
      repoCount: repos.length,
    };

    // Store in cache
    skillsCache = result;
    skillsCacheTime = Date.now();

    res.json(result);
  }
});
