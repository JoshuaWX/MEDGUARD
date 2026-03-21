import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

interface SignRequest {
  path?: string;
  expiresIn?: number;
}

const AVATAR_SIGN_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 30,
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  try {
    const body: SignRequest = await req.json().catch(() => ({}));
    const path = typeof body?.path === 'string' ? body.path.trim() : '';
    const expiresIn = clampInt(body?.expiresIn, 60, 60 * 60 * 24, 3600);

    if (!path) return jsonResponse({ error: 'path is required' }, { status: 400 });

    const userClient = createUserClient(req);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userData.user.id;

    const rate = await enforceRateLimit(req, {
      bucket: 'avatar-sign',
      windowSeconds: AVATAR_SIGN_RATE_LIMIT.windowSeconds,
      maxRequests: AVATAR_SIGN_RATE_LIMIT.maxRequests,
      userId,
    });
    if (rate && !rate.allowed) {
      return jsonResponse(
        {
          error: 'Too many avatar URL requests. Please wait before trying again.',
          retryAfterSeconds: rate.retryAfterSeconds,
          resetAt: rate.resetAt,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    if (!path.startsWith(`${userId}/`)) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage.from('avatars').createSignedUrl(path, expiresIn);
    if (error) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }

    return jsonResponse({ url: data?.signedUrl || null, expiresIn });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Unexpected error' }, { status: 500 });
  }
});
