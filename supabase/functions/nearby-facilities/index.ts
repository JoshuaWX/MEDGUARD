import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

type FacilityType = 'all' | 'clinic' | 'pharmacy';

type NearbyFacilitiesRequest = {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  type?: FacilityType;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const NEARBY_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 24,
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function normalizeType(input: unknown): FacilityType {
  const v = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (v === 'clinic') return 'clinic';
  if (v === 'pharmacy') return 'pharmacy';
  return 'all';
}

function buildOverpassQuery(lat: number, lon: number, radiusMeters: number, type: FacilityType): string {
  const baseClinic = '["amenity"~"hospital|clinic|doctors|dentist"]';
  const basePharmacy = '["amenity"="pharmacy"]';

  const parts: string[] = [];
  if (type === 'all' || type === 'clinic') {
    parts.push(`node${baseClinic}(around:${radiusMeters},${lat},${lon});`);
    parts.push(`way${baseClinic}(around:${radiusMeters},${lat},${lon});`);
    parts.push(`relation${baseClinic}(around:${radiusMeters},${lat},${lon});`);
  }
  if (type === 'all' || type === 'pharmacy') {
    parts.push(`node${basePharmacy}(around:${radiusMeters},${lat},${lon});`);
    parts.push(`way${basePharmacy}(around:${radiusMeters},${lat},${lon});`);
    parts.push(`relation${basePharmacy}(around:${radiusMeters},${lat},${lon});`);
  }

  return `
[out:json][timeout:25];
(
  ${parts.join('\n  ')}
);
out center tags;
`;
}

function classifyFacility(tags: Record<string, string> | undefined): 'clinic' | 'pharmacy' {
  const amenity = (tags?.amenity || '').toLowerCase();
  if (amenity === 'pharmacy') return 'pharmacy';
  return 'clinic';
}

function formatAddress(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  const line = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
  ].filter(Boolean).join(' ');
  return line || null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    let body: NearbyFacilitiesRequest = {};
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
    } else {
      const params = new URL(req.url).searchParams;
      body = {
        latitude: params.get('latitude') ?? undefined,
        longitude: params.get('longitude') ?? undefined,
        radiusMeters: params.get('radiusMeters') ?? undefined,
        type: (params.get('type') as FacilityType) ?? undefined,
      } as unknown as NearbyFacilitiesRequest;
    }

    const latitude = parseNumber(body.latitude);
    const longitude = parseNumber(body.longitude);
    const radius = clamp(parseNumber(body.radiusMeters) ?? 5000, 1000, 20000);
    const type = normalizeType(body.type);

    if (latitude == null || longitude == null) {
      return jsonResponse({ error: 'latitude and longitude are required' }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return jsonResponse({ error: 'invalid latitude/longitude range' }, { status: 400 });
    }

    let userId: string | null = null;
    if (req.headers.get('Authorization')) {
      const userClient = createUserClient(req);
      const { data: userData } = await userClient.auth.getUser();
      userId = userData?.user?.id || null;
    }

    const rate = await enforceRateLimit(req, {
      bucket: 'nearby-facilities',
      windowSeconds: NEARBY_RATE_LIMIT.windowSeconds,
      maxRequests: NEARBY_RATE_LIMIT.maxRequests,
      userId,
    });
    if (rate && !rate.allowed) {
      return jsonResponse(
        {
          error: 'Too many nearby search requests. Please wait and try again.',
          retryAfterSeconds: rate.retryAfterSeconds,
          resetAt: rate.resetAt,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    const query = buildOverpassQuery(latitude, longitude, radius, type);
    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'MedGuard/1.0 (Supabase Edge Function nearby-facilities)',
      },
      body: query,
    });

    if (!overpassRes.ok) {
      const details = await overpassRes.text().catch(() => 'overpass error');
      return jsonResponse({ error: details || 'Facility lookup failed' }, { status: 502 });
    }

    const overpassData = (await overpassRes.json().catch(() => ({}))) as { elements?: OverpassElement[] };
    const elements = overpassData.elements || [];

    const facilities = elements
      .map((el) => {
        const point = el.type === 'node'
          ? { lat: el.lat, lon: el.lon }
          : { lat: el.center?.lat, lon: el.center?.lon };
        if (!point.lat || !point.lon) return null;

        const tags = el.tags || {};
        const name = tags.name || tags.operator || tags.brand || 'Health Facility';
        const kind = classifyFacility(tags);
        const distanceMeters = Math.round(haversineMeters(latitude, longitude, point.lat, point.lon));

        return {
          id: `${el.type}-${el.id}`,
          name,
          kind,
          latitude: point.lat,
          longitude: point.lon,
          address: formatAddress(tags),
          distanceMeters,
          source: 'OpenStreetMap/Overpass',
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 60);

    return jsonResponse({
      facilities,
      query: {
        latitude,
        longitude,
        radiusMeters: radius,
        type,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Unexpected error' }, { status: 500 });
  }
});
