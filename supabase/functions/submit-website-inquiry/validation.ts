export const INQUIRY_TOPICS = ['pilot', 'product_feedback', 'community_idea'] as const;
export type InquiryTopic = typeof INQUIRY_TOPICS[number];

export interface InquiryInput {
  email: string;
  topic: InquiryTopic;
  organization: string | null;
  role: string | null;
  message: string;
  consent: true;
  honeypotFilled: boolean;
}

export class InquiryValidationError extends Error {
  constructor(public readonly code: string) { super(code); }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISALLOWED_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function optionalText(value: unknown, maxLength: number, code: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new InquiryValidationError(code);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > maxLength || DISALLOWED_CONTROLS.test(normalized)) throw new InquiryValidationError(code);
  return normalized;
}

export function parseInquiryInput(value: unknown): InquiryInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InquiryValidationError('invalid_payload');
  const body = value as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const topic = body.topic;
  const message = typeof body.message === 'string' ? body.message.trim().replace(/\r\n/g, '\n') : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';

  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email) || DISALLOWED_CONTROLS.test(email)) {
    throw new InquiryValidationError('invalid_email');
  }
  if (typeof topic !== 'string' || !INQUIRY_TOPICS.includes(topic as InquiryTopic)) {
    throw new InquiryValidationError('invalid_topic');
  }
  if (message.length < 20 || message.length > 1500 || DISALLOWED_CONTROLS.test(message)) {
    throw new InquiryValidationError('invalid_message');
  }
  if (body.consent !== true) throw new InquiryValidationError('consent_required');
  if (company.length > 200) throw new InquiryValidationError('invalid_payload');

  return {
    email,
    topic: topic as InquiryTopic,
    organization: optionalText(body.organization, 120, 'invalid_organization'),
    role: optionalText(body.role, 80, 'invalid_role'),
    message,
    consent: true,
    honeypotFilled: company.length > 0,
  };
}
