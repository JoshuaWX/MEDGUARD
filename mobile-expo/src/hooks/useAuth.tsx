/**
 * Auth (web-parity)
 *
 * The web app:
 * - Signs up with Supabase Auth and stores profile-like metadata in user_metadata
 * - Only creates/updates `profiles` when there is an authenticated session (RLS-safe)
 * - Routes first-login users to onboarding step 2 based on `user_metadata.profile_complete`
 * - Does NOT support Google sign-in yet (shows an inline message)
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { AuthChangeEvent, Session, User, AuthError } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

interface SignUpData {
  email: string;
  password: string;
  name: string;
  state: string;
  useLocation: boolean;
  gender?: string;
  age?: number;
  latitude?: number;
  longitude?: number;
}

type NextRoute = 'MainTabs' | 'SignUp2';

type SignInResult = {
  data: any | null;
  error: (AuthError & { code?: string }) | null;
  nextRoute?: NextRoute;
};

type SignUpResult = {
  data: any | null;
  error: (AuthError & { code?: string; hint?: string }) | null;
  nextRoute?: NextRoute;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (signUpData: SignUpData) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<{ data: null; error: AuthError & { code?: string } }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STAGED_KEYS = {
  fullName: 'mg_full_name',
  firstName: 'mg_first_name',
  state: 'mg_location',
  gender: 'mg_gender',
  age: 'mg_age',
  latitude: 'mg_latitude',
  longitude: 'mg_longitude',
} as const;

async function stageOnboardingData(input: {
  fullName: string;
  state: string;
  gender?: string;
  age?: number;
  latitude?: number;
  longitude?: number;
}) {
  const first = input.fullName.split(/\s+/)[0] || input.fullName;
  await Promise.all([
    AsyncStorage.setItem(STAGED_KEYS.fullName, input.fullName),
    AsyncStorage.setItem(STAGED_KEYS.firstName, first),
    AsyncStorage.setItem(STAGED_KEYS.state, input.state),
    input.gender != null ? AsyncStorage.setItem(STAGED_KEYS.gender, String(input.gender)) : AsyncStorage.removeItem(STAGED_KEYS.gender),
    input.age != null ? AsyncStorage.setItem(STAGED_KEYS.age, String(input.age)) : AsyncStorage.removeItem(STAGED_KEYS.age),
    input.latitude != null ? AsyncStorage.setItem(STAGED_KEYS.latitude, String(input.latitude)) : AsyncStorage.removeItem(STAGED_KEYS.latitude),
    input.longitude != null ? AsyncStorage.setItem(STAGED_KEYS.longitude, String(input.longitude)) : AsyncStorage.removeItem(STAGED_KEYS.longitude),
  ]);
}

async function readStagedOnboardingData() {
  const [fullName, state, gender, ageRaw, latRaw, lonRaw] = await Promise.all([
    AsyncStorage.getItem(STAGED_KEYS.fullName),
    AsyncStorage.getItem(STAGED_KEYS.state),
    AsyncStorage.getItem(STAGED_KEYS.gender),
    AsyncStorage.getItem(STAGED_KEYS.age),
    AsyncStorage.getItem(STAGED_KEYS.latitude),
    AsyncStorage.getItem(STAGED_KEYS.longitude),
  ]);

  const age = ageRaw != null ? Number(ageRaw) : null;
  const latitude = latRaw != null ? Number(latRaw) : null;
  const longitude = lonRaw != null ? Number(lonRaw) : null;

  return {
    fullName: fullName || null,
    state: state || null,
    gender: gender || null,
    age: Number.isFinite(age as number) ? (age as number) : null,
    latitude: Number.isFinite(latitude as number) ? (latitude as number) : null,
    longitude: Number.isFinite(longitude as number) ? (longitude as number) : null,
  };
}

async function clearStagedOnboardingData() {
  await Promise.all(Object.values(STAGED_KEYS).map((k) => AsyncStorage.removeItem(k)));
}

function normalizeAuthError(error: AuthError): AuthError & { code?: string; hint?: string } {
  const err: any = error;
  const msg = String(error?.message || '').toLowerCase();

  if (msg.includes('email not confirmed') || msg.includes('email not verified')) {
    err.code = 'email_not_confirmed';
  } else if (
    msg.includes('invalid login') ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    err.code = 'invalid_credentials';
  }

  return err;
}

async function ensureProfileExists(user: User) {
  if (!user?.id) return;

  // 1) Try read existing profile
  let existing: any = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    existing = data || null;
  } catch {
    existing = null;
  }

  if (existing?.id) return;

  // 2) Build payload from staged onboarding data + durable user_metadata
  const staged = await readStagedOnboardingData();
  const meta: any = (user as any)?.user_metadata || {};

  const fullName =
    staged.fullName ||
    meta.full_name ||
    meta.name ||
    (user.email ? String(user.email).split('@')[0] : '') ||
    '';

  // Only include columns that exist in the profiles table
  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email || null,
    full_name: fullName,
    name: fullName,
  };
  
  // Add optional fields only if they have values
  const stateVal = staged.state || meta.state;
  if (stateVal) payload.state = stateVal;
  
  const genderVal = staged.gender || meta.gender;
  if (genderVal) payload.gender = genderVal;
  
  const ageVal = staged.age ?? (typeof meta.age === 'number' ? meta.age : (typeof meta.age === 'string' ? Number(meta.age) : null));
  if (typeof ageVal === 'number' && Number.isFinite(ageVal)) payload.age = ageVal;
  
  const latVal = staged.latitude ?? (typeof meta.latitude === 'number' ? meta.latitude : null);
  if (typeof latVal === 'number' && Number.isFinite(latVal)) payload.latitude = latVal;
  
  const lonVal = staged.longitude ?? (typeof meta.longitude === 'number' ? meta.longitude : null);
  if (typeof lonVal === 'number' && Number.isFinite(lonVal)) payload.longitude = lonVal;

  // 3) Upsert (RLS-safe when signed in)
  try {
    const { error } = await supabase.from('profiles').upsert([payload] as any, { onConflict: 'id' });
    if (error) {
      console.error('ensureProfileExists upsert failed:', error.message, error.details, error.hint);
    }
  } catch (e) {
    console.error('ensureProfileExists exception:', e);
  }
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        });
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState((prev) => ({ ...prev, loading: false, initialized: true }));
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
      }));

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await ensureProfileExists(session.user);
        } catch (e) {
          console.warn('ensureProfileExists failed:', e);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const sessionUser = data?.session?.user || null;
      if (sessionUser) {
        // Ensure a profile exists (matches web sign-in handler behavior)
        let createdProfileNow = false;
        try {
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', sessionUser.id)
            .maybeSingle();
          if (!existing) {
            await ensureProfileExists(sessionUser);
            createdProfileNow = true;
          }
        } catch {
          // Best-effort; routing still continues
        }

        const profileComplete = Boolean((sessionUser as any)?.user_metadata?.profile_complete === true);
        const isFirstLogin = createdProfileNow || !profileComplete;

        return { data, error: null, nextRoute: isFirstLogin ? 'SignUp2' : 'MainTabs' };
      }

      return { data, error: null, nextRoute: 'MainTabs' };
    } catch (error) {
      const authError = normalizeAuthError(error as AuthError);
      return { data: null, error: authError };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signUp = useCallback(async (signUpData: SignUpData): Promise<SignUpResult> => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      // Stage onboarding data locally so first sign-in can bootstrap a profile if email confirmation is required.
      await stageOnboardingData({
        fullName: signUpData.name,
        state: signUpData.state,
        gender: signUpData.gender,
        age: signUpData.age,
        latitude: signUpData.latitude,
        longitude: signUpData.longitude,
      });

      const meta: Record<string, any> = {
        full_name: signUpData.name,
        state: signUpData.state,
        use_location: signUpData.useLocation,
        gender: signUpData.gender ?? null,
        age: typeof signUpData.age === 'number' ? signUpData.age : null,
        latitude: typeof signUpData.latitude === 'number' ? signUpData.latitude : null,
        longitude: typeof signUpData.longitude === 'number' ? signUpData.longitude : null,
      };

      const { data, error } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: { data: meta },
      });

      if (error) throw error;

      const createdUser = (data as any)?.user || null;
      const hasSession = Boolean((data as any)?.session);
      const identities = createdUser?.identities;

      // Match web: treat identities=[] as "already exists"
      if (Array.isArray(identities) && identities.length === 0) {
        const err: any = new Error('User already exists. Please sign in instead.');
        err.code = 'user_already_exists';
        throw err;
      }

      // If email confirmation is enabled, Supabase may return a user without session.
      // Match web behavior: do not attempt profile upsert (RLS) and instruct user to verify.
      if (!hasSession) {
        const err: any = new Error('Email not confirmed');
        err.code = 'email_not_confirmed';
        err.hint = 'Account created. Please check your email and confirm your account before signing in.';
        return { data, error: err, needsEmailConfirmation: true };
      }

      // With an active session, safely upsert profile.
      if (createdUser?.id) {
        // Only include columns that definitely exist in the profiles table
        // Based on web app schema: full_name, name, email, gender, age, state, lga, latitude, longitude
        const profilePayload: Record<string, unknown> = {
          id: createdUser.id,
          email: signUpData.email,
          full_name: signUpData.name,
          name: signUpData.name,
          state: signUpData.state,
        };
        
        // Add optional fields only if they have values
        if (signUpData.gender) profilePayload.gender = signUpData.gender;
        if (typeof signUpData.age === 'number') profilePayload.age = signUpData.age;
        if (typeof signUpData.latitude === 'number') profilePayload.latitude = signUpData.latitude;
        if (typeof signUpData.longitude === 'number') profilePayload.longitude = signUpData.longitude;

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert([profilePayload] as any, { onConflict: 'id' });
        
        if (upsertError) {
          console.error('Profile upsert failed:', upsertError.message, upsertError.details, upsertError.hint);
          // Don't throw - allow signup to continue, profile will be created on next login
        }
      }

      return { data, error: null, nextRoute: 'SignUp2' };
    } catch (error) {
      const authError = normalizeAuthError(error as AuthError);
      return { data: null, error: authError };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Web parity: button exists but is not available yet.
    Alert.alert(
      'Google sign-in not available',
      'Google sign-in is not available yet. Please use your email and password.'
    );
    const err: any = new Error('Google sign-in is not available yet.');
    err.code = 'oauth_not_available';
    return { data: null, error: err };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await clearStagedOnboardingData();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase signOut error:', error.message);
        // Don't throw - signOut should still clear local state even if backend fails
      }
      // Clear local state regardless
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
      }));
    } catch (e) {
      console.warn('signOut exception:', e);
      // Still clear local state on error
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
      }));
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    const { error } = await supabase.auth.updateUser({ data: { profile_complete: true } });
    if (error) throw error;
    // Web also stores a client-side flag; we keep staging data but mark completion.
    await AsyncStorage.setItem('mg_onboarding_complete', '1');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      completeOnboarding,
    }),
    [state, signIn, signUp, signInWithGoogle, signOut, resetPassword, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>.');
  }
  return ctx;
};
