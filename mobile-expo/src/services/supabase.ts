/**
 * Supabase client configuration
 * 
 * SECURITY: Do NOT hardcode secrets. Configure credentials via environment variables.
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Read from Expo public environment variables (configured in app.json or .env)
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase credentials not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
