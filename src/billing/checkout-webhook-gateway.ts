export type ParsedCheckoutWebhook =
  | { type: 'checkout.session.completed'; clientReferenceId: string | null }
  | { type: 'other' };

export class InvalidStripeWebhookSignatureError extends Error {
  constructor() {
    super('Invalid Stripe webhook signature');
    this.name = 'InvalidStripeWebhookSignatureError';
  }
}

export interface CheckoutWebhookGateway {
  verify(input: { payload: Buffer; signature: string }): ParsedCheckoutWebhook;
}
