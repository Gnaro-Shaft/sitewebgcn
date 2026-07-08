// Unit tests for the LinkedIn post builders. Pure — no DB, no network.
import { describe, it, expect } from 'vitest';

const {
  buildLinkedInPost,
  buildLinkedInFirstComment,
  markdownToLinkedInText,
  truncateAtParagraph,
  articleUrl,
  MAX_POST_CHARS,
  TAGLINE,
} = require('../services/linkedinPost');

describe('markdownToLinkedInText', () => {
  it('returns empty string for empty / null / non-string input', () => {
    expect(markdownToLinkedInText('')).toBe('');
    expect(markdownToLinkedInText(null)).toBe('');
    expect(markdownToLinkedInText(undefined)).toBe('');
    expect(markdownToLinkedInText(42)).toBe('');
  });

  it('strips heading marks and keeps text', () => {
    expect(markdownToLinkedInText('# Title')).toBe('Title');
    expect(markdownToLinkedInText('## Subtitle')).toBe('Subtitle');
    expect(markdownToLinkedInText('###### H6')).toBe('H6');
  });

  it('strips bold markers (**x** and __x__)', () => {
    expect(markdownToLinkedInText('This is **bold** text')).toBe('This is bold text');
    expect(markdownToLinkedInText('Also __bold__ here')).toBe('Also bold here');
  });

  it('strips italic markers (*x* and _x_) without eating bullets', () => {
    expect(markdownToLinkedInText('An *italic* word')).toBe('An italic word');
    expect(markdownToLinkedInText('An _italic_ word')).toBe('An italic word');
    // A leading "*" that IS a list bullet should not be treated as italic
    expect(markdownToLinkedInText('* item')).toBe('• item');
  });

  it('strips inline backticks but keeps the code content', () => {
    expect(markdownToLinkedInText('Use `npm install` here')).toBe('Use npm install here');
  });

  it('unwraps fenced code blocks and drops the language tag', () => {
    const md = 'Before\n\n```js\nconst x = 1;\nconsole.log(x);\n```\n\nAfter';
    const out = markdownToLinkedInText(md);
    expect(out).toContain('const x = 1;');
    expect(out).toContain('console.log(x);');
    expect(out).not.toContain('```');
    expect(out).not.toContain('```js');
  });

  it('drops images entirely', () => {
    expect(markdownToLinkedInText('Text ![alt text](https://ex.com/img.png) more'))
      .toBe('Text  more');
  });

  it('keeps link text and drops the URL', () => {
    expect(markdownToLinkedInText('Read the [documentation](https://ex.com/doc) here'))
      .toBe('Read the documentation here');
  });

  it('converts unordered lists to bullet points', () => {
    const md = '- first\n- second\n- third';
    expect(markdownToLinkedInText(md)).toBe('• first\n• second\n• third');
  });

  it('preserves ordered list numbering', () => {
    const md = '1. first\n2. second\n3. third';
    expect(markdownToLinkedInText(md)).toBe('1. first\n2. second\n3. third');
  });

  it('converts blockquotes with a heavy arrow prefix', () => {
    expect(markdownToLinkedInText('> quoted line')).toBe('❯ quoted line');
    expect(markdownToLinkedInText('>quoted no space')).toBe('❯ quoted no space');
  });

  it('drops horizontal rules', () => {
    const md = 'Section 1\n\n---\n\nSection 2';
    const out = markdownToLinkedInText(md);
    expect(out).not.toContain('---');
    expect(out).toContain('Section 1');
    expect(out).toContain('Section 2');
  });

  it('collapses 3+ blank lines into a single blank line', () => {
    const md = 'A\n\n\n\n\nB';
    expect(markdownToLinkedInText(md)).toBe('A\n\nB');
  });

  it('combines multiple constructs cleanly', () => {
    const md = [
      '# The main headline',
      '',
      "It's about **RAG** and _embeddings_.",
      '',
      'Key wins:',
      '- Hit@1 from 30% to 90%',
      '- One line of `code` changed',
      '',
      '> A quote to think about',
    ].join('\n');
    const out = markdownToLinkedInText(md);
    expect(out).toBe([
      'The main headline',
      '',
      "It's about RAG and embeddings.",
      '',
      'Key wins:',
      '• Hit@1 from 30% to 90%',
      '• One line of code changed',
      '',
      '❯ A quote to think about',
    ].join('\n'));
  });
});

describe('truncateAtParagraph', () => {
  it('returns the full text if it fits within budget', () => {
    expect(truncateAtParagraph('short', 100)).toBe('short');
  });

  it('cuts at the last paragraph break within budget', () => {
    const text = 'First paragraph.\n\nSecond paragraph is longer than budget.';
    const out = truncateAtParagraph(text, 20);
    expect(out).toBe('First paragraph.');
  });

  it('does a hard word-boundary cut with ellipsis when no paragraph break exists', () => {
    const text = 'word1 word2 word3 word4 word5 word6 word7 word8';
    const out = truncateAtParagraph(text, 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(20 + 1); // +1 for ellipsis
  });

  it('prefers a paragraph break even if it is late in the budget', () => {
    const text = 'a'.repeat(50) + '\n\n' + 'b'.repeat(50);
    const out = truncateAtParagraph(text, 60);
    expect(out).toBe('a'.repeat(50));
  });

  it('falls back to word cut if paragraph break is only in the first quarter', () => {
    // Break at 10 chars, budget 100 → 10 is only 10 % of budget, we prefer
    // the word-boundary cut so we don't discard 90 % of the article.
    const text = 'aa\n\n' + 'x'.repeat(200);
    const out = truncateAtParagraph(text, 100);
    expect(out.endsWith('…')).toBe(true);
    // Word-boundary cut yielded ~100 chars, much more content than the 2-char
    // "aa" that came before the (too-early) paragraph break.
    expect(out.length).toBeGreaterThan(50);
  });
});

describe('buildLinkedInFirstComment', () => {
  it('includes the canonical blog URL for the slug', () => {
    const article = { slug: 'my-post' };
    const out = buildLinkedInFirstComment(article);
    expect(out).toContain(articleUrl(article));
    expect(out).toContain('/blog/my-post');
  });

  it('is short enough to stay under the LinkedIn comment preview cap (~250 chars)', () => {
    const article = { slug: 'a-very-long-slug-that-still-should-fit-in-a-comment-preview' };
    const out = buildLinkedInFirstComment(article);
    expect(out.length).toBeLessThan(250);
  });
});

describe('buildLinkedInPost', () => {
  it('keeps short articles whole and appends the tagline', () => {
    const article = { content: '# Hello\n\nJust a short intro.', slug: 's' };
    const out = buildLinkedInPost(article);
    expect(out).toContain('Hello');
    expect(out).toContain('Just a short intro.');
    expect(out.endsWith(TAGLINE.trim())).toBe(true);
  });

  it('truncates long articles at a paragraph boundary before MAX_POST_CHARS', () => {
    const bigParagraph = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(30);
    const content = Array(20).fill(bigParagraph).join('\n\n');
    const article = { content, slug: 'x' };
    const out = buildLinkedInPost(article);
    // Body + tagline must not exceed MAX_POST_CHARS
    expect(out.length).toBeLessThanOrEqual(MAX_POST_CHARS);
    // Tagline is still present at the very end
    expect(out.endsWith(TAGLINE.trim())).toBe(true);
    // Not empty
    expect(out.length).toBeGreaterThan(TAGLINE.length + 100);
  });

  it('handles empty content gracefully (only tagline)', () => {
    const article = { content: '', slug: 'x' };
    const out = buildLinkedInPost(article);
    expect(out).toBe(TAGLINE.trim());
  });

  it('handles missing content gracefully', () => {
    const article = { slug: 'x' };
    const out = buildLinkedInPost(article);
    expect(out).toBe(TAGLINE.trim());
  });

  it('does NOT include the article URL in the post body', () => {
    const article = { content: '# Test\n\nBody', slug: 'test-slug' };
    const out = buildLinkedInPost(article);
    expect(out).not.toContain('/blog/test-slug');
    expect(out).not.toContain('http');
  });
});
