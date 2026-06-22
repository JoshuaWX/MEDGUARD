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
}) {
  const { data, error } = await invokeEdgeFunction<NearbyFacilitiesResponse>(
    'nearby-facilities',
    {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusMeters: params.radiusMeters ?? 5000,
      type: params.type ?? 'all',
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
