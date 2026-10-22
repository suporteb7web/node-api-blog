import {
  InvalidStripeWebhookSignatureError,
  type CheckoutWebhookGateway,
  type ParsedCheckoutWebhook,
} from '../../billing/checkout-webhook-gateway.js';
import { AppError } from '../../errors/app-error.js';
import type { UsersRepository } from '../../repositories/users.repository.js';

type HandleStripeWebhookInput = {
  payload: Buffer;
  signature: string | undefined;
};

function parseUserId(clientReferenceId: string): number | null {
  if (!/^[1-9]\d*$/.test(clientReferenceId)) {
    return null;
  }

  const userId = Number(clientReferenceId);

  if (!Number.isSafeInteger(userId)) {
    return null;
  }

  return userId;
}

export class HandleStripeWebhookUseCase {
  constructor(
    private readonly checkoutWebhookGateway: CheckoutWebhookGateway,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute({ payload, signature }: HandleStripeWebhookInput): Promise<void> {
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

    const clientReferenceId = parsed.clientReferenceId?.trim() ?? '';

    if (!clientReferenceId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing client_reference_id');
    }

    const userId = parseUserId(clientReferenceId);

    if (userId === null) {
      return;
    }

    await this.usersRepository.markPremium(userId);
  }
}
