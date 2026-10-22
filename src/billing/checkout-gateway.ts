export type CreateCheckoutSessionInput = {
  clientReferenceId: string;
  customerEmail: string;
};

export interface CheckoutGateway {
  createSession(input: CreateCheckoutSessionInput): Promise<{ url: string }>;
}
