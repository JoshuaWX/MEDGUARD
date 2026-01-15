/**
 * useIntel hook
 * Health intelligence and advisory data
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useUser } from './useUser';
import { invokeEdgeFunction } from '../services/edge';

interface Advisory {
  title: string;
  message: string;
  emoji: string;
  source?: string;
  severity: 'urgent' | 'caution' | 'info';
}

interface Season {
  label: string;
  description: string;
  icon: string;
}

interface Weather {
  temp: number;
  humidity: number;
  description: string;
}

interface Intel {
  advisory: Advisory | null;
  season: Season | null;
  weather: Weather | null;
  tips: string[];
  lastUpdated: string | null;
}

interface UseIntelReturn {
  intel: Intel | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export const useIntel = (): UseIntelReturn => {
  const { user } = useUser();
  const [intel, setIntel] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntel = useCallback(async () => {
    const state = user?.state || 'Lagos';

    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const { data: cached } = await supabase
        .from('intel_cache')
        .select('*')
        .eq('state', state)
        .single();

      if (cached) {
        const fetchedAt = new Date(cached.fetched_at).getTime();
        const now = Date.now();

        if (now - fetchedAt < CACHE_DURATION_MS) {
          setIntel(cached.data as unknown as Intel);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data from API
      // In production, this would call your RAG API endpoint
      const freshIntel = await fetchFreshIntel(state);
      setIntel(freshIntel);

      // Update cache
      await supabase
        .from('intel_cache')
        .upsert({
          state,
          data: freshIntel as unknown as object,
          fetched_at: new Date().toISOString(),
        });
    } catch (err) {
      console.error('Error fetching intel:', err);
      setError(err as Error);
      
      // Set default intel on error
      setIntel(getDefaultIntel());
    } finally {
      setLoading(false);
    }
  }, [user?.state]);

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

// Fetch fresh intel from API
async function fetchFreshIntel(state: string): Promise<Intel> {
  const { data: raw, error } = await invokeEdgeFunction<any>('intel', { state });
  if (error || !raw) {
    throw new Error(error?.message || 'Failed to fetch intel');
  }
  const seasonLabel = String(raw?.season?.label || '').toLowerCase();
  const season: Season | null = raw?.season
    ? {
        label:
          seasonLabel === 'rainy' ? 'Rainy Season'
          : seasonLabel === 'dry' ? 'Dry Season'
          : seasonLabel === 'harmattan' ? 'Harmattan'
          : String(raw.season.label),
        description: String(raw.season.description || ''),
        icon: seasonLabel === 'rainy' ? '🌧️' : seasonLabel === 'harmattan' ? '💨' : '☀️',
      }
    : null;

  const advisories: any[] = Array.isArray(raw?.advisories) ? raw.advisories : [];
  const pickSeverityRank = (sev: string) => {
    const s = String(sev || '').toLowerCase();
    if (s === 'high') return 3;
    if (s === 'moderate' || s === 'medium') return 2;
    return 1;
  };

  const top = advisories
    .slice()
    .sort((a, b) => pickSeverityRank(b?.severity) - pickSeverityRank(a?.severity))[0];

  const mapSeverity = (sev: string): Advisory['severity'] => {
    const s = String(sev || '').toLowerCase();
    if (s === 'high') return 'urgent';
    if (s === 'moderate' || s === 'medium') return 'caution';
    return 'info';
  };

  const advisory: Advisory | null = top
    ? {
        title: String(top.disease || 'Health advisory'),
        message: [top.summary, top.recommendation].filter(Boolean).join(' '),
        emoji: mapSeverity(top.severity) === 'urgent' ? '⚠️' : mapSeverity(top.severity) === 'caution' ? 'ℹ️' : '💚',
        source: top.source ? String(top.source) : undefined,
        severity: mapSeverity(top.severity),
      }
    : null;

  const weatherRaw = raw?.weather?.current;
  const weather: Weather | null = weatherRaw
    ? {
        temp: Number(weatherRaw.temperature_2m ?? weatherRaw.temp ?? weatherRaw.temperature ?? NaN),
        humidity: Number(weatherRaw.relative_humidity_2m ?? weatherRaw.humidity ?? NaN),
        description:
          String(raw?.weather?.source || '') ||
          (season?.description ? season.description : 'Weather update'),
      }
    : null;

  const tips: string[] = advisories
    .map((a) => a?.recommendation)
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .slice(0, 6);

  return {
    advisory,
    season,
    weather,
    tips,
    lastUpdated: String(raw?.generatedAt || new Date().toISOString()),
  };
}

// Default intel when fetch fails
function getDefaultIntel(): Intel {
  return {
    advisory: {
      title: 'Stay Healthy',
      message: 'Remember to wash hands frequently and stay hydrated.',
      emoji: '💚',
      severity: 'info',
    },
    season: {
      label: 'Current Season',
      description: 'Stay informed about local health conditions.',
      icon: '🌍',
    },
    weather: null,
    tips: [
      'Wash hands frequently',
      'Stay hydrated',
      'Get enough sleep',
      'Exercise regularly',
      'Eat a balanced diet',
    ],
    lastUpdated: null,
  };
}
