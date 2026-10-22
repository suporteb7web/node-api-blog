import Stripe from 'stripe';
import {
  InvalidStripeWebhookSignatureError,
  type CheckoutWebhookGateway,
  type ParsedCheckoutWebhook,
} from './checkout-webhook-gateway.js';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
}

export class StripeCheckoutWebhookGateway implements CheckoutWebhookGateway {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor() {
    this.stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
    this.webhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
  }

  verify({ payload, signature }: { payload: Buffer; signature: string }): ParsedCheckoutWebhook {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new InvalidStripeWebhookSignatureError();
      }

      throw error;
    }

    if (event.type !== 'checkout.session.completed') {
      return { type: 'other' };
    }

    const session = event.data.object;
    const clientReferenceId = session.client_reference_id;

    return {
      type: 'checkout.session.completed',
      clientReferenceId: clientReferenceId ?? null,
    };
  }
}
