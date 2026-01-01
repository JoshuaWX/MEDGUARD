/**
 * useAlerts hook
 * Health alerts and notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useUser } from './useUser';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'urgent' | 'caution' | 'info';
  source?: string;
  timestamp: string;
}

interface UseAlertsReturn {
  alerts: Alert[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export const useAlerts = (): UseAlertsReturn => {
  const { user } = useUser();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    const state = user?.state || 'Lagos';

    try {
      setLoading(true);
      setError(null);

      // In production, this would fetch from your API
      // For now, generate alerts based on location and season
      const freshAlerts = await fetchFreshAlerts(state);
      setAlerts(freshAlerts);

    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err as Error);
      
      // Set default alerts on error
      setAlerts(getDefaultAlerts());
    } finally {
      setLoading(false);
    }
  }, [user?.state]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    refresh: fetchAlerts,
  };
};

// Fetch fresh alerts from API
async function fetchFreshAlerts(state: string): Promise<Alert[]> {
  const now = new Date();
  const month = now.getMonth();
  const isRainySeason = month >= 3 && month <= 10;

  const alerts: Alert[] = [];

  // Seasonal alerts
  if (isRainySeason) {
    alerts.push({
      id: `malaria-${Date.now()}`,
      title: '⚠️ Malaria Outbreak Alert',
      message: `Increased malaria cases reported in ${state} State. Use mosquito nets and apply repellent.`,
      severity: 'urgent',
      source: 'Nigeria CDC',
      timestamp: getRelativeTime(2),
    });

    alerts.push({
      id: `water-${Date.now()}`,
      title: '💧 Water Safety Advisory',
      message: 'Heavy rains may affect water quality. Boil water before drinking.',
      severity: 'caution',
      source: 'State Water Board',
      timestamp: getRelativeTime(5),
    });
  } else {
    alerts.push({
      id: `heat-${Date.now()}`,
      title: '🌡️ Heat Advisory',
      message: 'High temperatures expected. Stay hydrated and avoid prolonged sun exposure.',
      severity: 'caution',
      source: 'Weather Service',
      timestamp: getRelativeTime(3),
    });

    alerts.push({
      id: `dust-${Date.now()}`,
      title: '💨 Air Quality Alert',
      message: 'Dusty conditions may affect respiratory health. Use face masks outdoors.',
      severity: 'info',
      source: 'Environmental Agency',
      timestamp: getRelativeTime(6),
    });
  }

  // General health alerts
  alerts.push({
    id: `vaccine-${Date.now()}`,
    title: '💉 Vaccination Reminder',
    message: 'COVID-19 booster shots now available at local health centers.',
    severity: 'info',
    source: 'Ministry of Health',
    timestamp: getRelativeTime(48),
  });

  return alerts;
}

// Get relative time string
function getRelativeTime(hoursAgo: number): string {
  if (hoursAgo < 1) {
    return 'Just now';
  }
  if (hoursAgo < 24) {
    return `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(hoursAgo / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Default alerts when fetch fails
function getDefaultAlerts(): Alert[] {
  return [
    {
      id: 'default-1',
      title: '💚 Stay Healthy',
      message: 'Remember to wash hands frequently and maintain good hygiene.',
      severity: 'info',
      source: 'MedGuard',
      timestamp: 'Today',
    },
  ];
}
