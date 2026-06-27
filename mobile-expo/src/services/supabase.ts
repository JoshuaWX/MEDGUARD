/**
 * Supabase client configuration
 * 
 * SECURITY: Do NOT hardcode secrets. Configure credentials via environment variables.
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.
 */

import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { authStorage } from './authStorage';

// Read from Expo public environment variables (configured in app.json or .env)
const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY =
  Constants.expoConfig?.extra?.supabasePublishableKey ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const isValidUrl = (value: string) => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isSupabaseConfigured =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_KEY) && isValidUrl(SUPABASE_URL);

export const supabaseConfigured = isSupabaseConfigured;

const createUnconfiguredSupabase = () => {
  const makeError = () =>
    new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (e.g. in mobile-expo/.env), then restart Metro with --clear.'
    );

  const subscription = { unsubscribe: () => {} };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: makeError() }),
      getClaims: async () => ({ data: { claims: null }, error: makeError() }),
      getUser: async () => ({ data: { user: null }, error: makeError() }),
      onAuthStateChange: () => ({ data: { subscription } }),
      signInWithPassword: async () => ({ data: null, error: makeError() }),
      signUp: async () => ({ data: null, error: makeError() }),
      signInWithOAuth: async () => ({ data: null, error: makeError() }),
      signOut: async () => ({ error: makeError() }),
      resetPasswordForEmail: async () => ({ error: makeError() }),
      exchangeCodeForSession: async () => ({ data: null, error: makeError() }),
      verifyOtp: async () => ({ data: null, error: makeError() }),
      setSession: async () => ({ data: null, error: makeError() }),
      updateUser: async () => ({ data: null, error: makeError() }),
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: null, error: makeError() }),
        insert: async () => ({ data: null, error: makeError() }),
        upsert: async () => ({ data: null, error: makeError() }),
      };
      return chain;
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: makeError() }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    functions: {
      invoke: async () => ({ data: null, error: makeError() }),
    },
  };
};

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase credentials not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile-expo/.env (or app config), then restart the dev server.'
  );
}

const createConfiguredSupabase = () =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
      },
    });

type ConfiguredSupabaseClient = ReturnType<typeof createConfiguredSupabase>;
const globalWithSupabase = globalThis as typeof globalThis & {
  __medguardSupabase?: ConfiguredSupabaseClient;
};

// Expo Fast Refresh can re-evaluate this module without disposing the previous
// GoTrue client. Reuse one client so refresh timers never compete for the same
// persisted session lock.
export const supabase = isSupabaseConfigured
  ? (globalWithSupabase.__medguardSupabase ??=
      createConfiguredSupabase())
  : (createUnconfiguredSupabase() as any);

// ============================================================================
// Cached access token
// ----------------------------------------------------------------------------
// Reading the access token via supabase.auth.getSession() acquires the GoTrue
// processLock. Doing that on every edge-function call (and on every screen that
// fires several calls at once) floods the lock and produces repeated
// "Lock acquisition timed out" warnings; worse, a timed-out getSession() yields
// no token, so authenticated requests silently downgrade to guest.
//
// Instead we keep the current token in memory, updated once by a single auth
// listener, and read it synchronously. A one-time getSession() fallback covers
// the brief window before the first auth event fires on cold start.
// ============================================================================
let cachedAccessToken: string | null = null;

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event: unknown, session: { access_token?: string } | null) => {
    cachedAccessToken = session?.access_token ?? null;
  });
}

/** Synchronously read the last-known access token (no lock). May be null. */
export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

/** Update the cached token after a one-time getSession() fallback. */
export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          state: string | null;
          avatar_url: string | null;
          avatar_path: string | null;
          use_location: boolean;
          health_score: number | null;
          conditions: string[] | null;
          allergies: string[] | null;
          medications: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email?: string | null;
          state?: string | null;
          avatar_url?: string | null;
          avatar_path?: string | null;
          use_location?: boolean;
          health_score?: number | null;
        };
        Update: {
          name?: string | null;
          email?: string | null;
          state?: string | null;
          avatar_url?: string | null;
          avatar_path?: string | null;
          use_location?: boolean;
          health_score?: number | null;
          conditions?: string[] | null;
          allergies?: string[] | null;
          medications?: string[] | null;
        };
      };
      symptom_logs: {
        Row: {
          id: string;
          user_id: string;
          symptoms: string[];
          logged_at: string;
        };
        Insert: {
          user_id: string;
          symptoms: string[];
        };
        Update: {
          symptoms?: string[];
        };
      };
      intel_cache: {
        Row: {
          id: string;
          state: string;
          data: object;
          fetched_at: string;
        };
      };
    };
  };
};
