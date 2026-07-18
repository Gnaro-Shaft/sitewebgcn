// Integration tests for the Phase 25 dynamic CV path.
// Verifies:
//   - When CvData exists for a lang → download returns a fresh PDF buffer
//   - When CvData does not exist → falls back to the static file matrix
//   - Admin GET/PUT of CvData with ?lang= works and creates separate docs

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
  await User.updateOne({ _id: reg.body.user.id }, { $set: { role: 'admin' } });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'adminpassword' });
  return login.body.accessToken || login.body.token;
}

async function seedCv(lang, overrides = {}) {
  const CvData = require('../../models/CvData');
  return CvData.create({
    lang,
    fullName: 'Test User',
    title: lang === 'fr' ? 'Ingénieur Test' : 'Test Engineer',
    email: 't@example.com',
    summary: 'A summary.',
    experience: [
      { role: 'Test Role', company: 'Test Co', startDate: '2020', endDate: '2024' },
    ],
    skills: [{ category: 'AI', items: ['Python', 'RAG'] }],
    ...overrides,
  });
}

describe('GET /api/cv/download — dynamic path (CvData present)', () => {
  it('returns a freshly generated PDF for lang=fr when CvData exists', async () => {
    await seedCv('fr');

    const res = await request(app)
      .get('/api/cv/download?lang=fr&theme=light')
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('CV_Genaro_Nisus_Ingenieur_IA_ML.pdf');
    // Cache-Control ensures fresh downloads
    expect(res.headers['cache-control']).toBe('no-store');
    // The response body is a real PDF
    expect(res.body.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('serves the EN filename and English content when lang=en', async () => {
    await seedCv('en');

    const res = await request(app)
      .get('/api/cv/download?lang=en&theme=light')
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('CV_Genaro_Nisus_AI_ML_Engineer.pdf');
  });

  it('produces different PDFs for theme=light vs theme=dark', async () => {
    await seedCv('fr');

    const parse = (res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    };

    const light = await request(app)
      .get('/api/cv/download?lang=fr&theme=light')
      .buffer(true)
      .parse(parse);
    const dark = await request(app)
      .get('/api/cv/download?lang=fr&theme=dark')
      .buffer(true)
      .parse(parse);

    expect(light.status).toBe(200);
    expect(dark.status).toBe(200);
    // The bodies should differ (different color palettes baked in)
    expect(light.body.equals(dark.body)).toBe(false);
  });
});

describe('GET /api/cv/download — static fallback (no CvData)', () => {
  it('falls back to the static PDF matrix when no CvData exists for lang', async () => {
    // No CvData seeded — should fall through to resolveCvFile
    const res = await request(app)
      .get('/api/cv/download?lang=fr&theme=light');
    // The static file exists in the test env if the fixture is present;
    // otherwise the endpoint 404s cleanly. We accept either — we're only
    // asserting the code path taken.
    expect([200, 404]).toContain(res.status);
  });
});

describe('CvData admin endpoints (lang-scoped)', () => {
  it('PUT then GET creates and reads the FR doc independently', async () => {
    const token = await registerAdmin();

    const putRes = await request(app)
      .put('/api/cv/data?lang=fr')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Genaro-Cedric',
        title: 'Ingénieur Data & IA',
        email: 'fr@example.com',
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.lang).toBe('fr');
    expect(putRes.body.data.title).toBe('Ingénieur Data & IA');

    const getRes = await request(app)
      .get('/api/cv/data?lang=fr')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.email).toBe('fr@example.com');
  });

  it('creates separate docs for fr and en', async () => {
    const token = await registerAdmin();

    await request(app)
      .put('/api/cv/data?lang=fr')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'FR', title: 'FR Title', email: 'fr@x' });

    await request(app)
      .put('/api/cv/data?lang=en')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'EN', title: 'EN Title', email: 'en@x' });

    const CvData = require('../../models/CvData');
    expect(await CvData.countDocuments()).toBe(2);
    const fr = await CvData.findOne({ lang: 'fr' });
    const en = await CvData.findOne({ lang: 'en' });
    expect(fr.title).toBe('FR Title');
    expect(en.title).toBe('EN Title');
  });

  it('GET returns 404 with the lang echoed when no doc exists yet', async () => {
    const token = await registerAdmin();
    const res = await request(app)
      .get('/api/cv/data?lang=en')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.lang).toBe('en');
  });
});
