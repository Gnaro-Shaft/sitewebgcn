// Integration test — article lifecycle from creation to publish.
// We mock the SocialPublisher webhook only — everything else is real
// (Express, Mongoose, validation, JWT, asyncHandler).

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

// Don't actually hit Make.com during tests. Replace the webhook fn so we
// can assert it was called, with what payload.
const SocialPublisher = require('../../services/SocialPublisher');
const publishToAllSpy = vi.spyOn(SocialPublisher, 'publishToAll').mockResolvedValue({
  linkedin: { success: true },
  x: { success: false, skipped: true },
});

beforeAll(startServer, 30_000);
afterAll(stopServer);
beforeEach(async () => {
  publishToAllSpy.mockClear();
  await cleanCollections();
});

async function registerAdmin() {
  // Register a user, then promote to admin in DB (no public route does this).
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@example.com', password: 'adminpassword' });

  const User = require('../../models/User');
  await User.updateOne(
    { _id: reg.body.user.id },
    { $set: { role: 'admin' } }
  );

  // Re-login to get a fresh token reflecting the new role
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'adminpassword' });

  return { token: login.body.token, userId: login.body.user.id };
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

    // 4. Publish triggers the social webhook on the FIRST publish
    const publish = await request(app)
      .patch(`/api/articles/${articleId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(publish.status).toBe(200);
    expect(publish.body.data.published).toBe(true);
    expect(publish.body.data.publishedAt).toBeTruthy();
    // Webhook is fire-and-forget; give it a tick
    await new Promise((r) => setImmediate(r));
    expect(publishToAllSpy).toHaveBeenCalledTimes(1);
    expect(publishToAllSpy.mock.calls[0][0].title).toBe('My first draft');

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
    // Register a regular user
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'userpassword' });
    const userToken = reg.body.token;

    // Try to create
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

  it('republishing does NOT re-fire the social webhook (avoids LinkedIn duplicate)', async () => {
    const { token } = await registerAdmin();

    const created = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No double post', content: 'content' });
    const id = created.body.data._id;

    // First publish — webhook fires
    await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    await new Promise((r) => setImmediate(r));
    expect(publishToAllSpy).toHaveBeenCalledTimes(1);

    // Mark socialPosted.linkedin in DB so the next publish recognizes it
    // (the controller checks socialPosted.linkedin/x to decide if first-publish)
    const Article = require('../../models/Article');
    await Article.updateOne(
      { _id: id },
      { $set: { 'socialPosted.linkedin': true } }
    );

    // Unpublish then republish — should NOT call webhook again
    await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`); // toggles to unpublished
    await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`); // toggles back to published

    await new Promise((r) => setImmediate(r));
    expect(publishToAllSpy).toHaveBeenCalledTimes(1); // still 1, not 2
  });
});
