/**
 * useAuth hook
 * Authentication state and methods
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

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
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    // Get initial session
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
        setState(prev => ({ ...prev, loading: false, initialized: true }));
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
        }));

        if (event === 'SIGNED_IN' && session?.user) {
          // Create profile if it doesn't exist
          await ensureProfile(session.user.id, session.user.email);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const ensureProfile = async (userId: string, email?: string) => {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existing) {
        await supabase.from('profiles').insert({
          id: userId,
          email: email ?? null,
        });
      }
    } catch (error) {
      console.error('Error ensuring profile:', error);
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      return { data: null, error: authError };
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const signUp = useCallback(async (signUpData: SignUpData) => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          data: {
            name: signUpData.name,
            state: signUpData.state,
            use_location: signUpData.useLocation,
            gender: signUpData.gender,
            age: signUpData.age,
          },
        },
      });

      if (error) throw error;

      // Create profile
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: signUpData.email,
          name: signUpData.name,
          state: signUpData.state,
          use_location: signUpData.useLocation,
        });
      }

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      return { data: null, error: authError };
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      // Note: In React Native, you'll need to handle the OAuth flow
      // using expo-auth-session or react-native-app-auth
      // This is a placeholder for the actual implementation

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      return { data: null, error: authError };
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
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

  return {
    ...state,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
};
