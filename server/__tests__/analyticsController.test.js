// Tests for the analytics date math (period parsing, ranges, delta).
// Pure functions, no DB. Mongoose model is mocked because the controller
// requires it.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../models/PageView', () => ({
  default: {},
  countDocuments: () => 0,
  aggregate: () => [],
}));

const {
  _rangeForPeriod: rangeForPeriod,
  _parseRange: parseRange,
  _computeDelta: computeDelta,
  _autoGranularity: autoGranularity,
} = require('../controllers/analyticsController');

// Fix "now" so tests are deterministic. June 9th 2026, 14:30 UTC — a Tuesday.
const NOW = new Date('2026-06-09T14:30:00.000Z');

describe('computeDelta — percentage change with edge cases', () => {
  it('positive delta: +50%', () => {
    expect(computeDelta(15, 10)).toBe(50);
  });

  it('negative delta: -50%', () => {
    expect(computeDelta(5, 10)).toBe(-50);
  });

  it('rounds to 1 decimal', () => {
    expect(computeDelta(7, 6)).toBe(16.7); // (7-6)/6 = 0.1666...
  });

  it('returns 0 when both current and previous are 0', () => {
    expect(computeDelta(0, 0)).toBe(0);
  });

  it('returns null when previous=0 and current>0 (avoid +Infinity)', () => {
    expect(computeDelta(10, 0)).toBeNull();
  });

  it('handles zero current with previous>0 → -100%', () => {
    expect(computeDelta(0, 8)).toBe(-100);
  });
});

describe('autoGranularity — buckets selected from span size', () => {
  it('hour for spans ≤ 48h', () => {
    expect(autoGranularity(24 * 3600 * 1000)).toBe('hour');
    expect(autoGranularity(48 * 3600 * 1000)).toBe('hour');
  });

  it('day for spans between 48h and 90d', () => {
    expect(autoGranularity(7 * 24 * 3600 * 1000)).toBe('day');
    expect(autoGranularity(90 * 24 * 3600 * 1000)).toBe('day');
  });

  it('month for spans > 90d', () => {
    expect(autoGranularity(180 * 24 * 3600 * 1000)).toBe('month');
    expect(autoGranularity(365 * 24 * 3600 * 1000)).toBe('month');
  });
});

describe('rangeForPeriod — calendar bounds + previous equivalent', () => {
  it('today: from UTC midnight to now, previous = yesterday', () => {
    const r = rangeForPeriod('today', NOW);
    expect(r.since.toISOString()).toBe('2026-06-09T00:00:00.000Z');
    expect(r.until).toBe(NOW);
    // Previous: yesterday 00:00 → today 00:00 (24h block)
    expect(r.prevSince.toISOString()).toBe('2026-06-08T00:00:00.000Z');
    expect(r.prevUntil.toISOString()).toBe('2026-06-09T00:00:00.000Z');
  });

  it('month: calendar month, previous = previous calendar month', () => {
    const r = rangeForPeriod('month', NOW);
    expect(r.since.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.until).toBe(NOW);
    // Previous month = May 2026
    expect(r.prevSince.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(r.prevUntil.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('year: calendar year, previous = previous calendar year', () => {
    const r = rangeForPeriod('year', NOW);
    expect(r.since.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.prevSince.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(r.prevUntil.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('7d: sliding 7-day window, previous = the 7 days before', () => {
    const r = rangeForPeriod('7d', NOW);
    const dayMs = 24 * 3600 * 1000;
    expect(r.since.getTime()).toBe(NOW.getTime() - 7 * dayMs);
    expect(r.prevSince.getTime()).toBe(NOW.getTime() - 14 * dayMs);
    expect(r.prevUntil.getTime()).toBe(r.since.getTime());
  });

  it('30d: sliding 30-day window', () => {
    const r = rangeForPeriod('30d', NOW);
    const dayMs = 24 * 3600 * 1000;
    expect(r.since.getTime()).toBe(NOW.getTime() - 30 * dayMs);
    expect(r.prevSince.getTime()).toBe(NOW.getTime() - 60 * dayMs);
  });

  it('all: from epoch, no previous range', () => {
    const r = rangeForPeriod('all', NOW);
    expect(r.since.getTime()).toBe(0);
    expect(r.prevSince).toBeNull();
    expect(r.prevUntil).toBeNull();
  });

  it('unknown period falls back to 24h', () => {
    const r = rangeForPeriod('totally-made-up', NOW);
    const dayMs = 24 * 3600 * 1000;
    expect(r.since.getTime()).toBe(NOW.getTime() - dayMs);
    expect(r.prevSince.getTime()).toBe(NOW.getTime() - 2 * dayMs);
  });

  it('month rollover: January computes previous month as December last year', () => {
    const jan15 = new Date('2026-01-15T00:00:00.000Z');
    const r = rangeForPeriod('month', jan15);
    expect(r.since.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.prevSince.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(r.prevUntil.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('parseRange — query → range with granularity', () => {
  it('uses query.period when given (no start/end)', () => {
    const r = parseRange({ period: 'today' });
    // today → granularity auto-selected to "hour" (span < 48h)
    expect(r.granularity).toBe('hour');
  });

  it('uses custom start/end and computes equivalent previous range', () => {
    const r = parseRange({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-08T00:00:00.000Z',
    });
    expect(r.since.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.until.toISOString()).toBe('2026-06-08T00:00:00.000Z');
    // 7-day span → previous = May 25 to June 1
    expect(r.prevUntil.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.prevSince.toISOString()).toBe('2026-05-25T00:00:00.000Z');
  });

  it('rejects invalid start/end and falls back to default period', () => {
    const r = parseRange({ start: 'not-a-date', end: 'also-not' });
    // Falls back to default 7d, which has a non-null previous range
    expect(r.since).toBeInstanceOf(Date);
    expect(r.prevSince).toBeInstanceOf(Date);
  });

  it('rejects start > end and falls back to default period', () => {
    const r = parseRange({
      start: '2026-06-08T00:00:00.000Z',
      end: '2026-06-01T00:00:00.000Z',
    });
    // Falls back to default 7d
    expect(r.since).toBeInstanceOf(Date);
    expect(r.prevSince).toBeInstanceOf(Date);
  });

  it('honors explicit valid granularity from query', () => {
    const r = parseRange({ period: 'today', granularity: 'day' });
    expect(r.granularity).toBe('day');
  });

  it('ignores invalid granularity and auto-selects', () => {
    const r = parseRange({ period: 'year', granularity: 'second' });
    expect(r.granularity).toBe('month'); // span > 90d → month
  });
});
