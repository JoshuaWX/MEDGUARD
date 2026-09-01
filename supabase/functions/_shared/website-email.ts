import { optionalEnv } from './env.ts';

export type WebsiteEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export type WebsiteMailer = {
  apiKey: string;
  owner: string;
  sender: string;
};

export type DeliveryResult = {
  accepted: boolean;
  category: 'accepted' | 'missing_configuration' | 'invalid_sender' | 'provider_rejected' | 'provider_unavailable';
  status?: number;
  id?: string;
};

const SENDER_PATTERN = /^(?:[^<>\r\n]+\s+)?<[^<>\s@]+@[^<>\s@]+>$|^[^<>\s@]+@[^<>\s@]+$/;

export function isUsableSender(value: string | null | undefined): value is string {
  return Boolean(value && SENDER_PATTERN.test(value.trim()));
}

export function configuredWebsiteMailer(): WebsiteMailer | undefined {
  const apiKey = optionalEnv('RESEND_API_KEY');
  const owner = optionalEnv('WAITLIST_OWNER_EMAIL');
  const sender = optionalEnv('WAITLIST_SENDER_EMAIL');
  if (!apiKey || !owner || !isUsableSender(sender)) return undefined;
  return { apiKey, owner, sender: sender.trim() };
}

export async function deliverWebsiteEmail(
  mailer: WebsiteMailer | undefined,
  email: WebsiteEmail,
  request: typeof fetch = fetch,
): Promise<DeliveryResult> {
  if (!mailer) return { accepted: false, category: 'missing_configuration' };
  if (!isUsableSender(mailer.sender)) return { accepted: false, category: 'invalid_sender' };

  try {
    const response = await request('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mailer.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mailer.sender,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
      }),
    });
    const body = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok) return { accepted: false, category: 'provider_rejected', status: response.status };
    return { accepted: true, category: 'accepted', status: response.status, id: body.id };
  } catch {
    return { accepted: false, category: 'provider_unavailable' };
  }
}

export function logWebsiteDelivery(event: string, result: DeliveryResult): void {
  const level = result.accepted ? console.info : console.error;
  level(JSON.stringify({ event, category: result.category, status: result.status, providerMessageId: result.id }));
}
