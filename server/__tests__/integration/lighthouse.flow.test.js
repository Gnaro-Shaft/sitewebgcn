// Integration test for the Lighthouse endpoints.
// global.fetch is mocked so no real PageSpeed Insights call is made.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

beforeAll(startServer, 30_000);
afterAll(stopServer);
beforeEach(cleanCollections);

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

function mockPageSpeed(strategy, scores) {
  global.fetch = vi.fn(async (url) => {
    const isMobile = url.includes('strategy=mobile');
    const s = isMobile ? scores.mobile : scores.desktop;
    return {
      ok: true,
      json: async () => ({
        lighthouseResult: {
          lighthouseVersion: '11.0.0',
          categories: {
            performance: { score: s.performance / 100 },
            seo: { score: s.seo / 100 },
            accessibility: { score: s.accessibility / 100 },
            'best-practices': { score: s.bestPractices / 100 },
          },
        },
      }),
    };
  });
}

describe('GET /api/lighthouse/latest', () => {
  it('returns null mobile + desktop when no scores stored', async () => {
    const res = await request(app).get('/api/lighthouse/latest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mobile).toBeNull();
    expect(res.body.data.desktop).toBeNull();
  });

  it('returns the latest score per strategy', async () => {
    // Seed two scores at different timestamps.
    // URL must match the controller's default (process.env.SITE_URL, set in setup.js).
    const LighthouseScore = require('../../models/LighthouseScore');
    const url = process.env.SITE_URL;
    await LighthouseScore.create({
      url,
      strategy: 'mobile',
      performance: 80,
      seo: 90,
      accessibility: 85,
      bestPractices: 95,
      fetchedAt: new Date('2026-06-10T10:00:00Z'),
    });
    await LighthouseScore.create({
      url,
      strategy: 'mobile',
      performance: 95, // newer — this should win
      seo: 100,
      accessibility: 92,
      bestPractices: 100,
      fetchedAt: new Date('2026-06-17T10:00:00Z'),
    });
    await LighthouseScore.create({
      url,
      strategy: 'desktop',
      performance: 100,
      seo: 100,
      accessibility: 95,
      bestPractices: 100,
      fetchedAt: new Date('2026-06-17T10:00:00Z'),
    });

    const res = await request(app).get('/api/lighthouse/latest');
    expect(res.status).toBe(200);
    expect(res.body.data.mobile.performance).toBe(95);
    expect(res.body.data.mobile.seo).toBe(100);
    expect(res.body.data.desktop.performance).toBe(100);
  });
});

describe('POST /api/lighthouse/refresh', () => {
  it('rejects without X-Cron-Secret', async () => {
    const res = await request(app).post('/api/lighthouse/refresh').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid cron secret/);
  });

  it('rejects with wrong secret', async () => {
    const res = await request(app)
      .post('/api/lighthouse/refresh')
      .set('X-Cron-Secret', 'nope')
      .send({});
    expect(res.status).toBe(401);
  });

  it('fetches PageSpeed, saves to DB, and the next /latest returns the data', async () => {
    mockPageSpeed('both', {
      mobile: { performance: 88, seo: 100, accessibility: 90, bestPractices: 95 },
      desktop: { performance: 99, seo: 100, accessibility: 95, bestPractices: 100 },
    });

    const refresh = await request(app)
      .post('/api/lighthouse/refresh')
      .set('X-Cron-Secret', 'test-cron-secret')
      .send({});
    expect(refresh.status).toBe(200);
    expect(refresh.body.success).toBe(true);
    expect(refresh.body.data.results).toHaveLength(2);

    const latest = await request(app).get('/api/lighthouse/latest');
    expect(latest.body.data.mobile.performance).toBe(88);
    expect(latest.body.data.desktop.performance).toBe(99);
  });

  it('handles a PageSpeed API failure per strategy without crashing the whole call', async () => {
    let callCount = 0;
    global.fetch = vi.fn(async (url) => {
      callCount++;
      if (url.includes('strategy=mobile')) {
        return { ok: false, status: 500, text: async () => 'Server error' };
      }
      return {
        ok: true,
        json: async () => ({
          lighthouseResult: {
            lighthouseVersion: '11.0.0',
            categories: {
              performance: { score: 0.99 },
              seo: { score: 1 },
              accessibility: { score: 0.95 },
              'best-practices': { score: 1 },
            },
          },
        }),
      };
    });

    const refresh = await request(app)
      .post('/api/lighthouse/refresh')
      .set('X-Cron-Secret', 'test-cron-secret')
      .send({});

    expect(refresh.status).toBe(200);
    const results = refresh.body.data.results;
    const mobile = results.find((r) => r.strategy === 'mobile');
    const desktop = results.find((r) => r.strategy === 'desktop');
    expect(mobile.error).toMatch(/500/);
    expect(desktop.scores.performance).toBe(99);

    // Only desktop should be in the DB
    const LighthouseScore = require('../../models/LighthouseScore');
    expect(await LighthouseScore.countDocuments()).toBe(1);
  });
});
