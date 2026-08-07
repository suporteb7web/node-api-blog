import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('GET /api/posts/:id', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
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

    return response.body as { token: string; user: { id: number; name: string; email: string } };
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
      createdAt: string;
      author: { id: number; name: string };
    };
  }

  it('returns a post by id with author name', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token, 'Public post', 'Public content');

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: post.id,
      title: 'Public post',
      content: 'Public content',
      createdAt: post.createdAt,
      author: {
        id: user.id,
        name: 'Alice',
      },
    });
    expect(response.body.author.email).toBeUndefined();
    expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const response = await request(app).get('/api/posts/999999');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Post not found',
      },
    });
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const zero = await request(app).get('/api/posts/0');
    const negative = await request(app).get('/api/posts/-1');
    const nonNumeric = await request(app).get('/api/posts/abc');
    const decimal = await request(app).get('/api/posts/1.5');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(decimal.status).toBe(400);
    expect(decimal.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not require authentication', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
  });
});
