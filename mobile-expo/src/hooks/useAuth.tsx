/**
 * Mobile auth state, recovery, and OAuth flows backed by Supabase Auth.
 * Profile provisioning stays outside auth callbacks to avoid auth-lock races.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../services/supabase';
import { cancelDailyReminder, getExistingPushToken, unregisterPushToken } from '../services/notifications';
import { AuthChangeEvent, Session, User, AuthError } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  /** True when user is browsing without authentication (guest mode) */
  isGuest: boolean;
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
type AuthOutcome = 'authenticated' | 'confirmation_required' | 'cancelled' | 'failed';
type SessionValidation = 'verified' | 'temporarily_unverified' | 'invalid';
type AuthRedirectResult = { session: Session | null; error: AuthError | null };

type SignInResult = {
  outcome: AuthOutcome;
  data: any | null;
  error: (AuthError & { code?: string }) | null;
  nextRoute?: NextRoute;
};

type SignUpResult = {
  outcome: AuthOutcome;
  data: any | null;
  error: (AuthError & { code?: string; hint?: string }) | null;
  nextRoute?: NextRoute;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (signUpData: SignUpData) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  completeOnboarding: () => Promise<void>;
  /** Enter guest mode (no authentication) */
  continueAsGuest: () => Promise<void>;
  /** True when a recovery deep link has been verified and user must set a new password */
  pendingRecovery: boolean;
  /** Set a new password after recovery verification */
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  /** Clear the pendingRecovery flag (e.g. on dismiss) */
  clearRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SIGN_IN_REDIRECT = 'medguard://signin';
const RECOVERY_REDIRECT = 'medguard://auth/callback?type=recovery';
const GOOGLE_REDIRECT = 'medguard://google-auth';

const STAGED_KEYS = {
  email: 'mg_signup_email',
  fullName: 'mg_full_name',
  firstName: 'mg_first_name',
  state: 'mg_location',
  gender: 'mg_gender',
  age: 'mg_age',
  latitude: 'mg_latitude',
  longitude: 'mg_longitude',
} as const;

async function stageOnboardingData(input: {
  email: string;
  fullName: string;
  state: string;
  gender?: string;
  age?: number;
  latitude?: number;
  longitude?: number;
}) {
  const first = input.fullName.split(/\s+/)[0] || input.fullName;
  await Promise.all([
    AsyncStorage.setItem(STAGED_KEYS.email, input.email.trim().toLowerCase()),
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
  const [email, fullName, state, gender, ageRaw, latRaw, lonRaw] = await Promise.all([
    AsyncStorage.getItem(STAGED_KEYS.email),
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
    email: email?.trim().toLowerCase() || null,
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

function authError(message: string, code: string): AuthError & { code?: string } {
  const error = new Error(message) as AuthError & { code?: string };
  error.code = code;
  return error;
}

function isTransientAuthError(error: unknown): boolean {
  const candidate = error as { message?: string; code?: string; status?: number } | null;
  const message = String(candidate?.message || '').toLowerCase();
  const code = String(candidate?.code || '').toLowerCase();
  const status = Number(candidate?.status || 0);

  return (
    status === 0 ||
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    code.includes('network') ||
    code.includes('timeout') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

async function validateSession(session: Session): Promise<SessionValidation> {
  const { data, error } = await supabase.auth.getClaims(session.access_token);
  const subject = data?.claims?.sub;

  if (subject) return subject === session.user.id ? 'verified' : 'invalid';
  if (error && isTransientAuthError(error)) return 'temporarily_unverified';
  return 'invalid';
}

const INITIAL_SESSION_RETRY_DELAYS_MS = [0, 400] as const;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function getInitialSessionWithRetry(): Promise<Session | null> {
  let lastError: AuthError | null = null;

  for (const delayMs of INITIAL_SESSION_RETRY_DELAYS_MS) {
    if (delayMs > 0) await wait(delayMs);

    const { data, error } = await supabase.auth.getSession();
    if (!error) return data.session;

    lastError = error;
    if (!isTransientAuthError(error)) throw error;
  }

  throw lastError ?? authError('Authentication is temporarily unavailable.', 'auth_unavailable');
}

function firstParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function parseHashParams(url: string): Record<string, string> {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  if (!hash) return {};

  return hash.split('&').reduce<Record<string, string>>((result, pair) => {
    const [rawKey, ...rawValue] = pair.split('=');
    if (rawKey) result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('='));
    return result;
  }, {});
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
  const stagedData = await readStagedOnboardingData();
  const userEmail = user.email?.trim().toLowerCase() || null;
  const stagedMatchesUser = Boolean(stagedData.email && userEmail === stagedData.email);
  const staged = stagedMatchesUser
    ? stagedData
    : { fullName: null, state: null, gender: null, age: null, latitude: null, longitude: null };
  if (stagedData.email && !stagedMatchesUser) await clearStagedOnboardingData();
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
  if (stateVal) { payload.state = stateVal; payload.manual_state = stateVal; }
  payload.use_location = Boolean(meta.use_location ?? meta.useLocation ?? true);
  
  const genderVal = staged.gender || meta.gender;
  if (genderVal) payload.gender = genderVal;
  
  const ageVal = staged.age ?? (typeof meta.age === 'number' ? meta.age : (typeof meta.age === 'string' ? Number(meta.age) : null));
  if (typeof ageVal === 'number' && Number.isFinite(ageVal)) payload.age = ageVal;
  
  const latVal = staged.latitude ?? (typeof meta.latitude === 'number' ? meta.latitude : null);
  if (Boolean(payload.use_location) && typeof latVal === 'number' && Number.isFinite(latVal)) payload.latitude = latVal;
  
  const lonVal = staged.longitude ?? (typeof meta.longitude === 'number' ? meta.longitude : null);
  if (Boolean(payload.use_location) && typeof lonVal === 'number' && Number.isFinite(lonVal)) payload.longitude = lonVal;

  // 3) Upsert (RLS-safe when signed in)
  try {
    const { error } = await supabase.from('profiles').upsert([payload] as any, { onConflict: 'id' });
    if (error) {
      console.error('ensureProfileExists upsert failed:', error.message, error.details, error.hint);
    } else if (stagedMatchesUser) {
      await clearStagedOnboardingData();
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
    isGuest: false,
  });
  const [pendingRecovery, setPendingRecovery] = useState(false);
  const redirectTasks = React.useRef(
    new Map<string, Promise<AuthRedirectResult>>()
  );

  const consumeAuthRedirect = useCallback((url: string): Promise<AuthRedirectResult> => {
    if (!url) return Promise.resolve({ session: null, error: null });
    const existing = redirectTasks.current.get(url);
    if (existing) return existing;

    if (redirectTasks.current.size >= 20) {
      const oldest = redirectTasks.current.keys().next().value;
      if (oldest) redirectTasks.current.delete(oldest);
    }

    const task = (async () => {
      try {
        const parsed = Linking.parse(url);
        const hashParams = parseHashParams(url);
        const code = firstParam(parsed.queryParams?.code) || hashParams.code;
        const tokenHash = firstParam(parsed.queryParams?.token_hash);
        const type = firstParam(parsed.queryParams?.type) || hashParams.type;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (type === 'recovery') setPendingRecovery(true);
          return { session: data.session, error: null };
        }

        if (tokenHash && type) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) throw error;
          if (type === 'recovery') setPendingRecovery(true);
          return { session: data.session, error: null };
        }

        // Transitional support for confirmation links issued before PKCE was enabled.
        const accessToken = hashParams.access_token;
        const refreshToken = hashParams.refresh_token;
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (type === 'recovery') setPendingRecovery(true);
          return { session: data.session, error: null };
        }

        return { session: null, error: null };
      } catch (error) {
        return { session: null, error: normalizeAuthError(error as AuthError) };
      }
    })();

    // Linking and openAuthSessionAsync can deliver the same callback. Sharing
    // one promise prevents duplicate PKCE exchanges.
    redirectTasks.current.set(url, task);
    return task;
  }, []);

  useEffect(() => {
    let active = true;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let linkSubscription: { remove: () => void } | null = null;
    let appStateSubscription: { remove: () => void } | null = null;
    let refreshState: 'active' | 'inactive' | null = null;
    let refreshTask = Promise.resolve();

    const commitSession = (session: Session | null, isGuest = false) => {
      if (!active) return;
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
        isGuest: !session && isGuest,
      });
    };

    const syncAutoRefresh = (nextState: AppStateStatus) => {
      if (Platform.OS === 'web' || !active) return;
      const nextRefreshState = nextState === 'active' ? 'active' : 'inactive';
      if (refreshState === nextRefreshState) return;
      refreshState = nextRefreshState;

      refreshTask = refreshTask
        .catch(() => undefined)
        .then(async () => {
          if (!active) return;
          if (nextRefreshState === 'active') {
            await supabase.auth.startAutoRefresh();
          } else {
            await supabase.auth.stopAutoRefresh();
          }
        })
        .catch((error) => {
          console.warn('Unable to update auth refresh lifecycle:', error);
        });
    };

    const handleAuthEvent = (event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      if (event === 'SIGNED_IN' && session?.user) {
        void AsyncStorage.removeItem('mg_guest_mode');
      }
      if (event === 'PASSWORD_RECOVERY') {
        setPendingRecovery(true);
      }

      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
        isGuest: session?.user ? false : prev.isGuest,
      }));

      if (event === 'INITIAL_SESSION' && Platform.OS !== 'web') {
        syncAutoRefresh(AppState.currentState);
      }
    };

    const handleRedirect = async (url: string, label: string) => {
      const { session, error } = await consumeAuthRedirect(url);
      if (error) {
        console.warn(`${label} auth redirect failed:`, error.message);
        return;
      }
      if (session) commitSession(session);
    };

    const initializeAuth = async () => {
      const guestFlag = await AsyncStorage.getItem('mg_guest_mode').catch(() => null);
      const isGuest = guestFlag === '1';

      try {
        let verifiedSession = await getInitialSessionWithRetry();
        if (verifiedSession) {
          const validation = await validateSession(verifiedSession);
          if (validation === 'invalid') {
            await supabase.auth.signOut({ scope: 'local' });
            verifiedSession = null;
          } else if (validation === 'temporarily_unverified') {
            console.warn('Session verification deferred until connectivity returns.');
          }
        }
        commitSession(verifiedSession, isGuest);
      } catch (error) {
        const message = isTransientAuthError(error)
          ? 'Authentication initialization was delayed; the saved session was left intact.'
          : 'Authentication initialization failed; the saved session was left intact.';
        console.warn(message, error);
        commitSession(null, isGuest);
      }

      if (!active) return;

      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl && active) await handleRedirect(initialUrl, 'Initial');
      if (!active) return;

      authSubscription = supabase.auth.onAuthStateChange(handleAuthEvent).data.subscription;
      linkSubscription = Linking.addEventListener('url', ({ url }) => {
        void handleRedirect(url, 'Incoming');
      });

      if (Platform.OS !== 'web') {
        appStateSubscription = AppState.addEventListener('change', syncAutoRefresh);
      }
    };

    void initializeAuth();

    return () => {
      active = false;
      authSubscription?.unsubscribe();
      linkSubscription?.remove();
      appStateSubscription?.remove();
      if (Platform.OS !== 'web') void supabase.auth.stopAutoRefresh();
    };
  }, [consumeAuthRedirect]);

  useEffect(() => {
    if (state.user) void ensureProfileExists(state.user);
  }, [state.user?.id]);

  const beginFreshAuthAttempt = useCallback(async () => {
    const previousUserId = state.user?.id;
    if (previousUserId) {
      const token = await getExistingPushToken().catch(() => null);
      if (token) await unregisterPushToken(token).catch(() => undefined);
      await cancelDailyReminder(previousUserId).catch(() => undefined);
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await AsyncStorage.removeItem('mg_guest_mode');
    setState((prev) => ({
      ...prev,
      session: null,
      user: null,
      isGuest: false,
      loading: true,
    }));
  }, [state.user?.id]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    try {
      await beginFreshAuthAttempt();
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      const session = data?.session ?? null;
      const sessionUser = session?.user ?? null;
      if (!session || !sessionUser) {
        throw authError('No authenticated session was returned.', 'session_missing');
      }
      if (sessionUser.email?.toLowerCase() !== normalizedEmail) {
        await supabase.auth.signOut({ scope: 'local' });
        throw authError('The authenticated account did not match the requested account.', 'session_mismatch');
      }

      const validation = await validateSession(session);
      if (validation === 'invalid') {
        await supabase.auth.signOut({ scope: 'local' });
        throw authError('The authenticated session could not be verified.', 'session_invalid');
      }

      const profileComplete = sessionUser.user_metadata?.profile_complete === true;
      setState((prev) => ({
        ...prev,
        session,
        user: sessionUser,
        isGuest: false,
      }));

      return {
        outcome: 'authenticated',
        data,
        error: null,
        nextRoute: profileComplete ? 'MainTabs' : 'SignUp2',
      };
    } catch (error) {
      const authError = normalizeAuthError(error as AuthError);
      return { outcome: 'failed', data: null, error: authError };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [beginFreshAuthAttempt]);

  const signUp = useCallback(async (signUpData: SignUpData): Promise<SignUpResult> => {
    try {
      await beginFreshAuthAttempt();
      const normalizedEmail = signUpData.email.trim().toLowerCase();
      await stageOnboardingData({
        email: normalizedEmail,
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
        latitude: signUpData.useLocation && typeof signUpData.latitude === 'number' ? signUpData.latitude : null,
        longitude: signUpData.useLocation && typeof signUpData.longitude === 'number' ? signUpData.longitude : null,
      };

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: signUpData.password,
        options: { data: meta, emailRedirectTo: SIGN_IN_REDIRECT },
      });

      if (error) throw error;

      const createdUser = (data as any)?.user || null;
      const hasSession = Boolean((data as any)?.session);

      if (!hasSession) {
        return {
          outcome: 'confirmation_required',
          data,
          error: null,
          needsEmailConfirmation: true,
        };
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
          manual_state: signUpData.state,
          use_location: signUpData.useLocation,
        };
        
        // Add optional fields only if they have values
        if (signUpData.gender) profilePayload.gender = signUpData.gender;
        if (typeof signUpData.age === 'number') profilePayload.age = signUpData.age;
        if (signUpData.useLocation && typeof signUpData.latitude === 'number') profilePayload.latitude = signUpData.latitude;
        if (signUpData.useLocation && typeof signUpData.longitude === 'number') profilePayload.longitude = signUpData.longitude;

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert([profilePayload] as any, { onConflict: 'id' });
        
        if (upsertError) {
          console.error('Profile upsert failed:', upsertError.message, upsertError.details, upsertError.hint);
          // Don't throw - allow signup to continue, profile will be created on next login
        }
      }

      return { outcome: 'authenticated', data, error: null, nextRoute: 'SignUp2' };
    } catch (error) {
      const authError = normalizeAuthError(error as AuthError);
      return { outcome: 'failed', data: null, error: authError };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [beginFreshAuthAttempt]);

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    try {
      await beginFreshAuthAttempt();
      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: GOOGLE_REDIRECT,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (oauthError) throw oauthError;
      if (!oauthData?.url) throw authError('Google did not return a sign-in URL.', 'oauth_url_missing');

      const browserResult = await WebBrowser.openAuthSessionAsync(oauthData.url, GOOGLE_REDIRECT, {
        showInRecents: true,
      });
      if (browserResult.type !== 'success') {
        return { outcome: 'cancelled', data: null, error: null };
      }

      const callback = await consumeAuthRedirect(browserResult.url);
      if (callback.error) throw callback.error;
      const session = callback.session;
      if (!session?.user) throw authError('Google sign-in did not create a session.', 'session_missing');

      const validation = await validateSession(session);
      if (validation === 'invalid') {
        await supabase.auth.signOut({ scope: 'local' });
        throw authError('The Google session could not be verified.', 'session_invalid');
      }

      const profileComplete = session.user.user_metadata?.profile_complete === true;
      setState((prev) => ({
        ...prev,
        session,
        user: session.user,
        isGuest: false,
      }));
      return {
        outcome: 'authenticated',
        data: { session, user: session.user },
        error: null,
        nextRoute: profileComplete ? 'MainTabs' : 'SignUp2',
      };
    } catch (error) {
      return { outcome: 'failed', data: null, error: normalizeAuthError(error as AuthError) };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [beginFreshAuthAttempt, consumeAuthRedirect]);

  const signOut = useCallback(async () => {
    try {
      const signingOutUserId = state.user?.id;
      // Remove only this account's MedGuard reminder and this device's remote
      // registration while the JWT is still valid. A later account can safely
      // register the same physical token for itself.
      if (signingOutUserId) {
        const token = await getExistingPushToken().catch(() => null);
        if (token) await unregisterPushToken(token).catch(() => undefined);
        await cancelDailyReminder(signingOutUserId).catch(() => undefined);
      }
      await clearStagedOnboardingData();
      // Clear guest mode flag on sign out
      await AsyncStorage.removeItem('mg_guest_mode');
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
        isGuest: false,
      }));
    } catch (e) {
      console.warn('signOut exception:', e);
      // Still clear local state on error
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        isGuest: false,
      }));
    }
  }, []);

  /**
   * Enter guest mode - allows browsing without authentication.
   * Guest users have limited access to features.
   */
  const continueAsGuest = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await AsyncStorage.setItem('mg_guest_mode', '1');
    setState((prev) => ({
      ...prev,
      isGuest: true,
      session: null,
      user: null,
    }));
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: RECOVERY_REDIRECT,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) throw signOutError;
      await clearStagedOnboardingData();
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        isGuest: false,
        loading: false,
      }));
      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  const clearRecovery = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setPendingRecovery(false);
    setState((prev) => ({
      ...prev,
      session: null,
      user: null,
      isGuest: false,
      loading: false,
    }));
  }, [state.user?.id]);

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
      continueAsGuest,
      pendingRecovery,
      updatePassword,
      clearRecovery,
    }),
    [state, signIn, signUp, signInWithGoogle, signOut, resetPassword, completeOnboarding, continueAsGuest, pendingRecovery, updatePassword, clearRecovery]
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
