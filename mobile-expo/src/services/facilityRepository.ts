import { fetchNearbyFacilities, type NearbyFacility } from './nearbyFacilities';
import { clearSecureUserNamespace, readSecureUserCache, writeSecureUserCache } from './personalHealthCache';

type Query = { latitude: number; longitude: number; type: 'all' | 'clinic' | 'pharmacy'; disease?: string; userId: string; force?: boolean };
export type FacilitySnapshot = { facilities: NearbyFacility[]; radiusMeters: number; cachedAt: string; stale: boolean };

const FRESH_FOR_MS = 10 * 60 * 1000;
const inFlight = new Map<string, Promise<{ snapshot: FacilitySnapshot | null; error: Error | null }>>();

function key(query: Query) {
  return `${query.latitude.toFixed(3)},${query.longitude.toFixed(3)}|${query.type}|${query.disease ?? ''}`;
}

function requestKey(query: Query) {
  return `${query.userId}|${key(query)}`;
}

export async function loadNearbyFacilitySnapshot(query: Query): Promise<{ snapshot: FacilitySnapshot | null; error: Error | null }> {
  const cacheId = key(query);
  let staleSnapshot: FacilitySnapshot | null = null;
  if (!query.force) {
    const cached = await readSecureUserCache<Omit<FacilitySnapshot, 'cachedAt' | 'stale'>>('facilities', query.userId, cacheId, FRESH_FOR_MS);
    if (cached?.freshness === 'fresh') return { snapshot: { ...cached.data, cachedAt: cached.cachedAt, stale: false }, error: null };
    if (cached) staleSnapshot = { ...cached.data, cachedAt: cached.cachedAt, stale: true };
  }
  const pendingKey = requestKey(query);
  const pending = inFlight.get(pendingKey);
  if (pending) return pending;
  const request = (async () => {
    const first = await fetchNearbyFacilities({ latitude: query.latitude, longitude: query.longitude, radiusMeters: 5000, type: query.type, disease: query.disease });
    if (first.error) return { snapshot: staleSnapshot, error: staleSnapshot ? null : first.error };
    const hasNearby = first.facilities.some((facility) => !facility.ncdcDesignated);
    let value: { facilities: NearbyFacility[]; radiusMeters: number };
    if (hasNearby || first.facilities.length > 0) {
      value = { facilities: first.facilities, radiusMeters: 5000 };
    } else {
      const wider = await fetchNearbyFacilities({ latitude: query.latitude, longitude: query.longitude, radiusMeters: 15000, type: query.type, disease: query.disease });
      if (wider.error) return { snapshot: staleSnapshot, error: staleSnapshot ? null : wider.error };
      value = { facilities: wider.facilities, radiusMeters: 15000 };
    }
    const cachedAt = new Date().toISOString();
    await writeSecureUserCache('facilities', query.userId, cacheId, { ...value });
    return { snapshot: { ...value, cachedAt, stale: false }, error: null };
  })().finally(() => inFlight.delete(pendingKey));
  inFlight.set(pendingKey, request);
  return request;
}

export async function clearNearbyFacilityCache(userId: string): Promise<void> {
  await clearSecureUserNamespace('facilities', userId);
  for (const pendingKey of inFlight.keys()) {
    if (pendingKey.startsWith(`${userId}|`)) inFlight.delete(pendingKey);
  }
}
