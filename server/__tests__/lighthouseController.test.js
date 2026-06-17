// Pure-function tests for lighthouseController — no DB, no network.
// fetchPageSpeed is tested by mocking global.fetch.

import { describe, it, expect, vi, afterEach } from 'vitest';

// botDb is required by something in the require chain; mock it out
vi.mock('../config/botDb', () => ({ getBotConnection: () => null }));

const { _fetchPageSpeed: fetchPageSpeed, _formatScore: formatScore } =
  require('../controllers/lighthouseController');

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

function mockPageSpeedOK(scores) {
  // PageSpeed Insights API returns scores as 0..1
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      lighthouseResult: {
        lighthouseVersion: '11.0.0',
        categories: {
          performance: scores.performance != null ? { score: scores.performance / 100 } : undefined,
          seo: scores.seo != null ? { score: scores.seo / 100 } : undefined,
          accessibility: scores.accessibility != null ? { score: scores.accessibility / 100 } : undefined,
          'best-practices': scores.bestPractices != null ? { score: scores.bestPractices / 100 } : undefined,
        },
      },
    }),
  });
}

describe('fetchPageSpeed', () => {
  it('converts 0..1 scores to 0..100 integers', async () => {
    mockPageSpeedOK({ performance: 92, seo: 100, accessibility: 87, bestPractices: 100 });
    const res = await fetchPageSpeed({ url: 'https://gcn-data.fr', strategy: 'mobile' });
    expect(res.performance).toBe(92);
    expect(res.seo).toBe(100);
    expect(res.accessibility).toBe(87);
    expect(res.bestPractices).toBe(100);
    expect(res.lighthouseVersion).toBe('11.0.0');
  });

  it('rounds fractional scores to nearest integer', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          categories: {
            performance: { score: 0.876 }, // 87.6 → 88
            seo: { score: 0.945 }, // 94.5 → 95 (banker's rounding edge case)
            accessibility: { score: 0.5 },
            'best-practices': { score: 0.999 }, // 99.9 → 100
          },
        },
      }),
    });
    const res = await fetchPageSpeed({ url: 'https://x', strategy: 'mobile' });
    expect(res.performance).toBe(88);
    expect(res.seo).toBe(95);
    expect(res.accessibility).toBe(50);
    expect(res.bestPractices).toBe(100);
  });

  it('returns null for missing categories (partial response)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          categories: {
            performance: { score: 0.9 },
            // seo, accessibility, best-practices missing
          },
        },
      }),
    });
    const res = await fetchPageSpeed({ url: 'https://x', strategy: 'mobile' });
    expect(res.performance).toBe(90);
    expect(res.seo).toBeNull();
    expect(res.accessibility).toBeNull();
    expect(res.bestPractices).toBeNull();
  });

  it('appends the API key to the request when PAGESPEED_API_KEY is set', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ lighthouseResult: { categories: {} } }),
      };
    });

    process.env.PAGESPEED_API_KEY = 'TEST_KEY_123';
    try {
      await fetchPageSpeed({ url: 'https://x', strategy: 'mobile' });
    } finally {
      delete process.env.PAGESPEED_API_KEY;
    }
    expect(calls[0]).toContain('key=TEST_KEY_123');
  });

  it('passes the strategy parameter (mobile/desktop)', async () => {
    let captured = null;
    global.fetch = vi.fn(async (url) => {
      captured = url;
      return { ok: true, json: async () => ({ lighthouseResult: { categories: {} } }) };
    });

    await fetchPageSpeed({ url: 'https://x', strategy: 'desktop' });
    expect(captured).toContain('strategy=desktop');
  });

  it('throws on non-OK response with the status + body in the message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":{"message":"Quota exceeded"}}',
    });
    await expect(
      fetchPageSpeed({ url: 'https://x', strategy: 'mobile' })
    ).rejects.toThrow(/429/);
  });
});

describe('formatScore', () => {
  it('exposes the public score fields and hides Mongoose internals', () => {
    const doc = {
      performance: 95,
      seo: 100,
      accessibility: 92,
      bestPractices: 100,
      fetchedAt: new Date('2026-06-17T10:00:00Z'),
      lighthouseVersion: '11.0.0',
      __v: 0,
      _id: 'mongo-internal',
    };
    const out = formatScore(doc);
    expect(out).toEqual({
      performance: 95,
      seo: 100,
      accessibility: 92,
      bestPractices: 100,
      fetchedAt: doc.fetchedAt,
      lighthouseVersion: '11.0.0',
    });
    // No Mongoose junk leaked
    expect('_id' in out).toBe(false);
    expect('__v' in out).toBe(false);
  });
});
