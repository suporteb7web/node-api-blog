import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { replies } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('DELETE /api/posts/:id/replies/:replyId', () => {
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

  async function createReply(token: string, postId: number, content = 'Nice post') {
    const response = await request(app)
      .post(`/api/posts/${postId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });

    return response.body as { id: number };
  }

  it('deletes own reply and returns 204', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);
    const reply = await createReply(bob.token, post.id);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/replies/${reply.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const stored = await db.query.replies.findFirst({
      where: eq(replies.id, reply.id),
    });

    expect(stored).toBeUndefined();
  });

  it('allows the post author to delete their own reply', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);
    const reply = await createReply(token, post.id, 'Adding more context');

    const response = await request(app)
      .delete(`/api/posts/${post.id}/replies/${reply.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const stored = await db.query.replies.findFirst({
      where: eq(replies.id, reply.id),
    });

    expect(stored).toBeUndefined();
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .delete('/api/posts/abc/replies/1')
      .set('Authorization', `Bearer ${token}`);

    const zero = await request(app)
      .delete('/api/posts/0/replies/1')
      .set('Authorization', `Bearer ${token}`);

    const negative = await request(app)
      .delete('/api/posts/-1/replies/1')
      .set('Authorization', `Bearer ${token}`);

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for invalid replyId', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .delete('/api/posts/1/replies/abc')
      .set('Authorization', `Bearer ${token}`);

    const zero = await request(app)
      .delete('/api/posts/1/replies/0')
      .set('Authorization', `Bearer ${token}`);

    const negative = await request(app)
      .delete('/api/posts/1/replies/-1')
      .set('Authorization', `Bearer ${token}`);

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).delete('/api/posts/1/replies/1');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .delete('/api/posts/1/replies/1')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN when deleting another user reply', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);
    const reply = await createReply(bob.token, post.id);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/replies/${reply.id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only delete your own replies',
    });

    const stored = await db.query.replies.findFirst({
      where: eq(replies.id, reply.id),
    });

    expect(stored).toBeDefined();
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/api/posts/99999/replies/1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });

  it('returns 404 NOT_FOUND when reply does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/replies/99999`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND when reply belongs to another post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const firstPost = await createPost(alice.token);
    const secondPost = await createPost(alice.token);
    const reply = await createReply(bob.token, firstPost.id);

    const response = await request(app)
      .delete(`/api/posts/${secondPost.id}/replies/${reply.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');

    const stored = await db.query.replies.findFirst({
      where: eq(replies.id, reply.id),
    });

    expect(stored).toBeDefined();
  });
});
