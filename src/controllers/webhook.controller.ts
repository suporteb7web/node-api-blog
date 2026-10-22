import type { Request, Response } from 'express';
import { StripeCheckoutWebhookGateway } from '../billing/stripe-checkout-webhook-gateway.js';
import { DrizzleUsersRepository } from '../repositories/drizzle-users.repository.js';
import { HandleStripeWebhookUseCase } from '../use-cases/billing/handle-stripe-webhook.js';

const handleStripeWebhook = new HandleStripeWebhookUseCase(
  new StripeCheckoutWebhookGateway(),
  new DrizzleUsersRepository(),
);

function rawPayload(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  return Buffer.alloc(0);
}

function signatureHeader(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string' || header.length === 0) {
    return undefined;
  }

  return header;
}

export async function stripeWebhookController(req: Request, res: Response): Promise<void> {
  await handleStripeWebhook.execute({
    payload: rawPayload(req.body),
    signature: signatureHeader(req.headers['stripe-signature']),
  });

  res.status(200).end();
}
