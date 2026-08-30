import { serve } from 'std/http/server';
import { optionalEnv } from '../_shared/env.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { parseWaitlistInput, WaitlistValidationError } from './validation.ts';

const DEFAULT_ORIGINS = [
  'https://medguardng.me',
  'https://www.medguardng.me',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
];
const SUCCESS_MESSAGE = 'Thanks — if this address is eligible, it is now on the prototype list.';

function allowedOrigins(): Set<string> {
  const configured = optionalEnv('WAITLIST_ALLOWED_ORIGINS')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}

function cors(origin: string): HeadersInit {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
}

function json(origin: string, body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), ...extra, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`medguard-waitlist:${value}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function notifyOwner(email: string, platform: string): Promise<void> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  const owner = optionalEnv('WAITLIST_OWNER_EMAIL');
  const sender = optionalEnv('WAITLIST_SENDER_EMAIL');
  if (!apiKey || !owner || !sender) {
    console.warn(JSON.stringify({ event: 'waitlist_notification_skipped', category: 'missing_configuration' }));
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender, to: [owner], subject: 'New MedGuard prototype waitlist entry', text: `A new prototype entry was accepted.\n\nEmail: ${email}\nPlatform: ${platform}` }),
  });
  if (!response.ok) console.error(JSON.stringify({ event: 'waitlist_notification_failed', category: 'provider_rejected', status: response.status }));
}

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  if (!origin || !allowedOrigins().has(origin)) return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
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

  await notifyOwner(input.email, input.platform);
  return json(origin, { ok: true, message: SUCCESS_MESSAGE }, 201);
});
