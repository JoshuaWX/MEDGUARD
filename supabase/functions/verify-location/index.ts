import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

type VerifyLocationRequest = {
  latitude: number;
  longitude: number;
};

const VERIFY_LOCATION_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 20,
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

function parseNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let payload: any = {};
    if (req.method === 'POST') {
      payload = await req.json().catch(() => ({}));
    } else {
      const url = new URL(req.url);
      payload.latitude = url.searchParams.get('latitude');
      payload.longitude = url.searchParams.get('longitude');
    }

    const latitude = parseNumber(payload.latitude);
    const longitude = parseNumber(payload.longitude);
    if (latitude == null || longitude == null) {
      return jsonResponse({ error: 'latitude and longitude are required' }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return jsonResponse({ error: 'invalid latitude/longitude range' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const supabase = createUserClient(req);
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    }

    const rate = await enforceRateLimit(req, {
      bucket: 'verify-location',
      windowSeconds: VERIFY_LOCATION_RATE_LIMIT.windowSeconds,
      maxRequests: VERIFY_LOCATION_RATE_LIMIT.maxRequests,
      userId,
    });
    if (rate && !rate.allowed) {
      return jsonResponse(
        {
          error: 'Too many location verification requests. Please wait and try again.',
          retryAfterSeconds: rate.retryAfterSeconds,
          resetAt: rate.resetAt,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    const nominatim = new URL('https://nominatim.openstreetmap.org/reverse');
    nominatim.searchParams.set('format', 'jsonv2');
    nominatim.searchParams.set('lat', String(latitude));
    nominatim.searchParams.set('lon', String(longitude));
    nominatim.searchParams.set('zoom', '10');
    nominatim.searchParams.set('addressdetails', '1');

    const reverseRes = await fetch(nominatim.toString(), {
      headers: {
        'User-Agent': 'MedGuard/1.0 (Supabase Edge Function)',
        'Accept': 'application/json',
      },
    });

    if (!reverseRes.ok) {
      const msg = await reverseRes.text();
      return jsonResponse({ error: msg || 'reverse geocoding failed' }, { status: 502 });
    }

    const reverseJson: any = await reverseRes.json();
    const address: any = reverseJson?.address || {};

    const detectedState =
      address.state ||
      address.region ||
      address.state_district ||
      address.county ||
      address.province ||
      reverseJson?.display_name ||
      '';

    // Best-effort: if caller is authenticated, upsert into user_context.
    if (authHeader) {
      const supabase = createUserClient(req);
      const { data: userData } = await supabase.auth.getUser();
      const resolvedUserId = userData?.user?.id;
      if (resolvedUserId) {
        await supabase.rpc('upsert_user_context', {
          p_user_id: resolvedUserId,
          p_state: detectedState || null,
          p_latitude: latitude,
          p_longitude: longitude,
        } as any);
      }
    }

    return jsonResponse({
      latitude,
      longitude,
      detectedState,
      address: reverseJson?.display_name || null,
      raw: reverseJson,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Unexpected error' }, { status: 500 });
  }
});
