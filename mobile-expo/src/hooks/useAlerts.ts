/**
 * useAlerts hook
 * Health alerts and notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from './useUser';
import { invokeEdgeFunction } from '../services/edge';

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

      const { data: raw, error: invokeErr } = await invokeEdgeFunction<any>('intel', { state });
      if (invokeErr || !raw) {
        throw new Error(invokeErr?.message || 'Failed to fetch alerts');
      }
      const advisories: any[] = Array.isArray(raw?.advisories) ? raw.advisories : [];
      const outbreaks: any[] = Array.isArray(raw?.outbreaks) ? raw.outbreaks : [];
      const whoAlerts: any[] = Array.isArray(raw?.whoAlerts) ? raw.whoAlerts : [];

      const mapSeverity = (sev: string): Alert['severity'] => {
        const s = String(sev || '').toLowerCase();
        if (s === 'high') return 'urgent';
        if (s === 'moderate' || s === 'medium') return 'caution';
        return 'info';
      };

      const generatedAt = String(raw?.generatedAt || new Date().toISOString());

      const freshAlerts: Alert[] = [
        ...advisories.map((a, idx): Alert => ({
          id: `adv-${idx}-${generatedAt}`,
          title: `${a?.disease || 'Health advisory'}`,
          message: [a?.summary, a?.recommendation].filter(Boolean).join(' '),
          severity: mapSeverity(a?.severity),
          source: a?.source ? String(a.source) : undefined,
          timestamp: generatedAt,
        })),
        ...outbreaks.map((o, idx): Alert => ({
          id: `out-${idx}-${generatedAt}`,
          title: `${o?.disease || o?.name || 'Outbreak update'}`,
          message: String(o?.summary || o?.description || 'Outbreak update available.'),
          severity: 'caution',
          source: o?.source ? String(o.source) : 'Outbreak feed',
          timestamp: generatedAt,
        })),
        ...whoAlerts.map((w, idx): Alert => ({
          id: `who-${idx}-${generatedAt}`,
          title: `${w?.title || w?.disease || 'WHO alert'}`,
          message: String(w?.summary || w?.description || w?.content || 'WHO alert available.'),
          severity: 'info',
          source: w?.source ? String(w.source) : 'WHO',
          timestamp: generatedAt,
        })),
      ].filter((a) => a.message && a.title);

      setAlerts(freshAlerts.length > 0 ? freshAlerts : getDefaultAlerts());

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
