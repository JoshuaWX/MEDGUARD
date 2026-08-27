import * as SecureStore from 'expo-secure-store';
import { invokeEdgeFunction } from './edge';

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `medguard.location.${CACHE_VERSION}`;
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
}

export interface ConfirmedLocationSnapshot {
  location: DeviceLocation;
  state: string;
  address: string | null;
  observedAt: string;
  source: 'gps';
}

interface VerifyLocationResponse {
  latitude: number;
  longitude: number;
  detectedState: string;
  address: string | null;
  observedAt: string;
  persisted: boolean;
}

function isSafeUserId(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
}

function keyFor(userId: string): string {
  return `${CACHE_PREFIX}.${userId}`;
}

export async function readConfirmedLocationCache(userId: string): Promise<ConfirmedLocationSnapshot | null> {
  if (!isSafeUserId(userId)) return null;
  try {
    const raw = await SecureStore.getItemAsync(keyFor(userId), secureOptions);
    if (!raw) return null;
    const value = JSON.parse(raw) as ConfirmedLocationSnapshot;
    if (!value?.location || typeof value.state !== 'string' || !value.state) return null;
    if (!Number.isFinite(value.location.latitude) || !Number.isFinite(value.location.longitude)) return null;
    return value;
  } catch {
    return null;
  }
}

export async function writeConfirmedLocationCache(userId: string, snapshot: ConfirmedLocationSnapshot): Promise<void> {
  if (!isSafeUserId(userId)) return;
  try {
    await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(snapshot), secureOptions);
  } catch {
    // A cache miss is safe; never block a confirmed location write on this.
  }
}

export async function clearConfirmedLocationCache(userId: string | null | undefined): Promise<void> {
  if (!userId || !isSafeUserId(userId)) return;
  await SecureStore.deleteItemAsync(keyFor(userId), secureOptions).catch(() => undefined);
}

/** Server-geocode and, for authenticated calls, persist the canonical alert area. */
export async function verifyAndPersistLocation(location: DeviceLocation): Promise<ConfirmedLocationSnapshot> {
  const { data, error } = await invokeEdgeFunction<VerifyLocationResponse>(
    'verify-location',
    {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracy,
      observedAt: new Date(location.timestamp).toISOString(),
    },
    { timeout: 30000, retries: 1 },
  );
  if (error || !data?.persisted || !data.detectedState) {
    throw error ?? new Error('Unable to confirm and save your location.');
  }
  return {
    location,
    state: data.detectedState,
    address: data.address ?? null,
    observedAt: data.observedAt,
    source: 'gps',
  };
}
