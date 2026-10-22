import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { markUserPremium } from '../helpers/premium.js';

describe('GET /api/posts', () => {
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

  async function createPost(token: string, title: string, content: string) {
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

  it('returns empty data with coherent meta when there are no posts', async () => {
    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('lists posts in reverse chronological order with author name', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');

    const first = await createPost(alice.token, 'First', 'Content 1');
    const second = await createPost(bob.token, 'Second', 'Content 2');
    const third = await createPost(alice.token, 'Third', 'Content 3');

    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    });
    expect(response.body.data).toEqual([
      {
        id: third.id,
        title: 'Third',
        content: 'Content 3',
        image: null,
        premium: false,
        createdAt: third.createdAt,
        likesCount: 0,
        author: { id: alice.user.id, name: 'Alice' },
      },
      {
        id: second.id,
        title: 'Second',
        content: 'Content 2',
        image: null,
        premium: false,
        createdAt: second.createdAt,
        likesCount: 0,
        author: { id: bob.user.id, name: 'Bob' },
      },
      {
        id: first.id,
        title: 'First',
        content: 'Content 1',
        image: null,
        premium: false,
        createdAt: first.createdAt,
        likesCount: 0,
        author: { id: alice.user.id, name: 'Alice' },
      },
    ]);
    expect(response.body.data.every((post: { author: { email?: string } }) => post.author.email === undefined)).toBe(
      true,
    );
  });

  it('paginates results with page query and fixed limit of 10', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    for (let i = 1; i <= 12; i += 1) {
      await createPost(token, `Post ${i}`, `Content ${i}`);
    }

    const page1 = await request(app).get('/api/posts').query({ page: 1 });
    const page2 = await request(app).get('/api/posts').query({ page: 2 });
    const page3 = await request(app).get('/api/posts').query({ page: 3 });

    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
    expect(page1.body.data[0].title).toBe('Post 12');
    expect(page1.body.data[9].title).toBe('Post 3');

    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.meta).toEqual({
      page: 2,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
    expect(page2.body.data[0].title).toBe('Post 2');
    expect(page2.body.data[1].title).toBe('Post 1');

    expect(page3.status).toBe(200);
    expect(page3.body.data).toEqual([]);
    expect(page3.body.meta).toEqual({
      page: 3,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
  });

  it('defaults page to 1 when query is omitted', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token, 'Hello', 'World');

    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: post.id,
          title: 'Hello',
          content: 'World',
          image: null,
          premium: false,
          createdAt: post.createdAt,
          likesCount: 0,
          author: { id: user.id, name: 'Alice' },
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('includes likesCount per post and omits likedByMe', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const carol = await registerUser('Carol', 'carol@example.com');

    const popular = await createPost(alice.token, 'Popular', 'Many likes');
    const lonely = await createPost(alice.token, 'Lonely', 'No likes');

    await request(app).post(`/api/posts/${popular.id}/likes`).set('Authorization', `Bearer ${alice.token}`);
    await request(app).post(`/api/posts/${popular.id}/likes`).set('Authorization', `Bearer ${bob.token}`);
    await request(app).post(`/api/posts/${popular.id}/likes`).set('Authorization', `Bearer ${carol.token}`);

    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: lonely.id,
        title: 'Lonely',
        content: 'No likes',
        image: null,
        premium: false,
        createdAt: lonely.createdAt,
        likesCount: 0,
        author: { id: alice.user.id, name: 'Alice' },
      },
      {
        id: popular.id,
        title: 'Popular',
        content: 'Many likes',
        image: null,
        premium: false,
        createdAt: popular.createdAt,
        likesCount: 3,
        author: { id: alice.user.id, name: 'Alice' },
      },
    ]);
    expect(response.body.data.every((post: { likedByMe?: boolean }) => post.likedByMe === undefined)).toBe(true);
    expect(response.body.data.every((post: { replies?: unknown }) => post.replies === undefined)).toBe(true);
  });

  it('returns 400 VALIDATION_ERROR for invalid page', async () => {
    const zero = await request(app).get('/api/posts').query({ page: 0 });
    const negative = await request(app).get('/api/posts').query({ page: -1 });
    const nonNumeric = await request(app).get('/api/posts').query({ page: 'abc' });
    const decimal = await request(app).get('/api/posts').query({ page: 1.5 });

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
    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
  });

  it('returns 401 UNAUTHORIZED when the Authorization header is present but invalid', async () => {
    const response = await request(app).get('/api/posts').set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('includes premium posts only for a premium reader and counts only visible posts', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const carol = await registerUser('Carol', 'carol@example.com');
    const dave = await registerUser('Dave', 'dave@example.com');
    await markUserPremium(bob.user.id);
    await markUserPremium(dave.user.id);

    const olderPremium = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Secret', content: 'Hidden', premium: true });

    for (let i = 1; i <= 10; i += 1) {
      await createPost(alice.token, `Public ${i}`, `Content ${i}`);
    }

    const anonymous = await request(app).get('/api/posts');
    const nonPremium = await request(app).get('/api/posts').set('Authorization', `Bearer ${carol.token}`);
    const premiumPage1 = await request(app).get('/api/posts').set('Authorization', `Bearer ${dave.token}`);
    const premiumPage2 = await request(app)
      .get('/api/posts')
      .query({ page: 2 })
      .set('Authorization', `Bearer ${dave.token}`);
    const anonymousPage2 = await request(app).get('/api/posts').query({ page: 2 });

    expect(olderPremium.status).toBe(201);

    expect(anonymous.status).toBe(200);
    expect(anonymous.body.data).toHaveLength(10);
    expect(anonymous.body.data.every((post: { premium: boolean }) => post.premium === false)).toBe(true);
    expect(anonymous.body.data.some((post: { id: number }) => post.id === olderPremium.body.id)).toBe(false);
    expect(anonymous.body.meta).toEqual({ page: 1, limit: 10, total: 10, totalPages: 1 });

    expect(nonPremium.status).toBe(200);
    expect(nonPremium.body.meta).toEqual({ page: 1, limit: 10, total: 10, totalPages: 1 });
    expect(nonPremium.body.data.some((post: { id: number }) => post.id === olderPremium.body.id)).toBe(false);

    expect(anonymousPage2.status).toBe(200);
    expect(anonymousPage2.body.data).toEqual([]);
    expect(anonymousPage2.body.meta).toEqual({ page: 2, limit: 10, total: 10, totalPages: 1 });

    expect(premiumPage1.status).toBe(200);
    expect(premiumPage1.body.meta).toEqual({ page: 1, limit: 10, total: 11, totalPages: 2 });
    expect(premiumPage1.body.data).toHaveLength(10);
    expect(premiumPage1.body.data[0].title).toBe('Public 10');
    expect(premiumPage1.body.data.every((post: { premium: boolean }) => post.premium === false)).toBe(true);

    expect(premiumPage2.status).toBe(200);
    expect(premiumPage2.body.data).toEqual([
      expect.objectContaining({
        id: olderPremium.body.id,
        title: 'Secret',
        premium: true,
        author: { id: bob.user.id, name: 'Bob' },
      }),
    ]);
    expect(premiumPage2.body.meta).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
  });
});
