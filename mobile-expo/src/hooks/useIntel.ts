/**
 * useIntel hook
 * Health intelligence and advisory data (v2)
 */

import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useAuth } from './useAuth';
import { useLocationContext } from './LocationContext';
import { invokeEdgeFunction } from '../services/edge';
import { AQIInsight } from '../components/AQICard';
import { DiseaseRisk } from '../components/RiskCard';
import { toUserMessage } from '../services/errorMessages';
import { BrainResult } from '../services/brain';
import { readPublicCache, writePublicCache } from '../services/publicCache';

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
  areaOutlook: Array<{
    id: string;
    kind: 'forecast' | 'verified_report';
    disease: string | null;
    level: 'low' | 'moderate' | 'elevated' | 'high' | 'verified';
    headline: string;
    summary: string;
    source: string;
    confidence: number | null;
    forecastType: string | null;
    generatedAt: string;
    validUntil: string | null;
  }>;
  /** Brain v1: additive area/community intelligence (read-only). */
  brain?: BrainResult | null;
  /** Brain v1: personal intelligence, present only when authenticated. */
  personalBrain?: BrainResult | null;
  outbreaks: any[];
  whoAlerts: any[];
  /** Attributed data sources actually used to build this response. */
  sources?: Array<{ name: string; url: string; category?: string }>;
  meta: any;
}

interface UseIntelReturn {
  intel: IntelV2 | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const CACHE_DURATION_MS = 15 * 60 * 1000;

const IntelContext = createContext<UseIntelReturn | null>(null);

export const IntelProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { initialized: authInitialized, sessionTrust } = useAuth();
  const { alertArea, loading: locationLoading } = useLocationContext();
  const requestIdRef = useRef(0);
  const [intel, setIntel] = useState<IntelV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntel = useCallback(async (force = false) => {
    if (!authInitialized) {
      setLoading(true);
      return;
    }

    const requestId = ++requestIdRef.current;
    const state = alertArea?.state ?? null;

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

    const cached = await readPublicCache<IntelV2>('intel', state, CACHE_DURATION_MS);
    if (requestId !== requestIdRef.current) return;
    if (cached) {
      // Personal Brain is deliberately excluded from persistent public cache.
      setIntel({ ...cached.data, personalBrain: null });
      setLoading(false);
      if (cached.fresh && !force) return;
    }
    if (sessionTrust !== 'verified') {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      // The canonical area alone powers intelligence. Raw device coordinates
      // remain exclusively for nearby-map searches until server verification.
      const requestBody = { state };
      
      const { data, error: edgeError } = await invokeEdgeFunction<IntelV2>('intel', requestBody);
      
      if (edgeError) throw edgeError;
      if (!data) throw new Error('No data returned from intel service');
      if (requestId !== requestIdRef.current) return;

      // Refuse an unexpected state payload so a stale server/cache response can
      // never appear under the user's newly verified alert area.
      if (data.location?.state && data.location.state !== state) {
        throw new Error('Intel response did not match the current alert area');
      }
      setIntel(data);
      const { personalBrain: _personalBrain, ...publicIntel } = data;
      void writePublicCache('intel', state, publicIntel);
      
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching intel:', err);
      setError(new Error(toUserMessage(err, 'general')));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [alertArea?.state, authInitialized, locationLoading, sessionTrust]);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  return React.createElement(
    IntelContext.Provider,
    { value: { intel, loading, error, refresh: () => fetchIntel(true) } },
    children,
  );
};

export const useIntel = (): UseIntelReturn => {
  const context = useContext(IntelContext);
  if (!context) throw new Error('useIntel must be used within IntelProvider.');
  return context;
};
