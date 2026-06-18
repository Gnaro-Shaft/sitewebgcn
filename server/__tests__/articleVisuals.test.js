// Unit tests for the client-side articleVisuals utils.
// They're pure JS (no React/DOM) so vitest can run them directly even
// though they live under client/src/utils — we import by relative path.

import { describe, it, expect } from 'vitest';
import {
  GRADIENT_PALETTES,
  gradientForSlug,
  colorForTag,
  tagChipStyle,
} from '../../client/src/utils/articleVisuals.js';

describe('gradientForSlug', () => {
  it('is deterministic — same slug → same palette', () => {
    const slug = 'a-b-test-embeddings-on-mnemo';
    expect(gradientForSlug(slug)).toBe(gradientForSlug(slug));
  });

  it('returns a palette from the known set', () => {
    expect(GRADIENT_PALETTES).toContain(gradientForSlug('any-slug'));
  });

  it('returns the default palette for empty / null / undefined slug', () => {
    expect(gradientForSlug('')).toBe(GRADIENT_PALETTES[0]);
    expect(gradientForSlug(null)).toBe(GRADIENT_PALETTES[0]);
    expect(gradientForSlug(undefined)).toBe(GRADIENT_PALETTES[0]);
  });

  it('distributes hash-style — different slugs land on multiple palettes', () => {
    const seen = new Set();
    const slugs = [
      'foo',
      'bar',
      'baz',
      'qux',
      'a-b-test-embeddings',
      'lighthouse-badges',
      'refresh-tokens',
      'upload-cloudinary',
      'blog-redesign',
      'rag-eval',
    ];
    slugs.forEach((s) => seen.add(gradientForSlug(s)));
    // Don't expect perfect spread; just confirm we don't collapse to 1.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('colorForTag', () => {
  it('maps known tags to their hex color', () => {
    expect(colorForTag('claude')).toBe('#8b5cf6');
    expect(colorForTag('ai')).toBe('#8b5cf6');
    expect(colorForTag('rag')).toBe('#6366f1');
    expect(colorForTag('docker')).toBe('#f97316');
  });

  it('is case-insensitive', () => {
    expect(colorForTag('CLAUDE')).toBe('#8b5cf6');
    expect(colorForTag('Rag')).toBe('#6366f1');
  });

  it('returns null for unknown / empty / null tags (fallback to gray in UI)', () => {
    expect(colorForTag('unknown-tag')).toBeNull();
    expect(colorForTag('')).toBeNull();
    expect(colorForTag(null)).toBeNull();
    expect(colorForTag(undefined)).toBeNull();
  });
});

describe('tagChipStyle', () => {
  it('returns inline style with color + border + faded background for known tags', () => {
    const style = tagChipStyle('claude');
    expect(style.color).toBe('#8b5cf6');
    expect(style.borderColor).toBe('#8b5cf6');
    expect(style.backgroundColor).toBe('#8b5cf61a');
  });

  it('returns empty object for unknown tags (component uses its default gray classes)', () => {
    expect(tagChipStyle('xyz-not-a-tag')).toEqual({});
    expect(tagChipStyle(null)).toEqual({});
  });
});
