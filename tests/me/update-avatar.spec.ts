import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { createTestImage } from '../helpers/images.js';
import { cleanUploads, getTestUploadsDir } from '../helpers/uploads.js';

const UUID_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

describe('PUT /api/me/avatar', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
    await cleanUploads();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function registerUser() {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret1',
    });

    return response.body as {
      token: string;
      user: { id: number; name: string; email: string; avatar: string | null };
    };
  }

  it('uploads an avatar, resizes to 200x200, stores a UUID filename and returns 200', async () => {
    const { token, user } = await registerUser();
    const image = await createTestImage({ width: 400, height: 300, format: 'png' });

    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', image, { filename: 'avatar.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: user.id,
      name: 'Alice',
      email: 'alice@example.com',
      avatar: expect.stringMatching(/^\/uploads\/avatars\//),
    });
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('token');

    const filename = path.basename(response.body.avatar as string);
    expect(filename).toMatch(UUID_FILENAME);

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    expect(stored?.avatarPath).toBe(`avatars/${filename}`);

    const filePath = path.join(getTestUploadsDir(), stored!.avatarPath!);
    await expect(access(filePath)).resolves.toBeUndefined();

    const metadata = await sharp(await readFile(filePath)).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);

    const served = await request(app).get(response.body.avatar);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/^image\//);
  });

  it('accepts jpeg and webp images', async () => {
    const { token } = await registerUser();

    const jpeg = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage({ format: 'jpeg' }), {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      });

    expect(jpeg.status).toBe(200);
    expect(jpeg.body.avatar).toMatch(/^\/uploads\/avatars\//);

    const webp = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage({ format: 'webp' }), {
        filename: 'avatar.webp',
        contentType: 'image/webp',
      });

    expect(webp.status).toBe(200);
    expect(webp.body.avatar).toMatch(/^\/uploads\/avatars\//);
  });

  it('replaces the previous avatar file after persisting the new path', async () => {
    const { token, user } = await registerUser();

    const first = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'first.png',
        contentType: 'image/png',
      });

    expect(first.status).toBe(200);
    const previousFilename = path.basename(first.body.avatar as string);
    const previousPath = path.join(getTestUploadsDir(), 'avatars', previousFilename);

    const second = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage({ width: 500, height: 500 }), {
        filename: 'second.png',
        contentType: 'image/png',
      });

    expect(second.status).toBe(200);
    expect(second.body.avatar).not.toBe(first.body.avatar);

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    expect(stored?.avatarPath).toBe(`avatars/${path.basename(second.body.avatar as string)}`);
    await expect(access(path.join(getTestUploadsDir(), stored!.avatarPath!))).resolves.toBeUndefined();
    await expect(access(previousPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns the uploaded avatar on GET /api/me and on login', async () => {
    const { token } = await registerUser();

    const upload = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(upload.status).toBe(200);

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.avatar).toBe(upload.body.avatar);

    const login = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'secret1',
    });

    expect(login.status).toBe(200);
    expect(login.body.user.avatar).toBe(upload.body.avatar);
  });

  it('returns 400 VALIDATION_ERROR when the image field is missing', async () => {
    const { token } = await registerUser();

    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the file type is not allowed', async () => {
    const { token } = await registerUser();

    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'avatar.gif',
        contentType: 'image/gif',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the file is not a valid image', async () => {
    const { token } = await registerUser();

    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('this is not an image'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when the token is missing', async () => {
    const response = await request(app)
      .put('/api/me/avatar')
      .attach('image', await createTestImage(), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when the token is invalid', async () => {
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', 'Bearer not-a-real-token')
      .attach('image', await createTestImage(), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
