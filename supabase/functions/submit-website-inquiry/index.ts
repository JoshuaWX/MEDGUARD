import { serve } from 'std/http/server';
import { optionalEnv } from '../_shared/env.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { allowedWebsiteOrigin, websiteCors } from '../_shared/website-origin.ts';
import { InquiryValidationError, parseInquiryInput } from './validation.ts';

const SUCCESS_MESSAGE = 'Thanks — your message has been received for review.';

function configuredOrigins(): string[] {
  return optionalEnv('INQUIRY_ALLOWED_ORIGINS')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
}

function json(origin: string, body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...websiteCors(origin), ...extra, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

async function digest(namespace: string, value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`medguard-${namespace}:${value}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function notifyOwner(input: ReturnType<typeof parseInquiryInput>): Promise<void> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  const owner = optionalEnv('WAITLIST_OWNER_EMAIL');
  const sender = optionalEnv('WAITLIST_SENDER_EMAIL');
  if (!apiKey || !owner || !sender) {
    console.warn(JSON.stringify({ event: 'website_inquiry_notification_skipped', category: 'missing_configuration' }));
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: sender,
      to: [owner],
      subject: `New MedGuard website inquiry: ${input.topic.replaceAll('_', ' ')}`,
      text: [
        'A new website inquiry was accepted.',
        '',
        `Topic: ${input.topic}`,
        `Email: ${input.email}`,
        `Organization: ${input.organization ?? 'Not provided'}`,
        `Role: ${input.role ?? 'Not provided'}`,
        '',
        'Message:',
        input.message,
      ].join('\n'),
    }),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'website_inquiry_notification_failed', category: 'provider_rejected', status: response.status }));
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  if (!origin || !allowedWebsiteOrigin(origin, configuredOrigins())) return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: websiteCors(origin) });
  if (req.method !== 'POST') return json(origin, { error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const contentType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return json(origin, { error: 'content_type_must_be_json' }, 415);

  const raw = await req.text();
  if (!raw || raw.length > 4096) return json(origin, { error: 'invalid_payload' }, 400);

  let input;
  try {
    input = parseInquiryInput(JSON.parse(raw));
  } catch (error) {
    const code = error instanceof InquiryValidationError ? error.code : 'invalid_payload';
    return json(origin, { error: code }, 400);
  }

  const ipKey = await digest('inquiry-ip', clientIp(req));
  const emailKey = await digest('inquiry-email', input.email);
  const fingerprint = await digest('inquiry-dedupe', [input.email, input.topic, input.organization ?? '', input.role ?? '', input.message].join('|'));
  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit(req, { bucket: 'website_inquiry_ip', subjectId: ipKey, windowSeconds: 3600, maxRequests: 5 }),
    enforceRateLimit(req, { bucket: 'website_inquiry_email', subjectId: emailKey, windowSeconds: 86400, maxRequests: 3 }),
  ]);
  if (!ipLimit || !emailLimit) return json(origin, { error: 'service_temporarily_unavailable' }, 503);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
    return json(origin, { error: 'too_many_requests' }, 429, { 'Retry-After': String(retry) });
  }

  if (input.honeypotFilled) return json(origin, { ok: true, message: SUCCESS_MESSAGE });
  const admin = tryCreateAdminClient();
  if (!admin) return json(origin, { error: 'service_temporarily_unavailable' }, 503);

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: duplicate, error: duplicateError } = await admin
    .from('website_inquiries')
    .select('id')
    .eq('fingerprint', fingerprint)
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle();
  if (duplicateError) {
    console.error(JSON.stringify({ event: 'website_inquiry_dedupe_failed', category: 'database_rejected', code: duplicateError.code ?? 'unknown' }));
    return json(origin, { error: 'service_temporarily_unavailable' }, 503);
  }
  if (duplicate) return json(origin, { ok: true, message: SUCCESS_MESSAGE });

  const { error } = await admin.from('website_inquiries').insert({
    email: input.email,
    topic: input.topic,
    organization: input.organization,
    role: input.role,
    message: input.message,
    fingerprint,
    consented_at: new Date().toISOString(),
  });
  if (error) {
    console.error(JSON.stringify({ event: 'website_inquiry_insert_failed', category: 'database_rejected', code: error.code ?? 'unknown' }));
    return json(origin, { error: 'service_temporarily_unavailable' }, 503);
  }

  await notifyOwner(input);
  return json(origin, { ok: true, message: SUCCESS_MESSAGE }, 201);
});
