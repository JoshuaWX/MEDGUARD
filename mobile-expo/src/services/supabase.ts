/**
 * Supabase client configuration
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cddfhyxlhtmrrtduwlqd.supabase.co';
const SUPABASE_ANON_KEY = 'REDACTED_PUBLIC_JWT'; // Replace with actual key

const baseFetch: typeof fetch = global.fetch?.bind(global);

const debugFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url;
  try {
    return await baseFetch(input as never, init);
  } catch (error) {
    // Helps pinpoint exactly which URL is failing when React Native only shows
    // "TypeError: Network request failed".
    console.error('[network] fetch failed:', url);
    throw error;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: __DEV__ ? debugFetch : baseFetch,
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
