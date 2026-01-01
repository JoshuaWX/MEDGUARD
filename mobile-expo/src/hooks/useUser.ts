/**
 * useUser hook
 * User profile data and mutations
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  state: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
  useLocation: boolean;
  healthScore: number | null;
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

  const fetchProfile = useCallback(async () => {
    if (!authUser?.id) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email ?? authUser.email ?? null,
          state: data.state,
          avatarUrl: data.avatar_url,
          avatarPath: data.avatar_path,
          useLocation: data.use_location ?? false,
          healthScore: data.health_score,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
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
      if (data.name !== undefined) updateData.name = data.name;
      if (data.state !== undefined) updateData.state = data.state;
      if (data.useLocation !== undefined) updateData.use_location = data.useLocation;
      if (data.healthScore !== undefined) updateData.health_score = data.healthScore;

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

      // Upload image to Supabase Storage
      const fileName = `${authUser.id}-${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
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
