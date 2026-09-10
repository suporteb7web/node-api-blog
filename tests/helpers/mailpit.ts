const mailpitApiUrl = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

type MailpitAddress = {
  Address: string;
};

type MailpitMessageSummary = {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
};

type MailpitListResponse = {
  messages: MailpitMessageSummary[];
};

export type MailpitMessage = {
  ID: string;
  Subject: string;
  Text: string;
  To: MailpitAddress[];
};

export async function cleanMailpit(): Promise<void> {
  const response = await fetch(`${mailpitApiUrl}/api/v1/messages`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Failed to clean Mailpit: ${response.status}`);
  }
}

export async function listMailpitMessages(): Promise<MailpitMessageSummary[]> {
  const response = await fetch(`${mailpitApiUrl}/api/v1/messages`);

  if (!response.ok) {
    throw new Error(`Failed to list Mailpit messages: ${response.status}`);
  }

  const body = (await response.json()) as MailpitListResponse;
  return body.messages ?? [];
}

export async function getMailpitMessage(id: string): Promise<MailpitMessage> {
  const response = await fetch(`${mailpitApiUrl}/api/v1/message/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to get Mailpit message ${id}: ${response.status}`);
  }

  return (await response.json()) as MailpitMessage;
}

