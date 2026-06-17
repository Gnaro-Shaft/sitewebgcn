// Integration test for POST /api/upload/image.
// We mock the Cloudinary upload helper — multer, auth, validation are real.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { app, startServer, stopServer, cleanCollections } = require('./setup');

const cloudinaryConfig = require('../../config/cloudinary');
const uploadBufferSpy = vi
  .spyOn(cloudinaryConfig, 'uploadBuffer')
  .mockResolvedValue({
    url: 'https://res.cloudinary.com/test/image/upload/v1/projects/abc.webp',
    publicId: 'projects/abc',
  });

beforeAll(startServer, 30_000);
afterAll(stopServer);
beforeEach(async () => {
  uploadBufferSpy.mockClear();
  uploadBufferSpy.mockResolvedValue({
    url: 'https://res.cloudinary.com/test/image/upload/v1/projects/abc.webp',
    publicId: 'projects/abc',
  });
  await cleanCollections();
  // The controller short-circuits with UPLOAD_NOT_CONFIGURED if CLOUDINARY_CLOUD_NAME
  // is unset — give it a dummy value so we actually exercise the upload path.
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
});

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
  return login.body.accessToken || login.body.token;
}

// Smallest valid 1x1 PNG — 67 bytes, valid mime, valid PNG signature.
const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100' +
    '0d0a2db40000000049454e44ae426082',
  'hex'
);

describe('POST /api/upload/image', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .attach('image', PNG_1x1, { filename: 't.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
    expect(uploadBufferSpy).not.toHaveBeenCalled();
  });

  it('uploads a valid PNG and returns the Cloudinary URL', async () => {
    const token = await registerAdmin();
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 't.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toMatch(/cloudinary\.com/);
    expect(uploadBufferSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid mime type (text/plain)', async () => {
    const token = await registerAdmin();
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'nope.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('INVALID_TYPE');
    expect(uploadBufferSpy).not.toHaveBeenCalled();
  });

  it('rejects a file over 5 MB', async () => {
    const token = await registerAdmin();
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0); // 5 MB + 1 byte
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', big, { filename: 'huge.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('TOO_LARGE');
    expect(uploadBufferSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is sent', async () => {
    const token = await registerAdmin();
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NO_FILE');
    expect(uploadBufferSpy).not.toHaveBeenCalled();
  });

  it('returns 503 when Cloudinary is not configured', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const token = await registerAdmin();
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 't.png', contentType: 'image/png' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('UPLOAD_NOT_CONFIGURED');
    expect(uploadBufferSpy).not.toHaveBeenCalled();
  });

  it('returns 502 when Cloudinary upload fails', async () => {
    uploadBufferSpy.mockRejectedValueOnce(new Error('Cloudinary down'));
    const token = await registerAdmin();
    const res = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 't.png', contentType: 'image/png' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('CLOUDINARY_FAILED');
  });
});
