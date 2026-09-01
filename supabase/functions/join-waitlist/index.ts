import { serve } from 'std/http/server';
import { optionalEnv } from '../_shared/env.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { allowedWebsiteOrigin, websiteCors } from '../_shared/website-origin.ts';
import { configuredWebsiteMailer, deliverWebsiteEmail, logWebsiteDelivery } from '../_shared/website-email.ts';
import { parseWaitlistInput, WaitlistValidationError } from './validation.ts';

const SUCCESS_MESSAGE = 'Thanks — if this address is eligible, it is now on the prototype list.';

function configuredOrigins(): string[] {
  return optionalEnv('WAITLIST_ALLOWED_ORIGINS')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
}

function json(origin: string, body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...websiteCors(origin), ...extra, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`medguard-waitlist:${value}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function notifyWaitlist(email: string, platform: string): Promise<boolean> {
  const mailer = configuredWebsiteMailer();
  const [owner, visitor] = await Promise.all([
    deliverWebsiteEmail(mailer, { to: mailer?.owner ?? '', replyTo: email, subject: 'New MedGuard prototype request', text: `A new prototype request was accepted.\n\nEmail: ${email}\nPlatform: ${platform}` }),
    deliverWebsiteEmail(mailer, { to: email, replyTo: mailer?.owner, subject: 'MedGuard prototype request received', text: 'Thanks for joining the MedGuard prototype list. We have received your request and will contact you about relevant prototype updates.\n\nMedGuard is a prototype for health awareness only. It does not provide a diagnosis.' }),
  ]);
  logWebsiteDelivery('waitlist_owner_notification', owner);
  logWebsiteDelivery('waitlist_visitor_confirmation', visitor);
  return visitor.accepted;
}

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  if (!origin || !allowedWebsiteOrigin(origin, configuredOrigins())) return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: websiteCors(origin) });
  if (req.method !== 'POST') return json(origin, { error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const contentType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return json(origin, { error: 'content_type_must_be_json' }, 415);

  const raw = await req.text();
  if (!raw || raw.length > 2048) return json(origin, { error: 'invalid_payload' }, 400);

  let input;
  try { input = parseWaitlistInput(JSON.parse(raw)); }
  catch (error) {
    const code = error instanceof WaitlistValidationError ? error.code : 'invalid_payload';
    return json(origin, { error: code }, 400);
  }

  const ipKey = await digest(clientIp(req));
  const emailKey = await digest(input.email);
  const ipLimit = await enforceRateLimit(req, { bucket: 'website_waitlist_ip', subjectId: ipKey, windowSeconds: 3600, maxRequests: 8 });
  const emailLimit = await enforceRateLimit(req, { bucket: 'website_waitlist_email', subjectId: emailKey, windowSeconds: 86400, maxRequests: 3 });
  if (!ipLimit || !emailLimit) return json(origin, { error: 'service_temporarily_unavailable' }, 503);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
    return json(origin, { error: 'too_many_requests' }, 429, { 'Retry-After': String(retry) });
  }

  if (input.honeypotFilled) return json(origin, { ok: true, message: SUCCESS_MESSAGE });
  const admin = tryCreateAdminClient();
  if (!admin) return json(origin, { error: 'service_temporarily_unavailable' }, 503);

  const { error } = await admin.from('prototype_waitlist').insert({ email: input.email, platform: input.platform, consented_at: new Date().toISOString() });
  if (error?.code === '23505') return json(origin, { ok: true, message: SUCCESS_MESSAGE });
  if (error) {
    console.error(JSON.stringify({ event: 'waitlist_insert_failed', category: 'database_rejected', code: error.code ?? 'unknown' }));
    return json(origin, { error: 'service_temporarily_unavailable' }, 503);
  }

  const confirmationSent = await notifyWaitlist(input.email, input.platform);
  return json(origin, {
    ok: true,
    message: confirmationSent ? SUCCESS_MESSAGE : 'Thanks — your request has been received. Our confirmation email is temporarily unavailable, so please do not submit it again.',
  }, 201);
});
