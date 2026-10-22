import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { replies } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { markUserPremium } from '../helpers/premium.js';

describe('POST /api/posts/:id/replies', () => {
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

  async function createPost(token: string) {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Post to reply',
        content: 'Content',
      });

    return response.body as { id: number };
  }

  it('creates a reply and returns 201 with reply and author', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        content: '  Nice post  ',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      content: 'Nice post',
      createdAt: expect.any(String),
      author: {
        id: bob.user.id,
        name: 'Bob',
      },
    });
    expect(Number.isNaN(Date.parse(response.body.createdAt))).toBe(false);
    expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const stored = await db.query.replies.findFirst({
      where: eq(replies.id, response.body.id),
    });

    expect(stored).toBeDefined();
    expect(stored?.content).toBe('Nice post');
    expect(stored?.authorId).toBe(bob.user.id);
    expect(stored?.postId).toBe(post.id);
  });

  it('allows the post author to reply to their own post', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Adding more context' });

    expect(response.status).toBe(201);
    expect(response.body.author).toEqual({
      id: user.id,
      name: 'Alice',
    });
    expect(response.body.content).toBe('Adding more context');
  });

  it('returns 400 VALIDATION_ERROR for invalid body', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.any(String),
          message: expect.any(String),
        }),
      ]),
    );
  });

  it('returns 400 VALIDATION_ERROR when content is only whitespace', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when content is missing', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for extra fields', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Ok', extra: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .post('/api/posts/abc/replies')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Ok' });

    const zero = await request(app)
      .post('/api/posts/0/replies')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Ok' });

    const negative = await request(app)
      .post('/api/posts/-1/replies')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Ok' });

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).post('/api/posts/1/replies').send({
      content: 'Hello',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .post('/api/posts/1/replies')
      .set('Authorization', 'Bearer invalid-token')
      .send({ content: 'Hello' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/api/posts/99999/replies')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello' });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });

  it('returns 404 NOT_FOUND when a non-premium user replies to a premium post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    await markUserPremium(alice.user.id);

    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Secret', content: 'Hidden', premium: true });

    const response = await request(app)
      .post(`/api/posts/${created.body.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'Hello' });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });

    const stored = await db.query.replies.findMany();
    expect(stored).toHaveLength(0);
  });

  it('lets a premium user reply to another author premium post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    await markUserPremium(alice.user.id);
    await markUserPremium(bob.user.id);

    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Secret', content: 'Hidden', premium: true });

    const response = await request(app)
      .post(`/api/posts/${created.body.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: '  Nice post  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      content: 'Nice post',
      createdAt: expect.any(String),
      author: { id: bob.user.id, name: 'Bob' },
    });
    expect(response.body.author).not.toHaveProperty('premium');
  });
});
