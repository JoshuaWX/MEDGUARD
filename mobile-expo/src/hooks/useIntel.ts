/**
 * useIntel hook
 * Health intelligence and advisory data (v2)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from './useUser';
import { useAuth } from './useAuth';
import { useLocationContext } from './LocationContext';
import { invokeEdgeFunction } from '../services/edge';
import { AQIInsight } from '../components/AQICard';
import { DiseaseRisk } from '../components/RiskCard';
import { toUserMessage } from '../services/errorMessages';
import { BrainResult } from '../services/brain';

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
      co?: number;
    };
    source: string;
  } | null;
  riskAssessment: {
    overallRiskLevel: 'low' | 'medium' | 'high';
    diseases: DiseaseRisk[];
    disclaimer: string;
  } | null;
  /** Brain v1: additive area/community intelligence (read-only). */
  brain?: BrainResult | null;
  /** Brain v1: personal intelligence, present only when authenticated. */
  personalBrain?: BrainResult | null;
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
  const { user: authUser, initialized: authInitialized } = useAuth();
  const { user, loading: userLoading } = useUser();
  const { location, geocoded, loading: locationLoading } = useLocationContext();
  const requestIdRef = useRef(0);
  const [intel, setIntel] = useState<IntelV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntel = useCallback(async () => {
    if (!authInitialized || (authUser?.id && userLoading)) {
      setLoading(true);
      return;
    }

    const metaState = (authUser as any)?.user_metadata?.state as string | undefined;
    const requestId = ++requestIdRef.current;
    const state = geocoded?.state || user?.state || metaState || null;

    if (!state) {
      if (locationLoading) {
        setLoading(true);
        return;
      }
      setIntel(null);
      setError(null);
      setLoading(false);
      return;
    }
    
    // Get precise coordinates if available
    const lat = location?.latitude ?? null;
    const lon = location?.longitude ?? null;
    const hasPreciseCoords = lat !== null && lon !== null;

    try {
      setLoading(true);
      setError(null);

      // Fetch fresh data from Edge Function (v2) with coordinates
      const requestBody: { state: string; lat?: number; lon?: number } = { state };
      if (hasPreciseCoords) {
        requestBody.lat = lat!;
        requestBody.lon = lon!;
      }
      
      const { data, error: edgeError } = await invokeEdgeFunction<IntelV2>('intel', requestBody);
      
      if (edgeError) throw edgeError;
      if (!data) throw new Error('No data returned from intel service');
      if (requestId !== requestIdRef.current) return;

      setIntel(data);

      // We rely on the Edge Function to upsert the cache server-side.
      
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching intel:', err);
      setError(new Error(toUserMessage(err, 'general')));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authInitialized, authUser, user?.state, userLoading, geocoded?.state, location?.latitude, location?.longitude, locationLoading]);

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
