import {
  InvalidStripeWebhookSignatureError,
  type CheckoutWebhookGateway,
  type ParsedCheckoutWebhook,
} from '../../billing/checkout-webhook-gateway.js';
import { AppError } from '../../errors/app-error.js';

type HandleStripeWebhookInput = {
  payload: Buffer;
  signature: string | undefined;
};

export class HandleStripeWebhookUseCase {
  constructor(private readonly checkoutWebhookGateway: CheckoutWebhookGateway) {}

  execute({ payload, signature }: HandleStripeWebhookInput): void {
    if (!signature) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Stripe webhook');
    }

    let parsed: ParsedCheckoutWebhook;

    try {
      parsed = this.checkoutWebhookGateway.verify({ payload, signature });
    } catch (error) {
      if (error instanceof InvalidStripeWebhookSignatureError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Stripe webhook');
      }

      throw error;
    }

    if (parsed.type !== 'checkout.session.completed') {
      return;
    }

    const clientReferenceId = parsed.clientReferenceId;

    if (!clientReferenceId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing client_reference_id');
    }
  }
}
