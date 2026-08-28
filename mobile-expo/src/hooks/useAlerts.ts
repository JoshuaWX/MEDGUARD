/** Verified area alerts derived from the app-wide Intel response. */
import { useMemo } from 'react';
import { useIntel } from './useIntel';
import type { DiseaseRisk, AQIInsight } from '../components';
import type { BrainResult } from '../services/brain';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'urgent' | 'caution' | 'info';
  source?: string;
  timestamp: string;
}

interface WeatherData { temp: number; humidity: number; precipitation: number; windSpeed?: number }
interface AirQualityData { aqi: number; insight: AQIInsight | null; pollutants: Record<string, unknown>; source: string }
interface RiskAssessmentData { overallRiskLevel: 'low' | 'medium' | 'high'; diseases: DiseaseRisk[]; disclaimer: string }
interface SeasonData { label: string; description: string; confidence: number }

interface UseAlertsReturn {
  alerts: Alert[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  riskAssessment: RiskAssessmentData | null;
  brain: BrainResult | null;
  airQuality: AirQualityData | null;
  weather: WeatherData | null;
  season: SeasonData | null;
  location: { state: string; region: string | null } | null;
  generatedAt: string | null;
}

function severity(value: unknown): Alert['severity'] {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'high' || normalized === 'urgent') return 'urgent';
  if (normalized === 'moderate' || normalized === 'medium') return 'caution';
  return 'info';
}

export const useAlerts = (): UseAlertsReturn => {
  const { intel, loading, error, refresh } = useIntel();

  const alerts = useMemo<Alert[]>(() => {
    if (!intel) return [];
    const timestamp = intel.generatedAt || new Date().toISOString();
    const outbreaks = Array.isArray(intel.outbreaks) ? intel.outbreaks : [];
    const whoAlerts = Array.isArray(intel.whoAlerts) ? intel.whoAlerts : [];

    // Model advisories are deliberately excluded. This screen and badge are
    // reserved for attributable official/verified reports.
    return [
      ...outbreaks.map((report: any, index): Alert => ({
        id: String(report?.id ?? `verified-${index}-${timestamp}`),
        title: String(report?.disease || report?.name || 'Official health report'),
        message: String(report?.summary || report?.description || 'An official health report is available.'),
        severity: severity(report?.severity),
        source: report?.source ? String(report.source) : 'Verified report',
        timestamp: String(report?.publishedAt || report?.created_at || timestamp),
      })),
      ...whoAlerts.map((report: any, index): Alert => ({
        id: String(report?.id ?? `who-${index}-${timestamp}`),
        title: String(report?.title || report?.disease || 'WHO update'),
        message: String(report?.summary || report?.description || report?.content || 'A WHO update is available.'),
        severity: severity(report?.severity),
        source: report?.source ? String(report.source) : 'WHO',
        timestamp: String(report?.publishedAt || report?.published_at || timestamp),
      })),
    ].filter((alert) => alert.title && alert.message);
  }, [intel]);

  return {
    alerts,
    loading,
    error,
    refresh,
    riskAssessment: intel?.riskAssessment ?? null,
    brain: intel?.brain ?? null,
    airQuality: (intel?.airQuality as unknown as AirQualityData | null) ?? null,
    weather: intel?.weather?.current ?? null,
    season: intel?.season ?? null,
    location: intel?.location ? { state: intel.location.state, region: intel.location.region } : null,
    generatedAt: intel?.generatedAt ?? null,
  };
};
