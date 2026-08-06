// Integration test — article lifecycle from creation to publish.
// The social publish flow is queue-based (Phase 24): publishArticle sets
// socialPosted.linkedin.status='queued' and n8n picks up asynchronously.
// We assert the DB queue state instead of spying on a webhook call.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

beforeAll(startServer, 30_000);
afterAll(stopServer);
beforeEach(cleanCollections);

async function registerAdmin() {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@example.com', password: 'adminpassword' });

  const User = require('../../models/User');
  await User.updateOne(
    { _id: reg.body.user.id },
    { $set: { role: 'admin' } }
  );

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'adminpassword' });

  return { token: login.body.accessToken || login.body.token, userId: login.body.user.id };
}

describe('Article publish flow', () => {
  it('admin can create, fetch admin-only list, publish, then list publicly', async () => {
    const { token } = await registerAdmin();

    // 1. Create draft (admin only)
    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'My first draft',
        content: '# Hello\n\nThis is content.',
        excerpt: 'A short excerpt.',
        tags: ['test', 'integration'],
      });

    expect(create.status).toBe(201);
    expect(create.body.data.published).toBe(false);
    expect(create.body.data.slug).toBe('my-first-draft');
    const articleId = create.body.data._id;

    // 2. Public list should NOT include unpublished articles
    const publicList = await request(app).get('/api/articles');
    expect(publicList.status).toBe(200);
    expect(publicList.body.data).toHaveLength(0);

    // 3. Admin list DOES include drafts
    const adminList = await request(app)
      .get('/api/articles/admin/all')
      .set('Authorization', `Bearer ${token}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data).toHaveLength(1);

    // 4. Publish flips the LinkedIn+X status to 'queued'
    const publish = await request(app)
      .patch(`/api/articles/${articleId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(publish.status).toBe(200);
    expect(publish.body.data.published).toBe(true);
    expect(publish.body.data.publishedAt).toBeTruthy();
    expect(publish.body.social).toEqual({ queued: true });
    expect(publish.body.data.socialPosted.linkedin.status).toBe('queued');
    expect(publish.body.data.socialPosted.linkedin.queuedAt).toBeTruthy();
    // X n'est plus mis en file : aucun workflow ne le consomme, les entrées
    // s'accumulaient indéfiniment en 'queued'. Le champ reste dans le schéma.
    expect(publish.body.data.socialPosted.x.status).toBe('pending');

    // 5. Now appears on the public list, with content
    const publicListAfter = await request(app).get('/api/articles');
    expect(publicListAfter.status).toBe(200);
    expect(publicListAfter.body.data).toHaveLength(1);

    // 6. Slug route increments views and returns the article
    const bySlug = await request(app).get('/api/articles/my-first-draft');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.views).toBe(1);
    expect(bySlug.body.data.content).toContain('Hello');
  });

  it('non-admin cannot create or publish articles', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'userpassword' });
    const userToken = reg.body.accessToken || reg.body.token;

    const create = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Forbidden', content: 'nope' });
    expect(create.status).toBe(403);
  });

  it('public cannot create without a token', async () => {
    const res = await request(app)
      .post('/api/articles')
      .send({ title: 'Anon', content: 'no auth' });
    expect(res.status).toBe(401);
  });

  it('republishing does NOT re-queue when already posted (avoids LinkedIn duplicate)', async () => {
    const { token } = await registerAdmin();

    const created = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No double post', content: 'content' });
    const id = created.body.data._id;

    // First publish — queues both platforms
    const firstPublish = await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(firstPublish.body.social).toEqual({ queued: true });

    // Simulate n8n picking up the article and marking it as posted.
    const Article = require('../../models/Article');
    await Article.updateOne(
      { _id: id },
      {
        $set: {
          'socialPosted.linkedin.status': 'posted',
          'socialPosted.linkedin.postedAt': new Date(),
          'socialPosted.linkedin.postUrn': 'urn:li:share:fake',
        },
      }
    );

    // Unpublish then republish — should NOT re-queue (LinkedIn already has it)
    await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`); // unpublish
    const republish = await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`); // republish

    expect(republish.body.social).toBeNull();
    // LinkedIn status is preserved as 'posted' (not overwritten back to 'queued')
    expect(republish.body.data.socialPosted.linkedin.status).toBe('posted');
    expect(republish.body.data.socialPosted.linkedin.postUrn).toBe('urn:li:share:fake');
  });
});
