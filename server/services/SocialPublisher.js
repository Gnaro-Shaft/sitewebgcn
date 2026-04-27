// Generic webhook-based social publisher.
// Backend sends a payload to a webhook URL, which is processed by an
// automation tool (Make.com today, n8n self-hosted later).
// Migration from Make → n8n is just changing the env var.

const SITE_URL = process.env.SITE_URL || 'https://gcn-data.fr';

// Build the article URL for the social post
function articleUrl(article) {
  return `${SITE_URL}/blog/${article.slug}`;
}

// Build a default LinkedIn-friendly post text (~1300 chars max safe)
function buildLinkedInText(article) {
  const url = articleUrl(article);
  const tagsLine = (article.tags || []).slice(0, 5).map((t) => `#${t.replace(/[^a-zA-Z0-9]/g, '')}`).join(' ');

  let text = `${article.title}\n\n`;
  if (article.excerpt) text += `${article.excerpt}\n\n`;
  text += `Lire l'article : ${url}`;
  if (tagsLine) text += `\n\n${tagsLine}`;

  return text;
}

// Build a Twitter-friendly post (280 chars max)
function buildTwitterText(article) {
  const url = articleUrl(article);
  const reservedForUrl = 24; // Twitter shortens links to 23 chars + space
  const reservedForLink = `\n\n${url}`.length;
  const max = 280 - reservedForUrl - 3; // -3 for safety

  let text = article.title;
  if (text.length > max) {
    text = text.slice(0, max - 1) + '…';
  }
  return `${text}\n\n${url}`;
}

// Generic POST to webhook URL with retry logic
async function postWebhook(url, payload, maxRetries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return { success: true, status: res.status };
      }
      lastError = new Error(`Webhook returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }

    // Wait before retry (1s, 2s)
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
    }
  }

  return { success: false, error: lastError?.message || 'Unknown error' };
}

// Main entry: publish to LinkedIn via webhook
async function publishToLinkedIn(article) {
  const url = process.env.LINKEDIN_WEBHOOK_URL;
  if (!url) {
    return { success: false, error: 'LINKEDIN_WEBHOOK_URL not configured', skipped: true };
  }

  const payload = {
    platform: 'linkedin',
    text: buildLinkedInText(article),
    article: {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || '',
      tags: article.tags || [],
      url: articleUrl(article),
      publishedAt: article.publishedAt,
    },
  };

  return postWebhook(url, payload);
}

// Future: X/Twitter via webhook
async function publishToX(article) {
  const url = process.env.X_WEBHOOK_URL;
  if (!url) {
    return { success: false, error: 'X_WEBHOOK_URL not configured', skipped: true };
  }

  const payload = {
    platform: 'x',
    text: buildTwitterText(article),
    article: {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || '',
      url: articleUrl(article),
    },
  };

  return postWebhook(url, payload);
}

// Publish to all configured platforms in parallel
async function publishToAll(article) {
  const results = await Promise.allSettled([
    publishToLinkedIn(article),
    publishToX(article),
  ]);

  return {
    linkedin: results[0].status === 'fulfilled' ? results[0].value : { success: false, error: results[0].reason?.message },
    x: results[1].status === 'fulfilled' ? results[1].value : { success: false, error: results[1].reason?.message },
  };
}

module.exports = {
  publishToLinkedIn,
  publishToX,
  publishToAll,
  buildLinkedInText,
  buildTwitterText,
};
