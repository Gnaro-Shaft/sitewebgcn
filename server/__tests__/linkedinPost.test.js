// Tests unitaires de la validation du post LinkedIn. Purs — ni DB, ni réseau.
//
// Les suites qui testaient markdownToLinkedInText / truncateAtParagraph /
// buildLinkedInPost ont disparu avec le gabarit : le texte du post est
// désormais écrit à la main dans le tableau de bord, plus dérivé de
// l'article. Ce qui reste à tester, c'est ce qu'on refuse d'enfiler.
import { describe, it, expect } from 'vitest';

const {
  articleUrl,
  validatePostText,
  validateFirstComment,
  MAX_POST_CHARS,
  MIN_POST_CHARS,
  MAX_COMMENT_CHARS,
} = require('../services/linkedinPost');

// Texte plancher valide, réutilisé dans plusieurs cas.
const VALID = 'a'.repeat(MIN_POST_CHARS);

describe('articleUrl', () => {
  it('builds the canonical blog URL from the slug', () => {
    expect(articleUrl({ slug: 'mon-article' })).toMatch(/\/blog\/mon-article$/);
  });

  it('keeps accented and hyphenated slugs untouched', () => {
    expect(articleUrl({ slug: 'deployer-sur-fly-io' })).toContain('/blog/deployer-sur-fly-io');
  });
});

describe('validatePostText — ce qui est refusé', () => {
  it('rejects a missing, null or non-string text', () => {
    expect(validatePostText(undefined).ok).toBe(false);
    expect(validatePostText(null).ok).toBe(false);
    expect(validatePostText(42).ok).toBe(false);
    expect(validatePostText({}).ok).toBe(false);
  });

  it('rejects an empty string and a whitespace-only string', () => {
    expect(validatePostText('').ok).toBe(false);
    expect(validatePostText('   ').ok).toBe(false);
    expect(validatePostText('\n\n\t  \n').ok).toBe(false);
  });

  it('rejects a text below the minimum once trimmed', () => {
    const result = validatePostText('   court   ');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('minimum');
  });

  it('rejects a text above the maximum', () => {
    const result = validatePostText('a'.repeat(MAX_POST_CHARS + 1));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('maximum');
  });

  it('counts the TRIMMED length, so surrounding whitespace cannot smuggle a too-long text', () => {
    const padded = `\n\n${'a'.repeat(MAX_POST_CHARS)}\n\n`;
    expect(padded.length).toBeGreaterThan(MAX_POST_CHARS);
    expect(validatePostText(padded).ok).toBe(true);
  });
});

describe('validatePostText — ce qui passe', () => {
  it('accepts a text exactly at the minimum boundary', () => {
    expect(validatePostText(VALID).ok).toBe(true);
  });

  it('accepts a text exactly at the maximum boundary', () => {
    expect(validatePostText('a'.repeat(MAX_POST_CHARS)).ok).toBe(true);
  });

  it('accepts accented French, emojis and line breaks', () => {
    const text = "J'ai déployé une régression en prod un vendredi 🙃\n\nVoilà ce que j'en ai retenu.";
    expect(text.trim().length).toBeGreaterThanOrEqual(MIN_POST_CHARS);
    expect(validatePostText(text).ok).toBe(true);
  });

  it('never returns an error field on success', () => {
    expect(validatePostText(VALID).error).toBeUndefined();
  });
});

describe('validateFirstComment', () => {
  it('accepts an empty, null or undefined comment (the URL fallback applies)', () => {
    expect(validateFirstComment(undefined).ok).toBe(true);
    expect(validateFirstComment(null).ok).toBe(true);
    expect(validateFirstComment('').ok).toBe(true);
  });

  it('accepts a bare URL', () => {
    expect(validateFirstComment('https://gcn-data.fr/blog/mon-article').ok).toBe(true);
  });

  it('accepts a comment exactly at the maximum boundary', () => {
    expect(validateFirstComment('a'.repeat(MAX_COMMENT_CHARS)).ok).toBe(true);
  });

  it('rejects a comment above the LinkedIn cap, before n8n marks it failed', () => {
    const result = validateFirstComment('a'.repeat(MAX_COMMENT_CHARS + 1));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('maximum');
  });

  it('rejects a non-string comment', () => {
    expect(validateFirstComment(42).ok).toBe(false);
    expect(validateFirstComment({}).ok).toBe(false);
  });
});

describe('bornes', () => {
  it('leaves room under the hard LinkedIn cap of 3000 chars', () => {
    expect(MAX_POST_CHARS).toBeLessThan(3000);
  });

  it('keeps the minimum low enough for a short punchy post', () => {
    expect(MIN_POST_CHARS).toBeLessThan(200);
  });
});
