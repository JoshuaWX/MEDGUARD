export const WAITLIST_PLATFORMS = ['android', 'ios', 'other'] as const;
export type WaitlistPlatform = typeof WAITLIST_PLATFORMS[number];

export interface WaitlistInput {
  email: string;
  platform: WaitlistPlatform;
  consent: true;
  honeypotFilled: boolean;
}

export class WaitlistValidationError extends Error {
  constructor(public readonly code: string) { super(code); }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseWaitlistInput(value: unknown): WaitlistInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WaitlistValidationError('invalid_payload');
  const body = value as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const platform = body.platform === undefined || body.platform === '' ? 'other' : body.platform;
  const company = typeof body.company === 'string' ? body.company.trim() : '';

  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email) || /[\u0000-\u001f\u007f]/.test(email)) {
    throw new WaitlistValidationError('invalid_email');
  }
  if (typeof platform !== 'string' || !WAITLIST_PLATFORMS.includes(platform as WaitlistPlatform)) {
    throw new WaitlistValidationError('invalid_platform');
  }
  if (body.consent !== true) throw new WaitlistValidationError('consent_required');
  if (company.length > 200) throw new WaitlistValidationError('invalid_payload');

  return { email, platform: platform as WaitlistPlatform, consent: true, honeypotFilled: company.length > 0 };
}
