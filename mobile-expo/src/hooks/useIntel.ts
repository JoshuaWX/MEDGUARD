/**
 * useIntel hook
 * Health intelligence and advisory data
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useUser } from './useUser';

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
  // In production, this would make an API call
  // For now, return mock data based on current date/season

  const now = new Date();
  const month = now.getMonth();

  // Determine season (Nigeria has wet and dry seasons)
  const isRainySeason = month >= 3 && month <= 10;

  const season: Season = isRainySeason
    ? {
        label: 'Rainy Season',
        description: 'Increased mosquito activity. Higher risk of waterborne diseases.',
        icon: '🌧️',
      }
    : {
        label: 'Dry Season',
        description: 'Dusty conditions. Higher risk of respiratory issues.',
        icon: '☀️',
      };

  const advisory: Advisory = isRainySeason
    ? {
        title: 'Malaria Prevention Alert',
        message: 'Malaria risk is elevated during rainy season. Use mosquito nets and insect repellent.',
        emoji: '⚠️',
        source: 'Nigeria CDC',
        severity: 'caution',
      }
    : {
        title: 'Respiratory Health Advisory',
        message: 'Dry, dusty conditions may affect respiratory health. Stay hydrated and use face masks when needed.',
        emoji: 'ℹ️',
        source: 'State Health Ministry',
        severity: 'info',
      };

  const tips = isRainySeason
    ? [
        'Use mosquito nets while sleeping',
        'Apply insect repellent on exposed skin',
        'Eliminate stagnant water around your home',
        'Wear long sleeves and pants in the evening',
        'Keep doors and windows screened',
      ]
    : [
        'Drink plenty of water',
        'Use moisturizer for dry skin',
        'Wear face masks in dusty conditions',
        'Keep windows closed during dust storms',
        'Use air purifiers indoors if available',
      ];

  // Mock weather data
  const weather: Weather = {
    temp: isRainySeason ? 26 : 32,
    humidity: isRainySeason ? 80 : 45,
    description: isRainySeason ? 'Partly cloudy with chance of rain' : 'Sunny and clear',
  };

  return {
    advisory,
    season,
    weather,
    tips,
    lastUpdated: new Date().toISOString(),
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
