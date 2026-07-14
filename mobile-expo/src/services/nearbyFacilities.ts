import { invokeEdgeFunction } from './edge';

export type NearbyFacilityKind = 'clinic' | 'pharmacy';

export interface NearbyFacility {
  id: string;
  name: string;
  kind: NearbyFacilityKind;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceMeters: number;
  source: string;
  /** Present in treatment-finder mode (curated NCDC centre description). */
  description?: string | null;
  phone?: string | null;
  /** Authoritative Google Maps destination for curated centres; else route by coords. */
  directionsQuery?: string | null;
  ncdcDesignated?: boolean;
}

function isUsableFacility(value: unknown): value is NearbyFacility {
  const facility = value as Partial<NearbyFacility> | null;
  return Boolean(
    facility &&
    typeof facility.id === 'string' &&
    facility.id.length > 0 &&
    typeof facility.name === 'string' &&
    facility.name.length > 0 &&
    Number.isFinite(facility.latitude) &&
    Number.isFinite(facility.longitude) &&
    Number(facility.latitude) >= -90 &&
    Number(facility.latitude) <= 90 &&
    Number(facility.longitude) >= -180 &&
    Number(facility.longitude) <= 180
  );
}

interface NearbyFacilitiesResponse {
  facilities: NearbyFacility[];
  query: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    type: 'all' | 'clinic' | 'pharmacy';
  };
  generatedAt: string;
}

export async function fetchNearbyFacilities(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  type?: 'all' | 'clinic' | 'pharmacy';
  /** When set, treatment-finder mode: curated NCDC centres first + broadened hospital search. */
  disease?: string;
}) {
  const { data, error } = await invokeEdgeFunction<NearbyFacilitiesResponse>(
    'nearby-facilities',
    {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusMeters: params.radiusMeters ?? 5000,
      type: params.type ?? 'all',
      ...(params.disease ? { disease: params.disease } : {}),
    },
    {
      timeout: 30000,
      retries: 1,
    }
  );

  if (error) return { facilities: [] as NearbyFacility[], error };
  const facilities = Array.isArray(data?.facilities)
    ? data.facilities.filter(isUsableFacility)
    : [];
  return { facilities, error: null };
}
