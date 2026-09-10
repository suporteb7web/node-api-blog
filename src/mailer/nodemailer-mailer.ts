import nodemailer from 'nodemailer';
import type { Mailer, SendMailInput } from './mailer.js';

const SMTP_TIMEOUT_MS = 3_000;

function smtpHost(): string {
  const host = process.env.SMTP_HOST ?? '127.0.0.1';
  return host === 'localhost' ? '127.0.0.1' : host;
}

export class NodemailerMailer implements Mailer {
  private readonly from = process.env.MAIL_FROM ?? 'noreply@blog.local';

  async send({ to, subject, text }: SendMailInput): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: smtpHost(),
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      ignoreTLS: true,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });

    try {
      await transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
      });
    } finally {
      transporter.close();
    }
  }
}
