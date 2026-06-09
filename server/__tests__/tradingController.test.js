// Tests for the signal-level resolution logic.
// These are pure functions, no DB needed.

import { describe, it, expect, vi } from 'vitest';

// botDb is required by tradingController for the actual endpoint —
// it's harmless to mock it as null because we only test the pure helpers.
vi.mock('../config/botDb', () => ({
  getBotConnection: () => null,
}));

const { _scoreToLevel: scoreToLevel, _resolveLevel: resolveLevel } =
  require('../controllers/tradingController');

describe('scoreToLevel (bot V8 score -9..+9 → bucket -2..+2)', () => {
  it('strong sell when score ≤ -4', () => {
    expect(scoreToLevel(-9)).toBe(-2);
    expect(scoreToLevel(-5)).toBe(-2);
    expect(scoreToLevel(-4)).toBe(-2);
  });

  it('light sell when -3 ≤ score ≤ -2', () => {
    expect(scoreToLevel(-3)).toBe(-1);
    expect(scoreToLevel(-2)).toBe(-1);
  });

  it('neutral when -1 ≤ score ≤ 1', () => {
    expect(scoreToLevel(-1)).toBe(0);
    expect(scoreToLevel(0)).toBe(0);
    expect(scoreToLevel(1)).toBe(0);
  });

  it('light buy when 2 ≤ score ≤ 3', () => {
    expect(scoreToLevel(2)).toBe(1);
    expect(scoreToLevel(3)).toBe(1);
  });

  it('strong buy when score ≥ 4', () => {
    expect(scoreToLevel(4)).toBe(2);
    expect(scoreToLevel(7)).toBe(2);
    expect(scoreToLevel(9)).toBe(2);
  });

  it('defaults to neutral (0) for non-numeric input', () => {
    expect(scoreToLevel(null)).toBe(0);
    expect(scoreToLevel(undefined)).toBe(0);
    expect(scoreToLevel('foo')).toBe(0);
  });
});

describe('resolveLevel (cross-version compatibility with bot schemas)', () => {
  it('prefers signal_level (V8) when present', () => {
    // V8 sets signal_level explicitly; we MUST honor it, even if our own
    // bucketing of score would disagree.
    expect(resolveLevel({ signal_level: -1, score: -8 })).toBe(-1);
    expect(resolveLevel({ signal_level: 2, score: 1 })).toBe(2);
    expect(resolveLevel({ signal_level: 0 })).toBe(0); // explicit zero
  });

  it('falls back to signal_score (older bot versions)', () => {
    expect(resolveLevel({ signal_score: -2 })).toBe(-2);
    expect(resolveLevel({ signal_score: 1, score: 99 })).toBe(1);
  });

  it('falls back to bucketing score when no level field exists', () => {
    expect(resolveLevel({ score: -7 })).toBe(-2);
    expect(resolveLevel({ score: 0 })).toBe(0);
    expect(resolveLevel({ score: 5 })).toBe(2);
  });

  it('falls back to bucketing raw_score when only that is present', () => {
    expect(resolveLevel({ raw_score: -4 })).toBe(-2);
    expect(resolveLevel({ raw_score: 2 })).toBe(1);
  });

  it('returns 0 for a completely empty signal doc', () => {
    expect(resolveLevel({})).toBe(0);
  });

  it('ignores non-numeric signal_level (typeof guard works)', () => {
    expect(resolveLevel({ signal_level: 'strong sell', score: -8 })).toBe(-2);
    expect(resolveLevel({ signal_level: null, score: 5 })).toBe(2);
  });
});
