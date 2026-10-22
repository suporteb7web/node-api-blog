import Stripe from 'stripe';
import type { CheckoutGateway, CreateCheckoutSessionInput } from './checkout-gateway.js';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
}

export class StripeCheckoutGateway implements CheckoutGateway {
  private readonly stripe: Stripe;
  private readonly priceId: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor() {
    this.stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
    this.priceId = requiredEnv('STRIPE_PRICE_ID');
    this.successUrl = requiredEnv('STRIPE_SUCCESS_URL');
    this.cancelUrl = requiredEnv('STRIPE_CANCEL_URL');
  }

  async createSession({ clientReferenceId, customerEmail }: CreateCheckoutSessionInput) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: this.priceId, quantity: 1 }],
      success_url: this.successUrl,
      cancel_url: this.cancelUrl,
      client_reference_id: clientReferenceId,
      customer_email: customerEmail,
    });

    if (!session.url) {
      throw new Error('Stripe checkout session did not return a URL');
    }

    return { url: session.url };
  }
}
