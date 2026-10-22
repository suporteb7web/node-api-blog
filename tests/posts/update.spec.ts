import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { posts } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { markUserPremium } from '../helpers/premium.js';

describe('PUT /api/posts/:id', () => {
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

  async function createPost(token: string, title = 'Original title', content = 'Original content') {
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

  it('updates title and content and returns 200', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '  Updated title  ',
        content: '  Updated content  ',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: post.id,
      title: 'Updated title',
      content: 'Updated content',
      image: null,
      premium: false,
      createdAt: post.createdAt,
      author: {
        id: user.id,
        name: 'Alice',
      },
    });
    expect(response.body.createdAt).toBe(post.createdAt);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });

    expect(stored?.title).toBe('Updated title');
    expect(stored?.content).toBe('Updated content');
  });

  it('does not change createdAt when updating a post', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New title' });

    expect(response.status).toBe(200);
    expect(response.body.createdAt).toBe(post.createdAt);
  });

  it('updates only title when content is omitted', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Only title' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Only title');
    expect(response.body.content).toBe('Original content');
  });

  it('updates only content when title is omitted', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Only content' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Original title');
    expect(response.body.content).toBe('Only content');
  });

  it('returns 400 VALIDATION_ERROR for empty body', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for extra fields', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok', extra: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .put('/api/posts/abc')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok' });

    const zero = await request(app)
      .put('/api/posts/0')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok' });

    const negative = await request(app)
      .put('/api/posts/-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok' });

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when title exceeds 200 characters', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'a'.repeat(201) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when present fields are empty or whitespace', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const emptyTitle = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });

    const emptyContent = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });

    const whitespaceTitle = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ' });

    const whitespaceContent = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });

    expect(emptyTitle.status).toBe(400);
    expect(emptyTitle.body.error.code).toBe('VALIDATION_ERROR');

    expect(emptyContent.status).toBe(400);
    expect(emptyContent.body.error.code).toBe('VALIDATION_ERROR');

    expect(whitespaceTitle.status).toBe(400);
    expect(whitespaceTitle.body.error.code).toBe('VALIDATION_ERROR');

    expect(whitespaceContent.status).toBe(400);
    expect(whitespaceContent.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).put('/api/posts/1').send({ title: 'Ok' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .put('/api/posts/1')
      .set('Authorization', 'Bearer invalid-token')
      .send({ title: 'Ok' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN when updating another user post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Hacked' });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only update your own posts',
    });
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/api/posts/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing' });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });

  it('lets a premium author mark and unmark the post without changing omitted fields', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    await markUserPremium(user.id);
    const post = await createPost(token);

    const marked = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ premium: true });

    expect(marked.status).toBe(200);
    expect(marked.body.premium).toBe(true);
    expect(marked.body.title).toBe('Original title');
    expect(marked.body.content).toBe('Original content');

    const unchanged = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Still premium' });

    expect(unchanged.status).toBe(200);
    expect(unchanged.body.premium).toBe(true);
    expect(unchanged.body.title).toBe('Still premium');

    const unmarked = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ premium: false });

    expect(unmarked.status).toBe(200);
    expect(unmarked.body.premium).toBe(false);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    expect(stored?.premium).toBe(false);
    expect(stored?.title).toBe('Still premium');
  });

  it('returns 403 FORBIDDEN and stores nothing when a non-premium author sends premium true', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should not stick', premium: true });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'Only premium users can mark posts as premium',
    });

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    expect(stored?.title).toBe('Original title');
    expect(stored?.premium).toBe(false);
  });

  it('returns ownership 403 before the premium rule when the post belongs to someone else', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ premium: true, title: 'Hacked' });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only update your own posts',
    });

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    expect(stored?.title).toBe('Original title');
    expect(stored?.premium).toBe(false);
  });

  it('returns 404 NOT_FOUND when a non-premium user updates a premium post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    await markUserPremium(alice.user.id);

    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Secret', content: 'Hidden', premium: true });

    const response = await request(app)
      .put(`/api/posts/${created.body.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Hacked' });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, created.body.id),
    });
    expect(stored?.title).toBe('Secret');
  });

  it('returns 403 FORBIDDEN when a premium user updates another author premium post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    await markUserPremium(alice.user.id);
    await markUserPremium(bob.user.id);

    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Secret', content: 'Hidden', premium: true });

    const response = await request(app)
      .put(`/api/posts/${created.body.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Hacked' });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only update your own posts',
    });
  });

  it('returns 400 VALIDATION_ERROR when premium is not a boolean', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ premium: 'yes' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows a non-premium author to send premium false on their own post', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ premium: false });

    expect(response.status).toBe(200);
    expect(response.body.premium).toBe(false);
  });
});
