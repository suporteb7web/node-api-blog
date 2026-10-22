import type { CheckoutGateway } from '../../billing/checkout-gateway.js';

type CreateCheckoutInput = {
  userId: number;
  email: string;
};

export class CreateCheckoutUseCase {
  constructor(private readonly checkoutGateway: CheckoutGateway) {}

  async execute({ userId, email }: CreateCheckoutInput) {
    return this.checkoutGateway.createSession({
      clientReferenceId: String(userId),
      customerEmail: email,
    });
  }
}
