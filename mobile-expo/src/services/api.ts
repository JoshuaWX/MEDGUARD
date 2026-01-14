/**
 * API base helpers (web parity)
 *
 * Web uses relative `/api/...` calls. Mobile needs an absolute base URL.
 *
 * Configure with:
 * - EXPO_PUBLIC_API_BASE_URL (recommended)
 * - EXPO_PUBLIC_CHATBOT_URL (optional; defaults to API host port 8080)
 */

import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

function readExtra(key: string): string | null {
  const extra: any = (Constants.expoConfig as any)?.extra;
  const v = extra?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function defaultApiBaseUrl() {
  const inferredHost = inferDevServerHost();
  if (inferredHost) {
    if (inferredHost === 'localhost' || inferredHost.startsWith('127.')) {
      // Android emulator cannot reach host `localhost`.
      if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
      return 'http://localhost:3000';
    }
    return `http://${inferredHost}:3000`;
  }

  // Fallbacks when running without Metro/dev host info.
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

function inferDevServerHost(): string | null {
  // Try to infer the host running Metro (and usually the proxy server) so physical devices work.
  const candidates: unknown[] = [
    (Constants as any)?.expoConfig?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoClient?.debuggerHost,
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost,
    (NativeModules as any)?.SourceCode?.scriptURL,
  ];

  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;

    // Examples:
    // - "192.168.1.10:8081"
    // - "192.168.1.10:19000"
    // - "http://192.168.1.10:8081/index.bundle?platform=android"
    // - "localhost:8081"
    const raw = c.trim();
    try {
      if (/^https?:\/\//i.test(raw)) {
        const u = new URL(raw);
        if (u.hostname) return u.hostname;
      }

      const withoutPath = raw.split('/')[0];
      const host = withoutPath.split(':')[0];
      if (host) return host;
    } catch {
      // ignore
    }
  }

  return null;
}

export const API_BASE_URL =
  readExtra('apiBaseUrl') ||
  (process.env.EXPO_PUBLIC_API_BASE_URL ? String(process.env.EXPO_PUBLIC_API_BASE_URL) : null) ||
  defaultApiBaseUrl();

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(buildApiUrl(path), init);
}

function defaultChatbotUrl(): string {
  try {
    const u = new URL(API_BASE_URL);
    u.port = '8080';
    u.pathname = '/';
    u.search = '';
    return u.toString();
  } catch {
    return 'http://localhost:8080/';
  }
}

export function buildChatbotUrl(params: Record<string, string | null | undefined>) {
  const base =
    readExtra('chatbotUrl') ||
    (process.env.EXPO_PUBLIC_CHATBOT_URL ? String(process.env.EXPO_PUBLIC_CHATBOT_URL) : null) ||
    defaultChatbotUrl();

  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).trim().length > 0) {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}
