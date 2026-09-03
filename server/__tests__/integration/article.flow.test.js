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

    // 4. Publier met l'article en ligne et n'enfile RIEN sur LinkedIn.
    // C'est le cœur du changement : tant que publier déclenchait le post,
    // la forme du post était forcément produite par une machine.
    const publish = await request(app)
      .patch(`/api/articles/${articleId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(publish.status).toBe(200);
    expect(publish.body.data.published).toBe(true);
    expect(publish.body.data.publishedAt).toBeTruthy();
    expect(publish.body.social).toBeNull();
    expect(publish.body.data.socialPosted.linkedin.status).toBe('pending');
    expect(publish.body.data.socialPosted.linkedin.queuedAt).toBeFalsy();
    expect(publish.body.data.socialPosted.linkedin.text).toBeFalsy();
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

  it('republishing never queues, whatever the number of publish toggles', async () => {
    const { token } = await registerAdmin();

    const created = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No double post', content: 'content' });
    const id = created.body.data._id;

    // Publier, dépublier, republier — aucun de ces gestes n'enfile.
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .patch(`/api/articles/${id}/publish`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.social).toBeNull();
      expect(res.body.data.socialPosted.linkedin.status).toBe('pending');
    }
  });
});

// Le seul chemin qui met un article dans la file LinkedIn : le composeur.
describe('POST /api/articles/:id/social-publish', () => {
  const TEXT = "J'ai perdu deux jours sur un index Mongo que je croyais utilisé. Il ne l'était pas.";

  async function publishedArticle(token, title = 'Composable') {
    const created = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, content: 'content' });
    const id = created.body.data._id;
    await request(app)
      .patch(`/api/articles/${id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    return id;
  }

  it('refuses to queue without a text', async () => {
    const { token } = await registerAdmin();
    const id = await publishedArticle(token);

    const res = await request(app)
      .post(`/api/articles/${id}/social-publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('refuses a text that is only whitespace', async () => {
    const { token } = await registerAdmin();
    const id = await publishedArticle(token);

    const res = await request(app)
      .post(`/api/articles/${id}/social-publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '   \n\t  ' });

    expect(res.status).toBe(400);
  });

  it('refuses to queue an unpublished article even with a valid text', async () => {
    const { token } = await registerAdmin();
    const created = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Still a draft', content: 'content' });

    const res = await request(app)
      .post(`/api/articles/${created.body.data._id}/social-publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: TEXT });

    expect(res.status).toBe(400);
  });

  it('queues the hand-written text verbatim', async () => {
    const { token } = await registerAdmin();
    const id = await publishedArticle(token);

    const res = await request(app)
      .post(`/api/articles/${id}/social-publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: TEXT, firstComment: 'https://gcn-data.fr/blog/composable' });

    expect(res.status).toBe(200);
    const linkedin = res.body.data.article.socialPosted.linkedin;
    expect(linkedin.status).toBe('queued');
    expect(linkedin.queuedAt).toBeTruthy();
    expect(linkedin.text).toBe(TEXT);
    expect(linkedin.firstComment).toBe('https://gcn-data.fr/blog/composable');
  });

  it('falls back to the bare canonical URL when the comment is left empty', async () => {
    const { token } = await registerAdmin();
    const id = await publishedArticle(token);

    const res = await request(app)
      .post(`/api/articles/${id}/social-publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: TEXT, firstComment: '  ' });

    expect(res.status).toBe(200);
    const { firstComment } = res.body.data.article.socialPosted.linkedin;
    expect(firstComment).toContain('/blog/composable');
    // Une URL nue : pas d'emoji, pas de formule qui se répète de post en post.
    expect(firstComment).toMatch(/^https?:\/\/\S+$/);
  });

  it('refuses to re-queue an article already posted on LinkedIn', async () => {
    const { token } = await registerAdmin();
    const id = await publishedArticle(token);

    const Article = require('../../models/Article');
    await Article.updateOne(
      { _id: id },
      { $set: { 'socialPosted.linkedin.status': 'posted', 'socialPosted.linkedin.postUrn': 'urn:li:share:fake' } }
    );

    const res = await request(app)
      .post(`/api/articles/${id}/social-publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: TEXT });

    expect(res.status).toBe(409);
  });
});
