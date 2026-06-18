// Pure-function tests for readingTime + content stripper.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/botDb', () => ({ getBotConnection: () => null }));

const {
  _calculateReadingTime: calculateReadingTime,
  _withReadingTime: withReadingTime,
} = require('../controllers/articleController');

describe('calculateReadingTime', () => {
  it('returns 1 for empty / null / undefined / non-string', () => {
    expect(calculateReadingTime('')).toBe(1);
    expect(calculateReadingTime(null)).toBe(1);
    expect(calculateReadingTime(undefined)).toBe(1);
    expect(calculateReadingTime(42)).toBe(1);
  });

  it('returns 1 for very short text (under 200 words)', () => {
    expect(calculateReadingTime('one')).toBe(1);
    expect(calculateReadingTime('hello world')).toBe(1);
    expect(calculateReadingTime(Array(199).fill('word').join(' '))).toBe(1);
  });

  it('returns 1 exactly at 200 words (boundary)', () => {
    expect(calculateReadingTime(Array(200).fill('w').join(' '))).toBe(1);
  });

  it('returns 2 at 201 words (just over boundary)', () => {
    expect(calculateReadingTime(Array(201).fill('w').join(' '))).toBe(2);
  });

  it('rounds up for 5.5 minutes worth (1100 words → 6 min)', () => {
    expect(calculateReadingTime(Array(1100).fill('w').join(' '))).toBe(6);
  });

  it('handles weird whitespace (tabs, newlines, multiple spaces)', () => {
    const content = '  word1\t\tword2\n\n\nword3   word4  ';
    expect(calculateReadingTime(content)).toBe(1);
  });
});

describe('withReadingTime', () => {
  it('adds readingTime to a plain object', () => {
    const article = { title: 'Test', content: 'hello world', excerpt: 'hi' };
    const out = withReadingTime(article);
    expect(out.readingTime).toBe(1);
    expect(out.title).toBe('Test');
    expect(out.content).toBe('hello world'); // not stripped by default
  });

  it('strips content when stripContent=true (for list endpoints)', () => {
    const article = { title: 'T', content: Array(500).fill('w').join(' ') };
    const out = withReadingTime(article, { stripContent: true });
    expect(out.readingTime).toBe(3); // 500 / 200 = 2.5 → 3
    expect('content' in out).toBe(false);
  });

  it('uses doc.toObject() if available (Mongoose doc) and does not mutate the original', () => {
    const fakeMongooseDoc = {
      _internal: 'gunk',
      toObject() {
        return { title: 'From toObject', content: 'one two three' };
      },
    };
    const out = withReadingTime(fakeMongooseDoc);
    expect(out.title).toBe('From toObject');
    expect(out.readingTime).toBe(1);
    expect(out._internal).toBeUndefined();
  });
});
