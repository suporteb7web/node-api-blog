export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

export interface Mailer {
  send(input: SendMailInput): Promise<void>;
}
