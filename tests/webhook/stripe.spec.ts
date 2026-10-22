import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

function signedPayload(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });

  return { payload, signature };
}

const app = createApp();

function postWebhook(payload: string, signature?: string) {
  const req = request(app)
    .post('/api/webhook/stripe')
    .set('Content-Type', 'application/json');

  if (signature) {
    req.set('stripe-signature', signature);
  }

  return req.send(payload);
}

describe('POST /api/webhook/stripe', () => {
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

    return response.body as { token: string; user: { id: number } };
  }

  it('returns 200 when checkout.session.completed is signed and has client_reference_id', async () => {
    const { payload, signature } = signedPayload({
      id: 'evt_test_checkout_completed',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          object: 'checkout.session',
          client_reference_id: '42',
        },
      },
    });

    const response = await postWebhook(payload, signature);

    expect(response.status).toBe(200);
    expect(response.text).toBe('');
  });

  it('returns 200 when the signed event is not checkout.session.completed', async () => {
    const { payload, signature } = signedPayload({
      id: 'evt_test_expired',
      object: 'event',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_expired',
          object: 'checkout.session',
        },
      },
    });

    const response = await postWebhook(payload, signature);

    expect(response.status).toBe(200);
    expect(response.text).toBe('');
  });

  it('returns 400 VALIDATION_ERROR when the signature does not match the body', async () => {
    const { payload, signature } = signedPayload({
      id: 'evt_test_checkout_completed',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          object: 'checkout.session',
          client_reference_id: '42',
        },
      },
    });

    const response = await postWebhook(
      payload.replace('"client_reference_id":"42"', '"client_reference_id":"7"'),
      signature,
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid Stripe webhook');
  });

  it('returns 400 VALIDATION_ERROR when the signature header is missing', async () => {
    const { payload } = signedPayload({
      id: 'evt_test_checkout_completed',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          object: 'checkout.session',
          client_reference_id: '42',
        },
      },
    });

    const response = await postWebhook(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid Stripe webhook');
  });

  it('returns 400 VALIDATION_ERROR when checkout.session.completed has no client_reference_id', async () => {
    const { payload, signature } = signedPayload({
      id: 'evt_test_checkout_completed',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          object: 'checkout.session',
          client_reference_id: null,
        },
      },
    });

    const response = await postWebhook(payload, signature);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Missing client_reference_id');
  });

  it('marks the matching user as premium and keeps 200 when the event is delivered again', async () => {
    const { token, user } = await registerUser();
    const { payload, signature } = signedPayload({
      id: 'evt_test_checkout_completed',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          object: 'checkout.session',
          client_reference_id: String(user.id),
        },
      },
    });

    const first = await postWebhook(payload, signature);
    const second = await postWebhook(payload, signature);
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(first.text).toBe('');
    expect(second.status).toBe(200);

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(stored?.premium).toBe(true);
    expect(me.status).toBe(200);
    expect(me.body.premium).toBe(true);
  });

  it('returns 200 and changes nothing when client_reference_id does not match a user', async () => {
    const { user } = await registerUser();
    const { payload, signature } = signedPayload({
      id: 'evt_test_unknown_user',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_unknown',
          object: 'checkout.session',
          client_reference_id: '999999',
        },
      },
    });

    const response = await postWebhook(payload, signature);

    expect(response.status).toBe(200);

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(stored?.premium).toBe(false);
  });

  it('returns 200 and changes nothing when client_reference_id is not a user id', async () => {
    const { user } = await registerUser();
    const { payload, signature } = signedPayload({
      id: 'evt_test_bad_reference',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_bad_reference',
          object: 'checkout.session',
          client_reference_id: 'abc',
        },
      },
    });

    const response = await postWebhook(payload, signature);

    expect(response.status).toBe(200);

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(stored?.premium).toBe(false);
  });

  it('does not mark a user premium for another signed event type', async () => {
    const { user } = await registerUser();
    const { payload, signature } = signedPayload({
      id: 'evt_test_expired_user',
      object: 'event',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_expired',
          object: 'checkout.session',
          client_reference_id: String(user.id),
        },
      },
    });

    const response = await postWebhook(payload, signature);

    expect(response.status).toBe(200);

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(stored?.premium).toBe(false);
  });
});
