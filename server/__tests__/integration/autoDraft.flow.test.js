// Integration test — the weekly cron endpoint.
// Mocks Anthropic SDK + GitHub fetch + email — we test that OUR wiring is
// correct: secret check → Claude call → DB save as draft → email fired.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

// Mock the AIAgent so no real Claude call (and no real GitHub fetch)
const AIAgent = require('../../services/AIAgent');
const generateWeeklyDraftSpy = vi.spyOn(AIAgent, 'generateWeeklyDraft');

// Mock the email send so SMTP isn't required
const EmailService = require('../../services/EmailService');
const sendDraftNotifSpy = vi
  .spyOn(EmailService, 'sendDraftNotification')
  .mockResolvedValue({ messageId: 'fake' });

beforeAll(startServer, 30_000);
afterAll(stopServer);
beforeEach(async () => {
  generateWeeklyDraftSpy.mockReset();
  sendDraftNotifSpy.mockClear();
  await cleanCollections();
});

async function seedAdmin() {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@example.com', password: 'adminpassword' });
  const User = require('../../models/User');
  await User.updateOne({ _id: reg.body.user.id }, { $set: { role: 'admin' } });
}

describe('POST /api/ai/auto-draft (cron endpoint)', () => {
  it('rejects request without X-Cron-Secret header', async () => {
    const res = await request(app).post('/api/ai/auto-draft').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid cron secret/);
    expect(generateWeeklyDraftSpy).not.toHaveBeenCalled();
  });

  it('rejects request with wrong cron secret', async () => {
    const res = await request(app)
      .post('/api/ai/auto-draft')
      .set('X-Cron-Secret', 'wrong-secret')
      .send({});
    expect(res.status).toBe(401);
    expect(generateWeeklyDraftSpy).not.toHaveBeenCalled();
  });

  it('returns 200 + skipped when there are no recent commits', async () => {
    await seedAdmin();
    generateWeeklyDraftSpy.mockResolvedValue({
      article: null,
      skipped: 'no-recent-activity',
      costUsd: 0,
    });

    const res = await request(app)
      .post('/api/ai/auto-draft')
      .set('X-Cron-Secret', 'test-cron-secret')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe('no-recent-activity');
    expect(sendDraftNotifSpy).not.toHaveBeenCalled();

    // No article was saved
    const Article = require('../../models/Article');
    expect(await Article.countDocuments()).toBe(0);
  });

  it('saves a draft and sends the email on a successful generation', async () => {
    await seedAdmin();
    generateWeeklyDraftSpy.mockResolvedValue({
      article: {
        title: 'Auto-generated weekly post',
        slug: 'auto-generated-weekly-post',
        excerpt: 'A short excerpt.',
        content: '# Hello\n\nBody.',
        tags: ['ai', 'weekly'],
      },
      costUsd: 0.04,
      monthlySpent: 0.04,
      inputTokens: 1000,
      outputTokens: 1500,
      activitySummary: { commitsAnalyzed: 5, reposTouched: ['Gnaro-Shaft/x'] },
    });

    const res = await request(app)
      .post('/api/ai/auto-draft')
      .set('X-Cron-Secret', 'test-cron-secret')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Auto-generated weekly post');
    expect(res.body.data.commitsAnalyzed).toBe(5);

    // Draft persisted in DB
    const Article = require('../../models/Article');
    const saved = await Article.findOne({ slug: 'auto-generated-weekly-post' });
    expect(saved).toBeTruthy();
    expect(saved.published).toBe(false); // critical: cron creates DRAFTS only
    expect(saved.author).toBeTruthy(); // attributed to the admin

    // Email notification was fired
    await new Promise((r) => setImmediate(r));
    expect(sendDraftNotifSpy).toHaveBeenCalledTimes(1);
    const callArg = sendDraftNotifSpy.mock.calls[0][0];
    expect(callArg.article.title).toBe('Auto-generated weekly post');
  });

  it('returns 500 if there is no admin user to attribute the article to', async () => {
    // Don't seed any admin
    generateWeeklyDraftSpy.mockResolvedValue({
      article: {
        title: 'Orphan',
        slug: 'orphan',
        content: 'x',
        tags: [],
      },
      costUsd: 0.04,
      activitySummary: { commitsAnalyzed: 1, reposTouched: ['r'] },
    });

    const res = await request(app)
      .post('/api/ai/auto-draft')
      .set('X-Cron-Secret', 'test-cron-secret')
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/admin/i);
  });
});
