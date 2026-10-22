import Stripe from 'stripe';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

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
});
