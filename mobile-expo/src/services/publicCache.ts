/**
 * Small versioned cache for public, non-personal responses. Never use this
 * store for messages, profile data, sessions, precise locations, or tokens.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const VERSION = 'v1';
const PREFIX = `medguard.public.${VERSION}`;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PublicCacheEntry<T> = { data: T; cachedAt: string; fresh: boolean };

function key(namespace: string, identifier: string) {
  return `${PREFIX}.${namespace}.${encodeURIComponent(identifier.toLowerCase().trim())}`;
}

export async function readPublicCache<T>(namespace: string, identifier: string, freshForMs: number): Promise<PublicCacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key(namespace, identifier));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: T; cachedAt?: string };
    const age = Date.now() - new Date(parsed.cachedAt ?? '').getTime();
    if (parsed.data == null || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      await AsyncStorage.removeItem(key(namespace, identifier));
      return null;
    }
    return { data: parsed.data, cachedAt: parsed.cachedAt!, fresh: age <= freshForMs };
  } catch {
    return null;
  }
}

export async function writePublicCache<T>(namespace: string, identifier: string, data: T): Promise<string | null> {
  try {
    const cachedAt = new Date().toISOString();
    await AsyncStorage.setItem(key(namespace, identifier), JSON.stringify({ cachedAt, data }));
    return cachedAt;
  } catch {
    return null;
  }
}
