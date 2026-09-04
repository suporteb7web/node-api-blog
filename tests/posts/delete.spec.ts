import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { likes, posts, replies } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('DELETE /api/posts/:id', () => {
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
        title: 'Post to delete',
        content: 'Content',
      });

    return response.body as { id: number };
  }

  it('deletes own post and returns 204', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });

    expect(stored).toBeUndefined();
  });

  it('cascade deletes likes and replies of the post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    await request(app).post(`/api/posts/${post.id}/likes`).set('Authorization', `Bearer ${bob.token}`);
    const reply = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'Nice post' });

    const response = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(204);

    const storedReply = await db.query.replies.findFirst({
      where: eq(replies.id, reply.body.id),
    });
    const storedLike = await db.query.likes.findFirst({
      where: and(eq(likes.userId, bob.user.id), eq(likes.postId, post.id)),
    });

    expect(storedReply).toBeUndefined();
    expect(storedLike).toBeUndefined();
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .delete('/api/posts/abc')
      .set('Authorization', `Bearer ${token}`);

    const zero = await request(app).delete('/api/posts/0').set('Authorization', `Bearer ${token}`);

    const negative = await request(app)
      .delete('/api/posts/-1')
      .set('Authorization', `Bearer ${token}`);

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).delete('/api/posts/1');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .delete('/api/posts/1')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN when deleting another user post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only delete your own posts',
    });

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });

    expect(stored).toBeDefined();
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/api/posts/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });
});
