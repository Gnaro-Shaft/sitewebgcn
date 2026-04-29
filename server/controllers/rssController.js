const Article = require('../models/Article');
const asyncHandler = require('../middleware/asyncHandler');

const SITE_URL = process.env.SITE_URL || 'https://gcn-data.fr';
const FEED_TITLE = 'Blog GCN — Genaro-Cedric NISUS';
const FEED_DESC = 'Articles tech, data et IA — transition d\'un sysadmin vers le monde de la donnée.';

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(date) {
  return new Date(date).toUTCString();
}

// GET /rss.xml — RSS 2.0 feed of published articles
exports.getRssFeed = asyncHandler(async (req, res) => {
  const articles = await Article.find({ published: true })
    .sort({ publishedAt: -1 })
    .limit(20);

  const lastBuild = articles[0]?.publishedAt || new Date();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
  xml += '  <channel>\n';
  xml += `    <title>${escapeXml(FEED_TITLE)}</title>\n`;
  xml += `    <link>${SITE_URL}/blog</link>\n`;
  xml += `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />\n`;
  xml += `    <description>${escapeXml(FEED_DESC)}</description>\n`;
  xml += '    <language>fr-FR</language>\n';
  xml += `    <lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>\n`;
  xml += '    <ttl>60</ttl>\n';

  for (const article of articles) {
    const url = `${SITE_URL}/blog/${article.slug}`;
    const pubDate = rfc822(article.publishedAt || article.createdAt);
    const description = article.excerpt || article.content?.slice(0, 280) || '';

    xml += '    <item>\n';
    xml += `      <title>${escapeXml(article.title)}</title>\n`;
    xml += `      <link>${url}</link>\n`;
    xml += `      <guid isPermaLink="true">${url}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <description>${escapeXml(description)}</description>\n`;
    xml += `      <content:encoded><![CDATA[${article.content || ''}]]></content:encoded>\n`;
    if (Array.isArray(article.tags)) {
      for (const tag of article.tags) {
        xml += `      <category>${escapeXml(tag)}</category>\n`;
      }
    }
    xml += '    </item>\n';
  }

  xml += '  </channel>\n';
  xml += '</rss>\n';

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});
