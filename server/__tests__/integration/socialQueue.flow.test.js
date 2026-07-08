// Integration tests for the Phase 24 social queue endpoints consumed by
// n8n on homeserv01. All 3 endpoints require the X-N8N-Secret header;
// requests without it get 401.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

beforeAll(startServer, 30_000);
afterAll(async () => {
  delete process.env.N8N_SHARED_SECRET;
  await stopServer();
});
beforeEach(async () => {
  await cleanCollections();
  // Set a stable secret for these tests
  process.env.N8N_SHARED_SECRET = 'test-n8n-secret';
});

const AUTH = { 'X-N8N-Secret': 'test-n8n-secret' };

// Helpers ---------------------------------------------------------------

async function seedAdmin() {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@example.com', password: 'adminpassword' });
  const User = require('../../models/User');
  await User.updateOne({ _id: reg.body.user.id }, { $set: { role: 'admin' } });
  return reg.body.user.id;
}

async function seedQueuedArticle({ title = 'Queued', content = '# T\n\nBody', slug = 'queued' } = {}) {
  const Article = require('../../models/Article');
  const authorId = await seedAdmin();
  return Article.create({
    title,
    slug,
    content,
    excerpt: 'excerpt',
    tags: ['ai', 'rag'],
    published: true,
    publishedAt: new Date(),
    author: authorId,
    socialPosted: {
      linkedin: { status: 'queued', queuedAt: new Date() },
      x: { status: 'pending' },
    },
  });
}

// Tests ------------------------------------------------------------------

describe('GET /api/social/pending', () => {
  it('rejects requests without X-N8N-Secret', async () => {
    const res = await request(app).get('/api/social/pending?platform=linkedin');
    expect(res.status).toBe(401);
  });

  it('rejects requests with the wrong secret', async () => {
    const res = await request(app)
      .get('/api/social/pending?platform=linkedin')
      .set('X-N8N-Secret', 'wrong');
    expect(res.status).toBe(401);
  });

  it('returns an empty list when no articles are queued', async () => {
    const res = await request(app).get('/api/social/pending?platform=linkedin').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('returns queued articles with pre-built LinkedIn payload', async () => {
    const article = await seedQueuedArticle({
      title: 'AB test embeddings',
      content: '# Intro\n\nWe A/B tested **bge-m3** and got 90% Hit@1.',
      slug: 'ab-test-embeddings',
    });

    const res = await request(app).get('/api/social/pending?platform=linkedin').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);

    const item = res.body.data[0];
    expect(item.articleId).toBe(String(article._id));
    expect(item.slug).toBe('ab-test-embeddings');
    expect(item.title).toBe('AB test embeddings');
    expect(item.text).toContain('Intro');
    expect(item.text).toContain('bge-m3');
    // No URL in the post body
    expect(item.text).not.toContain('/blog/');
    // First comment contains the URL
    expect(item.firstComment).toContain('/blog/ab-test-embeddings');
    expect(item.url).toContain('/blog/ab-test-embeddings');
  });

  it('does not return articles with status posted or pending', async () => {
    const authorId = await seedAdmin();
    const Article = require('../../models/Article');
    await Article.create({
      title: 'Already posted',
      slug: 'posted',
      content: 'c',
      author: authorId,
      published: true,
      socialPosted: {
        linkedin: { status: 'posted', postedAt: new Date() },
      },
    });
    await Article.create({
      title: 'Never queued',
      slug: 'pending',
      content: 'c',
      author: authorId,
      published: true,
      socialPosted: { linkedin: { status: 'pending' } },
    });

    const res = await request(app).get('/api/social/pending?platform=linkedin').set(AUTH);
    expect(res.body.count).toBe(0);
  });

  it('sorts by queuedAt ascending (FIFO)', async () => {
    const authorId = await seedAdmin();
    const Article = require('../../models/Article');
    const older = await Article.create({
      title: 'Older',
      slug: 'older',
      content: 'c',
      author: authorId,
      published: true,
      socialPosted: {
        linkedin: { status: 'queued', queuedAt: new Date('2026-06-01T00:00:00Z') },
      },
    });
    const newer = await Article.create({
      title: 'Newer',
      slug: 'newer',
      content: 'c',
      author: authorId,
      published: true,
      socialPosted: {
        linkedin: { status: 'queued', queuedAt: new Date('2026-07-01T00:00:00Z') },
      },
    });

    const res = await request(app).get('/api/social/pending?platform=linkedin').set(AUTH);
    expect(res.body.data.map((i) => i.title)).toEqual(['Older', 'Newer']);
    expect(res.body.data[0].articleId).toBe(String(older._id));
    expect(res.body.data[1].articleId).toBe(String(newer._id));
  });
});

describe('POST /api/social/mark-posted', () => {
  it('rejects without X-N8N-Secret', async () => {
    const res = await request(app).post('/api/social/mark-posted').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when articleId or platform is missing', async () => {
    const r1 = await request(app).post('/api/social/mark-posted').set(AUTH).send({});
    expect(r1.status).toBe(400);
    const r2 = await request(app).post('/api/social/mark-posted').set(AUTH).send({ platform: 'linkedin' });
    expect(r2.status).toBe(400);
  });

  it('returns 400 for an unknown platform', async () => {
    const article = await seedQueuedArticle();
    const res = await request(app)
      .post('/api/social/mark-posted')
      .set(AUTH)
      .send({ articleId: String(article._id), platform: 'facebook' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown articleId', async () => {
    const res = await request(app)
      .post('/api/social/mark-posted')
      .set(AUTH)
      .send({ articleId: '000000000000000000000000', platform: 'linkedin' });
    expect(res.status).toBe(404);
  });

  it('flips status to posted and stores postUrn + commentUrn', async () => {
    const article = await seedQueuedArticle();

    const res = await request(app)
      .post('/api/social/mark-posted')
      .set(AUTH)
      .send({
        articleId: String(article._id),
        platform: 'linkedin',
        postUrn: 'urn:li:share:7040',
        commentUrn: 'urn:li:comment:7041',
      });
    expect(res.status).toBe(200);

    const Article = require('../../models/Article');
    const updated = await Article.findById(article._id);
    expect(updated.socialPosted.linkedin.status).toBe('posted');
    expect(updated.socialPosted.linkedin.postUrn).toBe('urn:li:share:7040');
    expect(updated.socialPosted.linkedin.commentUrn).toBe('urn:li:comment:7041');
    expect(updated.socialPosted.linkedin.postedAt).toBeTruthy();
    // The other platform stays untouched
    expect(updated.socialPosted.x.status).toBe('pending');
  });
});

describe('POST /api/social/mark-failed', () => {
  it('rejects without X-N8N-Secret', async () => {
    const res = await request(app).post('/api/social/mark-failed').send({});
    expect(res.status).toBe(401);
  });

  it('flips status to failed and stores the error message', async () => {
    const article = await seedQueuedArticle();

    const res = await request(app)
      .post('/api/social/mark-failed')
      .set(AUTH)
      .send({
        articleId: String(article._id),
        platform: 'linkedin',
        error: 'LinkedIn API returned 401 unauthorized',
      });
    expect(res.status).toBe(200);

    const Article = require('../../models/Article');
    const updated = await Article.findById(article._id);
    expect(updated.socialPosted.linkedin.status).toBe('failed');
    expect(updated.socialPosted.linkedin.error).toContain('401 unauthorized');
  });

  it('truncates very long error messages to protect DB size', async () => {
    const article = await seedQueuedArticle();
    const longError = 'x'.repeat(2000);

    await request(app)
      .post('/api/social/mark-failed')
      .set(AUTH)
      .send({ articleId: String(article._id), platform: 'linkedin', error: longError });

    const Article = require('../../models/Article');
    const updated = await Article.findById(article._id);
    expect(updated.socialPosted.linkedin.error.length).toBe(500);
  });
});
