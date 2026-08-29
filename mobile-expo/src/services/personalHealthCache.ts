/**
 * Encrypted on-device cache for the compact personal-health dashboard.
 *
 * This deliberately has its own keyspace and chunking implementation instead
 * of using AsyncStorage. The payload is already minimised by the database RPC;
 * free text, cycle entries/notes, conditions, allergies, medications, signed
 * avatar URLs, and auth tokens never enter this cache.
 */
import * as SecureStore from 'expo-secure-store';

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `medguard.personal-health.${CACHE_VERSION}`;
const CHUNK_SIZE = 1800;
const META_SUFFIX = '.__chunks';
const CHUNK_SUFFIX = '.__chunk_';
const FRESH_FOR_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type PersonalHealthCacheFreshness = 'fresh' | 'stale';

export interface PersonalHealthCacheEntry<T> {
  data: T;
  cachedAt: string;
  freshness: PersonalHealthCacheFreshness;
}

const metaKey = (key: string) => `${key}${META_SUFFIX}`;
const chunkKey = (key: string, index: number) => `${key}${CHUNK_SUFFIX}${index}`;
const cacheKey = (userId: string) => `${CACHE_PREFIX}.${userId}`;
const scopedCacheKey = (namespace: string, userId: string, identifier: string) =>
  `medguard.secure.v1.${namespace}.${userId}.${encodeURIComponent(identifier)}`;
const scopedIndexKey = (namespace: string, userId: string) =>
  `medguard.secure.v1.${namespace}.${userId}.__index`;

async function removeSecureValue(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(metaKey(key), secureOptions);
  const chunkCount = Number(meta);

  if (Number.isInteger(chunkCount) && chunkCount > 0) {
    await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index), secureOptions),
      ),
    );
  }

  await Promise.all([
    SecureStore.deleteItemAsync(metaKey(key), secureOptions),
    SecureStore.deleteItemAsync(key, secureOptions),
  ]);
}

async function readSecureValue(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(metaKey(key), secureOptions);
  const chunkCount = Number(meta);
  if (Number.isInteger(chunkCount) && chunkCount > 0) {
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index), secureOptions),
      ),
    );
    return chunks.every((chunk): chunk is string => typeof chunk === 'string')
      ? chunks.join('')
      : null;
  }
  return SecureStore.getItemAsync(key, secureOptions);
}

async function writeSecureValue(key: string, value: string): Promise<void> {
  await removeSecureValue(key);
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(chunkKey(key, index), chunk, secureOptions),
    ),
  );
  await SecureStore.setItemAsync(metaKey(key), String(chunks.length), secureOptions);
}

function isSafeUserId(userId: string): boolean {
  // Auth user ids are UUIDs in MedGuard. This also prevents cache-key control
  // characters should this helper ever be called with untrusted input.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
}

export async function readPersonalHealthDashboardCache<T>(userId: string): Promise<PersonalHealthCacheEntry<T> | null> {
  if (!isSafeUserId(userId)) return null;

  try {
    const raw = await readSecureValue(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cachedAt?: unknown; data?: T };
    if (typeof parsed.cachedAt !== 'string' || parsed.data == null) {
      await removeSecureValue(cacheKey(userId));
      return null;
    }

    const age = Date.now() - new Date(parsed.cachedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      await removeSecureValue(cacheKey(userId));
      return null;
    }

    return {
      data: parsed.data,
      cachedAt: parsed.cachedAt,
      freshness: age <= FRESH_FOR_MS ? 'fresh' : 'stale',
    };
  } catch {
    return null;
  }
}

export async function writePersonalHealthDashboardCache<T>(userId: string, data: T): Promise<string | null> {
  if (!isSafeUserId(userId)) return null;

  try {
    const cachedAt = new Date().toISOString();
    const serialized = JSON.stringify({ cachedAt, data });
    // SecureStore has practical size limits. The compact RPC should be far
    // below this bound; refuse unexpectedly large payloads rather than retain
    // more personal data than intended.
    if (serialized.length > 48_000) return null;
    await writeSecureValue(cacheKey(userId), serialized);
    return cachedAt;
  } catch {
    return null;
  }
}

export async function clearPersonalHealthDashboardCache(userId: string | null | undefined): Promise<void> {
  if (!userId || !isSafeUserId(userId)) return;
  try {
    await removeSecureValue(cacheKey(userId));
  } catch {
    // Cache removal must never block sign-out or an account switch.
  }
}

/** Reuses the same chunked SecureStore discipline for other owner-scoped caches. */
export async function readSecureUserCache<T>(namespace: string, userId: string, identifier: string, freshForMs: number): Promise<PersonalHealthCacheEntry<T> | null> {
  if (!isSafeUserId(userId) || !/^[a-z0-9_-]{1,40}$/i.test(namespace)) return null;
  try {
    const raw = await readSecureValue(scopedCacheKey(namespace, userId, identifier));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cachedAt?: string; data?: T };
    const age = Date.now() - new Date(parsed.cachedAt ?? '').getTime();
    if (parsed.data == null || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
    return { data: parsed.data, cachedAt: parsed.cachedAt!, freshness: age <= freshForMs ? 'fresh' : 'stale' };
  } catch { return null; }
}

export async function writeSecureUserCache<T>(namespace: string, userId: string, identifier: string, data: T): Promise<void> {
  if (!isSafeUserId(userId) || !/^[a-z0-9_-]{1,40}$/i.test(namespace)) return;
  const serialized = JSON.stringify({ cachedAt: new Date().toISOString(), data });
  if (serialized.length > 48_000) return;
  try {
    await writeSecureValue(scopedCacheKey(namespace, userId, identifier), serialized);
    const indexKey = scopedIndexKey(namespace, userId);
    const rawIndex = await readSecureValue(indexKey);
    const identifiers = rawIndex ? JSON.parse(rawIndex) as unknown : [];
    const next = new Set(Array.isArray(identifiers) ? identifiers.filter((item): item is string => typeof item === 'string') : []);
    next.add(identifier);
    await writeSecureValue(indexKey, JSON.stringify([...next].slice(-100)));
  } catch { /* cache is best effort */ }
}

export async function clearSecureUserCache(namespace: string, userId: string, identifier: string): Promise<void> {
  if (!isSafeUserId(userId) || !/^[a-z0-9_-]{1,40}$/i.test(namespace)) return;
  try { await removeSecureValue(scopedCacheKey(namespace, userId, identifier)); } catch { /* no-op */ }
}

/** Remove every encrypted entry in one user's namespace on sign-out/account changes. */
export async function clearSecureUserNamespace(namespace: string, userId: string): Promise<void> {
  if (!isSafeUserId(userId) || !/^[a-z0-9_-]{1,40}$/i.test(namespace)) return;
  const indexKey = scopedIndexKey(namespace, userId);
  try {
    const rawIndex = await readSecureValue(indexKey);
    const identifiers = rawIndex ? JSON.parse(rawIndex) as unknown : [];
    if (Array.isArray(identifiers)) {
      await Promise.all(identifiers
        .filter((item): item is string => typeof item === 'string')
        .map((identifier) => removeSecureValue(scopedCacheKey(namespace, userId, identifier))));
    }
    await removeSecureValue(indexKey);
  } catch {
    // Cache removal must not prevent sign-out.
  }
}
