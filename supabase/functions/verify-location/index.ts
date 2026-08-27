import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

type VerifyLocationRequest = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  observedAt?: string | null;
};

const VERIFY_LOCATION_RATE_LIMIT = { windowSeconds: 60, maxRequests: 20 };

const NIGERIAN_STATES: Record<string, string> = {
  abia: 'Abia', adamawa: 'Adamawa', 'akwa ibom': 'Akwa Ibom', anambra: 'Anambra',
  bauchi: 'Bauchi', bayelsa: 'Bayelsa', benue: 'Benue', borno: 'Borno',
  'cross river': 'Cross River', delta: 'Delta', ebonyi: 'Ebonyi', edo: 'Edo',
  ekiti: 'Ekiti', enugu: 'Enugu', gombe: 'Gombe', imo: 'Imo', jigawa: 'Jigawa',
  kaduna: 'Kaduna', kano: 'Kano', katsina: 'Katsina', kebbi: 'Kebbi', kogi: 'Kogi',
  kwara: 'Kwara', lagos: 'Lagos', nasarawa: 'Nasarawa', niger: 'Niger', ogun: 'Ogun',
  ondo: 'Ondo', osun: 'Osun', oyo: 'Oyo', plateau: 'Plateau', rivers: 'Rivers',
  sokoto: 'Sokoto', taraba: 'Taraba', yobe: 'Yobe', zamfara: 'Zamfara',
  fct: 'Federal Capital Territory', 'federal capital territory': 'Federal Capital Territory',
  abuja: 'Federal Capital Territory',
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

function parseNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function canonicalNigerianState(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.toLowerCase().replace(/\s+state$/i, '').replace(/\s+/g, ' ').trim();
  return NIGERIAN_STATES[key] ?? null;
}

function parseObservedAt(value: unknown): string {
  if (typeof value !== 'string') return new Date().toISOString();
  const timestamp = Date.parse(value);
  // Do not accept timestamps meaningfully far from the current time. They are
  // ordering metadata, never a client-controlled source of truth.
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 24 * 60 * 60 * 1000) {
    return new Date().toISOString();
  }
  return new Date(timestamp).toISOString();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  try {
    const payload = await req.json().catch(() => null) as VerifyLocationRequest | null;
    if (!payload) return jsonResponse({ error: 'A JSON request body is required' }, { status: 400 });

    const latitude = parseNumber(payload.latitude);
    const longitude = parseNumber(payload.longitude);
    const accuracyMeters = parseNumber(payload.accuracyMeters);
    if (latitude == null || longitude == null) {
      return jsonResponse({ error: 'latitude and longitude are required' }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return jsonResponse({ error: 'invalid latitude/longitude range' }, { status: 400 });
    }
    if (accuracyMeters != null && (accuracyMeters < 0 || accuracyMeters > 100000)) {
      return jsonResponse({ error: 'invalid accuracy range' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    const userClient = authHeader ? createUserClient(req) : null;
    const { data: userData } = userClient ? await userClient.auth.getUser() : { data: { user: null } };
    const userId = userData?.user?.id ?? null;

    const rate = await enforceRateLimit(req, {
      bucket: 'verify-location',
      windowSeconds: VERIFY_LOCATION_RATE_LIMIT.windowSeconds,
      maxRequests: VERIFY_LOCATION_RATE_LIMIT.maxRequests,
      userId,
    });
    if (rate && !rate.allowed) {
      return jsonResponse(
        { error: 'Too many location verification requests. Please wait and try again.', retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }

    const nominatim = new URL('https://nominatim.openstreetmap.org/reverse');
    nominatim.searchParams.set('format', 'jsonv2');
    nominatim.searchParams.set('lat', String(latitude));
    nominatim.searchParams.set('lon', String(longitude));
    nominatim.searchParams.set('zoom', '10');
    nominatim.searchParams.set('addressdetails', '1');

    const reverseRes = await fetch(nominatim, {
      headers: { 'User-Agent': 'MedGuard/1.0 (Supabase Edge Function)', Accept: 'application/json' },
    });
    if (!reverseRes.ok) return jsonResponse({ error: 'reverse geocoding failed' }, { status: 502 });

    const reverseJson: any = await reverseRes.json();
    const address = reverseJson?.address ?? {};
    const detectedState = canonicalNigerianState(
      address.state ?? address.region ?? address.state_district ?? address.county ?? address.province,
    );
    if (!detectedState) {
      return jsonResponse({ error: 'Location is outside a supported Nigerian state' }, { status: 422 });
    }

    const observedAt = parseObservedAt(payload.observedAt);
    if (userClient && userId) {
      const { error: persistError } = await userClient.rpc('record_verified_location', {
        p_state: detectedState,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy_meters: accuracyMeters,
        p_observed_at: observedAt,
      });
      if (persistError) {
        return jsonResponse({ error: 'Unable to save verified location' }, { status: 500 });
      }
    }

    return jsonResponse({
      latitude,
      longitude,
      detectedState,
      address: typeof reverseJson?.display_name === 'string' ? reverseJson.display_name : null,
      observedAt,
      persisted: Boolean(userId),
    });
  } catch {
    return jsonResponse({ error: 'Unexpected error while verifying location' }, { status: 500 });
  }
});
