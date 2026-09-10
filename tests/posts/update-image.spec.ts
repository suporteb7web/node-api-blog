import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { posts } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { createTestImage } from '../helpers/images.js';
import { cleanUploads, getTestUploadsDir } from '../helpers/uploads.js';

const UUID_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;
const MAX_POST_IMAGE_WIDTH = 1280;
const MAX_POST_IMAGE_HEIGHT = 720;

describe('PUT /api/posts/:id/image', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
    await cleanUploads();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function registerUser(name: string, email: string) {
    const response = await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'secret1',
    });

    return response.body as {
      token: string;
      user: { id: number; name: string; email: string };
    };
  }

  async function createPost(token: string, title = 'Hello', content = 'World') {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, content });

    return response.body as {
      id: number;
      title: string;
      content: string;
      image: string | null;
      createdAt: string;
      author: { id: number; name: string };
    };
  }

  it('uploads a post image, stores a UUID filename and returns 200 without likes or replies', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token, 'With image', 'Content');
    const image = await createTestImage({ width: 400, height: 300, format: 'png' });

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', image, { filename: 'photo.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: post.id,
      title: 'With image',
      content: 'Content',
      image: expect.stringMatching(/^\/uploads\/posts\//),
      createdAt: post.createdAt,
      author: {
        id: user.id,
        name: 'Alice',
      },
    });
    expect(response.body).not.toHaveProperty('likesCount');
    expect(response.body).not.toHaveProperty('likedByMe');
    expect(response.body).not.toHaveProperty('replies');

    const filename = path.basename(response.body.image as string);
    expect(filename).toMatch(UUID_FILENAME);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });

    expect(stored?.photoPath).toBe(`posts/${filename}`);
    expect(stored?.title).toBe('With image');
    expect(stored?.content).toBe('Content');

    const filePath = path.join(getTestUploadsDir(), stored!.photoPath!);
    await expect(access(filePath)).resolves.toBeUndefined();

    const metadata = await sharp(await readFile(filePath)).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);

    const served = await request(app).get(response.body.image);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/^image\//);
  });

  it('downscales images larger than 720p while preserving aspect ratio', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);
    const image = await createTestImage({ width: 1920, height: 1080, format: 'jpeg' });

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', image, { filename: 'large.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(200);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    const metadata = await sharp(await readFile(path.join(getTestUploadsDir(), stored!.photoPath!))).metadata();

    expect(metadata.width).toBe(MAX_POST_IMAGE_WIDTH);
    expect(metadata.height).toBe(MAX_POST_IMAGE_HEIGHT);
  });

  it('downscales portrait images to fit within 720p without a fixed crop', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);
    const image = await createTestImage({ width: 800, height: 1600, format: 'png' });

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', image, { filename: 'portrait.png', contentType: 'image/png' });

    expect(response.status).toBe(200);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    const metadata = await sharp(await readFile(path.join(getTestUploadsDir(), stored!.photoPath!))).metadata();

    expect(metadata.width).toBe(360);
    expect(metadata.height).toBe(MAX_POST_IMAGE_HEIGHT);
  });

  it('does not enlarge images smaller than 720p', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);
    const image = await createTestImage({ width: 640, height: 360, format: 'png' });

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', image, { filename: 'small.png', contentType: 'image/png' });

    expect(response.status).toBe(200);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    const metadata = await sharp(await readFile(path.join(getTestUploadsDir(), stored!.photoPath!))).metadata();

    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(360);
  });

  it('accepts jpeg and webp images', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const jpegPost = await createPost(token, 'Jpeg', 'Content');
    const webpPost = await createPost(token, 'Webp', 'Content');

    const jpeg = await request(app)
      .put(`/api/posts/${jpegPost.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage({ format: 'jpeg' }), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(jpeg.status).toBe(200);
    expect(jpeg.body.image).toMatch(/^\/uploads\/posts\//);

    const webp = await request(app)
      .put(`/api/posts/${webpPost.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage({ format: 'webp' }), {
        filename: 'photo.webp',
        contentType: 'image/webp',
      });

    expect(webp.status).toBe(200);
    expect(webp.body.image).toMatch(/^\/uploads\/posts\//);
  });

  it('replaces the previous image file after persisting the new path', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const first = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'first.png',
        contentType: 'image/png',
      });

    expect(first.status).toBe(200);
    const previousFilename = path.basename(first.body.image as string);
    const previousPath = path.join(getTestUploadsDir(), 'posts', previousFilename);

    const second = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage({ width: 500, height: 400 }), {
        filename: 'second.png',
        contentType: 'image/png',
      });

    expect(second.status).toBe(200);
    expect(second.body.image).not.toBe(first.body.image);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });

    expect(stored?.photoPath).toBe(`posts/${path.basename(second.body.image as string)}`);
    await expect(access(path.join(getTestUploadsDir(), stored!.photoPath!))).resolves.toBeUndefined();
    await expect(access(previousPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not change title or content when updating the image', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token, 'Keep title', 'Keep content');

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Keep title');
    expect(response.body.content).toBe('Keep content');
    expect(response.body.createdAt).toBe(post.createdAt);
  });

  it('returns the uploaded image on GET list, GET by id and PUT title/content', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const upload = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(upload.status).toBe(200);

    const listed = await request(app).get('/api/posts');
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].image).toBe(upload.body.image);

    const detail = await request(app).get(`/api/posts/${post.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.image).toBe(upload.body.image);

    const updated = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Still has image' });

    expect(updated.status).toBe(200);
    expect(updated.body.image).toBe(upload.body.image);
    expect(updated.body.title).toBe('Still has image');
  });

  it('returns 400 VALIDATION_ERROR when the image field is missing', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the file type is not allowed', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'photo.gif',
        contentType: 'image/gif',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the file is not a valid image', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('this is not an image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .put('/api/posts/abc/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    const zero = await request(app)
      .put('/api/posts/0/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when the token is missing', async () => {
    const response = await request(app)
      .put('/api/posts/1/image')
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when the token is invalid', async () => {
    const response = await request(app)
      .put('/api/posts/1/image')
      .set('Authorization', 'Bearer not-a-real-token')
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN when updating the image of another user post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${bob.token}`)
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only update your own posts',
    });
  });

  it('returns 404 NOT_FOUND when the post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/api/posts/99999/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createTestImage(), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });
});
