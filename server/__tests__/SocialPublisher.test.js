// Tests for SocialPublisher text formatters.
// Pure functions, no fetch / no webhook calls.

import { describe, it, expect } from 'vitest';

// SITE_URL is read at module load time → set it BEFORE requiring
process.env.SITE_URL = 'https://gcn-data.fr';

const { buildLinkedInText, buildTwitterText } = require('../services/SocialPublisher');

describe('buildLinkedInText', () => {
  const baseArticle = {
    title: 'Comment j\'ai code mon bot Hyperliquid',
    slug: 'comment-jai-code-mon-bot-hyperliquid',
    excerpt: 'Retour d\'experience sur la construction d\'un bot 24/7.',
    tags: ['python', 'trading', 'algo'],
  };

  it('includes title, excerpt, full article URL and hashtags', () => {
    const out = buildLinkedInText(baseArticle);
    expect(out).toContain(baseArticle.title);
    expect(out).toContain(baseArticle.excerpt);
    expect(out).toContain('https://gcn-data.fr/blog/comment-jai-code-mon-bot-hyperliquid');
    expect(out).toContain('#python');
    expect(out).toContain('#trading');
    expect(out).toContain('#algo');
  });

  it('drops the excerpt line when not provided', () => {
    const { excerpt, ...withoutExcerpt } = baseArticle;
    const out = buildLinkedInText(withoutExcerpt);
    expect(out).not.toContain('undefined');
    expect(out).toContain(baseArticle.title);
    expect(out).toContain('Lire l\'article');
  });

  it('skips the hashtag line when no tags', () => {
    const out = buildLinkedInText({ ...baseArticle, tags: [] });
    expect(out).not.toContain('#');
  });

  it('caps tags at 5 max', () => {
    const out = buildLinkedInText({
      ...baseArticle,
      tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    const hashtags = out.match(/#[a-z]/g) || [];
    expect(hashtags.length).toBe(5);
  });

  it('strips non-alphanumeric chars from hashtags (no broken posts)', () => {
    const out = buildLinkedInText({
      ...baseArticle,
      tags: ['c++', 'next.js', 'web-dev'],
    });
    expect(out).toContain('#c');
    expect(out).toContain('#nextjs');
    expect(out).toContain('#webdev');
    // No raw special chars in the hashtag itself
    expect(out).not.toContain('#c++');
    expect(out).not.toContain('#next.js');
  });
});

describe('buildTwitterText (280 char limit)', () => {
  const longTitle = 'A'.repeat(300);

  // Twitter's t.co URL shortener: any URL counts as 23 chars regardless
  // of its real length. Our function reserves 24 chars (23 + 1 safety).
  // So the RAW string can exceed 280, but the EFFECTIVE Twitter length must not.
  function twitterEffectiveLength(text) {
    return text.replace(/https?:\/\/\S+/g, 'X'.repeat(23)).length;
  }

  it('stays under 280 Twitter-effective chars (URLs count as 23)', () => {
    const out = buildTwitterText({
      title: longTitle,
      slug: 'long-article',
    });
    expect(twitterEffectiveLength(out)).toBeLessThanOrEqual(280);
  });

  it('appends a trailing ellipsis when title is truncated', () => {
    const out = buildTwitterText({
      title: longTitle,
      slug: 'x',
    });
    // Must indicate truncation
    expect(out).toMatch(/…\n\n/);
  });

  it('does NOT truncate when title fits', () => {
    const out = buildTwitterText({
      title: 'Short title',
      slug: 'short',
    });
    expect(out).toContain('Short title');
    expect(out).not.toContain('…');
  });

  it('always includes the article URL on the last line', () => {
    const out = buildTwitterText({
      title: 'Anything',
      slug: 'anything',
    });
    expect(out).toContain('https://gcn-data.fr/blog/anything');
  });
});
