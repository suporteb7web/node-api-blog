import Stripe from 'stripe';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { markUserPremium } from '../helpers/premium.js';

function sessionIdFromCheckoutUrl(url: string): string {
  const sessionId = new URL(url).pathname.split('/').find((part) => /^cs_(test|live)_/.test(part));

  if (!sessionId) {
    throw new Error('Checkout URL does not contain a session id');
  }

  return sessionId;
}

describe('POST /api/me/checkout', () => {
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
      user: { id: number; name: string; email: string };
    };
  }

  it('returns 200 with only the Stripe checkout URL', async () => {
    const { token, user } = await registerUser();

    const response = await request(app)
      .post('/api/me/checkout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      url: expect.stringMatching(/^https:\/\/checkout\.stripe\.com\//),
    });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionIdFromCheckoutUrl(response.body.url));

    expect(session.client_reference_id).toBe(String(user.id));
    expect(session.customer_email).toBe(user.email);
    expect(session.mode).toBe('payment');
    expect(session.success_url).toBe(process.env.STRIPE_SUCCESS_URL);
    expect(session.cancel_url).toBe(process.env.STRIPE_CANCEL_URL);
  });

  it('returns 401 UNAUTHORIZED when the token is missing', async () => {
    const response = await request(app).post('/api/me/checkout');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when the token is invalid', async () => {
    const response = await request(app)
      .post('/api/me/checkout')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 409 CONFLICT when the user is already premium', async () => {
    const { token, user } = await registerUser();
    await markUserPremium(user.id);

    const response = await request(app)
      .post('/api/me/checkout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: 'CONFLICT',
      message: 'User is already premium',
    });
  });
});
