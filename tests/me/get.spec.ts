import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { markUserPremium } from '../helpers/premium.js';

describe('GET /api/me', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
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

  it('returns 200 with the authenticated user and null avatar', async () => {
    const { token, user } = await registerUser();

    const response = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: user.id,
      name: 'Alice',
      email: 'alice@example.com',
      avatar: null,
      premium: false,
    });
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('token');
  });

  it('returns 401 UNAUTHORIZED when the token is missing', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when the token is invalid', async () => {
    const response = await request(app).get('/api/me').set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns premium true after the user is marked premium', async () => {
    const { token, user } = await registerUser();
    await markUserPremium(user.id);

    const response = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.premium).toBe(true);
  });
});
