import type { CheckoutGateway } from '../../billing/checkout-gateway.js';
import { AppError } from '../../errors/app-error.js';

type CreateCheckoutInput = {
  userId: number;
  email: string;
  premium: boolean;
};

export class CreateCheckoutUseCase {
  constructor(private readonly checkoutGateway: CheckoutGateway) {}

  async execute({ userId, email, premium }: CreateCheckoutInput) {
    if (premium) {
      throw new AppError(409, 'CONFLICT', 'User is already premium');
    }

    return this.checkoutGateway.createSession({
      clientReferenceId: String(userId),
      customerEmail: email,
    });
  }
}
