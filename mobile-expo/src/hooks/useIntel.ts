/**
 * useIntel hook
 * Health intelligence and advisory data (v2)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useUser } from './useUser';
import { useLocationContext } from './LocationContext';
import { invokeEdgeFunction } from '../services/edge';
import { AQIInsight } from '../components/AQICard';
import { DiseaseRisk } from '../components/RiskCard';

// v2 Response Types
export interface IntelV2 {
  generatedAt: string;
  version: 'v2';
  location: {
    state: string;
    stateNormalized: string;
    isKnownState: boolean;
    coordinates: { lat: number; lon: number };
    preciseLocation?: boolean;  // true if using user's GPS
    region: 'north' | 'south' | 'middle-belt' | null;
  };
  season: {
    label: 'harmattan' | 'dry' | 'rainy' | 'unknown';
    description: string;
    confidence: number;
  } | null;
  weather: {
    current: {
      temp: number;
      humidity: number;
      precipitation: number;
      windSpeed: number;
      weatherCode?: number;
    };
    forecast: {
      dates: string[];
      maxTemps: number[];
      minTemps: number[];
      precipitation: number[];
    } | null;
    source: string;
  } | null;
  airQuality: {
    aqi: number;
    insight: AQIInsight;
    pollutants: {
      pm2_5?: { value: number; status: string };
      pm10?: { value: number; status: string };
      o3?: number;
      no2?: number;
    };
    source: string;
  } | null;
  riskAssessment: {
    overallRiskLevel: 'low' | 'medium' | 'high';
    diseases: DiseaseRisk[];
    disclaimer: string;
  } | null;
  outbreaks: any[];
  whoAlerts: any[];
  meta: any;
}

interface UseIntelReturn {
  intel: IntelV2 | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export const useIntel = (): UseIntelReturn => {
  const { user } = useUser();
  const { location, geocoded } = useLocationContext();
  const [intel, setIntel] = useState<IntelV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntel = useCallback(async () => {
    // Use geocoded state or user profile state, fallback to 'Lagos'
    const state = geocoded?.state || user?.state || 'Lagos';
    
    // Get precise coordinates if available
    const lat = location?.latitude ?? null;
    const lon = location?.longitude ?? null;
    const hasPreciseCoords = lat !== null && lon !== null;

    try {
      setLoading(true);
      setError(null);

      // Build cache key - include coords if available for precision
      const cacheKey = hasPreciseCoords 
        ? `${state.toLowerCase().trim()}_${lat!.toFixed(2)}_${lon!.toFixed(2)}`
        : state.toLowerCase().trim();

      // Check cache first (using 'intel_cache' table)
      const { data: cached } = await supabase
        .from('intel_cache')
        .select('*')
        .eq('region_key', cacheKey)
        .eq('scope', 'v2')
        .maybeSingle();

      if (cached) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Date.now() < expiresAt && cached.payload) {
          setIntel(cached.payload as IntelV2);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data from Edge Function (v2) with coordinates
      const requestBody: { state: string; lat?: number; lon?: number } = { state };
      if (hasPreciseCoords) {
        requestBody.lat = lat!;
        requestBody.lon = lon!;
      }
      
      const { data, error: edgeError } = await invokeEdgeFunction<IntelV2>('intel', requestBody);
      
      if (edgeError) throw edgeError;
      if (!data) throw new Error('No data returned from intel service');

      setIntel(data);

      // We rely on the Edge Function to upsert the cache server-side.
      
    } catch (err) {
      console.error('Error fetching intel:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.state, geocoded?.state, location?.latitude, location?.longitude]);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  return {
    intel,
    loading,
    error,
    refresh: fetchIntel,
  };
};
