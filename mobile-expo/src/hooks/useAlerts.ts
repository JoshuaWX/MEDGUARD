/**
 * useAlerts hook
 * Health alerts, disease risks, and AQI data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from './useUser';
import { useAuth } from './useAuth';
import { useLocationContext } from './LocationContext';
import { invokeEdgeFunction } from '../services/edge';
import { DiseaseRisk, AQIInsight } from '../components';
import { toUserMessage } from '../services/errorMessages';
import { BrainResult } from '../services/brain';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'urgent' | 'caution' | 'info';
  source?: string;
  timestamp: string;
}

interface WeatherData {
  temp: number;
  humidity: number;
  precipitation: number;
  windSpeed?: number;
}

interface AirQualityData {
  aqi: number;
  insight: AQIInsight | null;
  pollutants: {
    pm2_5?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    co?: number;
  };
  source: string;
}

interface RiskAssessmentData {
  overallRiskLevel: 'low' | 'medium' | 'high';
  diseases: DiseaseRisk[];
  disclaimer: string;
}

interface SeasonData {
  label: string;
  description: string;
  confidence: number;
}

interface IntelResponse {
  generatedAt: string;
  version: string;
  location: {
    state: string;
    stateNormalized: string;
    isKnownState: boolean;
    region: 'north' | 'south' | 'middle-belt' | null;
  };
  season: SeasonData;
  weather: {
    current: WeatherData;
    source: string;
  } | null;
  airQuality: AirQualityData | null;
  riskAssessment: RiskAssessmentData | null;
  brain?: BrainResult | null;
  personalBrain?: BrainResult | null;
  advisories: any[];
  outbreaks: any[];
  whoAlerts: any[];
  meta: {
    disclaimer: string;
    dataFreshness: Record<string, string>;
  };
}

interface UseAlertsReturn {
  alerts: Alert[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  // New v2 data
  riskAssessment: RiskAssessmentData | null;
  brain: BrainResult | null;
  airQuality: AirQualityData | null;
  weather: WeatherData | null;
  season: SeasonData | null;
  location: { state: string; region: string | null } | null;
  generatedAt: string | null;
}

export const useAlerts = (): UseAlertsReturn => {
  const { user: authUser, initialized: authInitialized } = useAuth();
  const { user, loading: userLoading } = useUser();
  const { geocoded, loading: locationLoading } = useLocationContext();
  const requestIdRef = useRef(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // New v2 state
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentData | null>(null);
  const [brain, setBrain] = useState<BrainResult | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [location, setLocation] = useState<{ state: string; region: string | null } | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
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
      setAlerts([]);
      setRiskAssessment(null);
      setBrain(null);
      setAirQuality(null);
      setWeather(null);
      setSeason(null);
      setLocation(null);
      setGeneratedAt(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: raw, error: invokeErr } = await invokeEdgeFunction<IntelResponse>('intel', { state });
      if (invokeErr || !raw) {
        throw new Error(toUserMessage(invokeErr || 'Failed to fetch alerts', 'general'));
      }
      if (requestId !== requestIdRef.current) return;

      // Store v2 data
      setGeneratedAt(raw.generatedAt || null);
      setLocation(raw.location ? { state: raw.location.state, region: raw.location.region } : null);
      setSeason(raw.season || null);
      setWeather(raw.weather?.current || null);
      setAirQuality(raw.airQuality || null);
      setRiskAssessment(raw.riskAssessment || null);
      setBrain(raw.brain || null);

      // Process alerts (backward compatible)
      const advisories: any[] = Array.isArray(raw?.advisories) ? raw.advisories : [];
      const outbreaks: any[] = Array.isArray(raw?.outbreaks) ? raw.outbreaks : [];
      const whoAlerts: any[] = Array.isArray(raw?.whoAlerts) ? raw.whoAlerts : [];

      const mapSeverity = (sev: string): Alert['severity'] => {
        const s = String(sev || '').toLowerCase();
        if (s === 'high' || s === 'urgent') return 'urgent';
        if (s === 'moderate' || s === 'medium') return 'caution';
        return 'info';
      };

      const timestamp = String(raw?.generatedAt || new Date().toISOString());

      const freshAlerts: Alert[] = [
        ...advisories.map((a, idx): Alert => ({
          id: `adv-${idx}-${timestamp}`,
          title: `${a?.disease || 'Health advisory'}`,
          message: [a?.summary, a?.recommendation].filter(Boolean).join(' '),
          severity: mapSeverity(a?.severity || a?.riskLevel),
          source: a?.source ? String(a.source) : undefined,
          timestamp,
        })),
        ...outbreaks.map((o, idx): Alert => ({
          id: `out-${idx}-${timestamp}`,
          title: `${o?.disease || o?.name || 'Outbreak update'}`,
          message: String(o?.summary || o?.description || 'Outbreak update available.'),
          severity: 'caution',
          source: o?.source ? String(o.source) : 'Outbreak feed',
          timestamp,
        })),
        ...whoAlerts.map((w, idx): Alert => ({
          id: `who-${idx}-${timestamp}`,
          title: `${w?.title || w?.disease || 'WHO alert'}`,
          message: String(w?.summary || w?.description || w?.content || 'WHO alert available.'),
          severity: 'info',
          source: w?.source ? String(w.source) : 'WHO',
          timestamp,
        })),
      ].filter((a) => a.message && a.title);

      setAlerts(freshAlerts);

    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching alerts:', err);
      setError(err as Error);
      
      setAlerts([]);
      setRiskAssessment(null);
      setBrain(null);
      setAirQuality(null);
      setWeather(null);
      setSeason(null);
      setLocation(null);
      setGeneratedAt(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authInitialized, authUser, geocoded?.state, user?.state, userLoading, locationLoading]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    refresh: fetchAlerts,
    riskAssessment,
    brain,
    airQuality,
    weather,
    season,
    location,
    generatedAt,
  };
};

