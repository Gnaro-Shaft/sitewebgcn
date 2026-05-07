const Article = require('../models/Article');
const Project = require('../models/Project');
const asyncHandler = require('../middleware/asyncHandler');

const SITE_URL = process.env.SITE_URL || 'https://gcn-data.fr';

// Static pages with their priority and change frequency
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/projects', priority: '0.9', changefreq: 'weekly' },
  { path: '/stack', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog', priority: '0.9', changefreq: 'daily' },
];

// GET /sitemap.xml — dynamic sitemap including articles
exports.getSitemap = asyncHandler(async (req, res) => {
  // Get published articles
  const articles = await Article.find({ published: true })
    .select('slug publishedAt updatedAt')
    .sort({ publishedAt: -1 });

  const now = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages
  for (const page of STATIC_PAGES) {
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}${page.path}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Dynamic article pages
  for (const article of articles) {
    const lastmod = (article.updatedAt || article.publishedAt || new Date()).toISOString();
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}/blog/${article.slug}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';

  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600'); // 1h cache
  res.send(xml);
});
