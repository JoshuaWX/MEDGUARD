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
  return { facilities: data?.facilities || [], error: null };
}
