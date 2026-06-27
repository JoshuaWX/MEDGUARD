/**
 * useUser hook
 * User profile data and mutations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { invokeEdgeFunction } from '../services/edge';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  state: string | null;
  gender: string | null;
  age: number | null;
  avatarUrl: string | null;
  avatarPath: string | null;
  useLocation: boolean;
  healthScore: number | null;
  conditions: string[];
  allergies: string[];
  medications: string[];
  heightCm: number | null;
  weightKg: number | null;
  cycleTrackingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UseUserReturn {
  user: UserProfile | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateAvatar: (uri: string) => Promise<void>;
}

export const useUser = (): UseUserReturn => {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const attemptedBootstrapRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!authUser?.id) {
      setUser(null);
      setLoading(false);
      attemptedBootstrapRef.current = false;
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If the profile row doesn't exist yet, try a best-effort bootstrap once.
      if (!data && !attemptedBootstrapRef.current) {
        attemptedBootstrapRef.current = true;
        const meta: any = (authUser as any)?.user_metadata || {};
        const fullName =
          meta.full_name ||
          meta.name ||
          meta.fullName ||
          (authUser.email ? String(authUser.email).split('@')[0] : null);

        const toNumOrNull = (v: unknown) => {
          const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
          return Number.isFinite(n) ? n : null;
        };

        // Only include columns that exist in the profiles table
        const payload: Record<string, unknown> = {
          id: authUser.id,
          email: authUser.email ?? null,
          name: fullName ?? null,
          full_name: fullName ?? null,
        };
        
        // Add optional fields only if they have values
        if (meta.state) payload.state = meta.state;
        if (meta.gender) payload.gender = meta.gender;
        
        const ageVal = toNumOrNull(meta.age);
        if (ageVal !== null) payload.age = ageVal;
        
        const latVal = toNumOrNull(meta.latitude);
        if (latVal !== null) payload.latitude = latVal;
        
        const lonVal = toNumOrNull(meta.longitude);
        if (lonVal !== null) payload.longitude = lonVal;

        try {
          const { error: upsertErr } = await supabase.from('profiles').upsert([payload] as any, { onConflict: 'id' });
          if (upsertErr) {
            console.error('useUser bootstrap upsert failed:', upsertErr.message, upsertErr.details, upsertErr.hint);
          }
          const retry = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
          data = retry.data as any;
          fetchError = retry.error as any;
          if (fetchError) throw fetchError;
        } catch (e) {
          console.error('useUser bootstrap exception:', e);
          // If RLS blocks this, we'll continue with a minimal local profile.
        }
      }

      if (data) {
        let resolvedAvatarUrl: string | null = data.avatar_url;

        // Web parity: avatars bucket is private; prefer signed URLs derived from avatar_path.
        if (data.avatar_path) {
          try {
            const { data: signed, error: signedErr } = await invokeEdgeFunction<{ url: string | null }>(
              'avatar-sign',
              { path: data.avatar_path, expiresIn: 3600 }
            );
            if (!signedErr && signed?.url) {
              resolvedAvatarUrl = signed.url;
            }
          } catch {
            // Fall back to stored avatar_url when signing fails.
          }
        }

        setUser({
          id: data.id,
          name: data.name ?? data.full_name ?? null,
          email: data.email ?? authUser.email ?? null,
          state: data.state,
          gender: data.gender ?? null,
          age: typeof data.age === 'number' ? data.age : null,
          avatarUrl: resolvedAvatarUrl,
          avatarPath: data.avatar_path,
          useLocation: data.use_location ?? false,
          healthScore: data.health_score,
          conditions: Array.isArray(data.conditions) ? data.conditions : [],
          allergies: Array.isArray(data.allergies) ? data.allergies : [],
          medications: Array.isArray(data.medications) ? data.medications : [],
          heightCm: typeof data.height_cm === 'number' ? data.height_cm : (data.height_cm ? Number(data.height_cm) : null),
          weightKg: typeof data.weight_kg === 'number' ? data.weight_kg : (data.weight_kg ? Number(data.weight_kg) : null),
          cycleTrackingEnabled: Boolean(data.cycle_tracking_enabled),
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } else {
        // Fall back to a minimal profile so the app can render while DB catches up.
        const meta: any = (authUser as any)?.user_metadata || {};
        const toNum = (v: unknown) => {
          const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
          return Number.isFinite(n) ? n : null;
        };
        setUser({
          id: authUser.id,
          name: meta.full_name || meta.name || null,
          email: authUser.email ?? null,
          state: meta.state ?? null,
          gender: meta.gender ?? null,
          age: toNum(meta.age),
          avatarUrl: null,
          avatarPath: null,
          useLocation: Boolean(meta.use_location ?? meta.useLocation ?? false),
          healthScore: null,
          conditions: [],
          allergies: [],
          medications: [],
          heightCm: null,
          weightKg: null,
          cycleTrackingEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, authUser?.email]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!authUser?.id) return;

    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) {
        updateData.name = data.name;
        updateData.full_name = data.name;
      }
      if (data.state !== undefined) updateData.state = data.state;
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.age !== undefined) updateData.age = data.age;
      if (data.useLocation !== undefined) updateData.use_location = data.useLocation;
      if (data.healthScore !== undefined) updateData.health_score = data.healthScore;
      if (data.conditions !== undefined) updateData.conditions = data.conditions;
      if (data.allergies !== undefined) updateData.allergies = data.allergies;
      if (data.medications !== undefined) updateData.medications = data.medications;
      if (data.heightCm !== undefined) updateData.height_cm = data.heightCm;
      if (data.weightKg !== undefined) updateData.weight_kg = data.weightKg;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', authUser.id);

      if (updateError) throw updateError;

      await fetchProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, fetchProfile]);

  const updateAvatar = useCallback(async (uri: string) => {
    if (!authUser?.id) return;

    try {
      setLoading(true);

      // Read file as base64 (React Native compatible)
      // NOTE: Using the literal 'base64' avoids issues where FileSystem.EncodingType is undefined in some builds.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      } as any);

      // Convert base64 to a true ArrayBuffer for Supabase upload
      const bytes = Buffer.from(base64, 'base64');
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

      // Generate unique filename
      const fileName = `${Date.now()}.jpg`;
      const objectPath = `${authUser.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(objectPath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          avatar_path: uploadData.path,
        })
        .eq('id', authUser.id);

      if (updateError) throw updateError;

      await fetchProfile();
    } catch (err) {
      console.error('Error updating avatar:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, fetchProfile]);

  return {
    user,
    loading,
    error,
    refresh: fetchProfile,
    updateProfile,
    updateAvatar,
  };
};
