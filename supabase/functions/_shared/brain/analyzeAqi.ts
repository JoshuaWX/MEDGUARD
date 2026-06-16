/**
 * MedGuard Brain v1 — Air quality signal analysis (PURE)
 *
 * Consumes the already-computed AQI insight (level + dominant pollutant) from
 * the intel function's getAQIInsight output. No fetching here.
 */

import type { BrainSignal, BrainAqiInput } from './types.ts';

const AQI_SOURCE = 'OpenWeather Air Quality';

export function analyzeAqi(aqi: BrainAqiInput | null | undefined): BrainSignal[] {
  if (!aqi) return [];

  const severityByLevel: Record<BrainAqiInput['level'], 'low' | 'medium' | 'high'> = {
    good: 'low',
    fair: 'low',
    moderate: 'medium',
    poor: 'high',
    very_poor: 'high',
  };

  const severity = severityByLevel[aqi.level];
  // Only surface AQI as a contributing signal when it is at least moderate.
  if (severity === 'low') return [];

  const pollutant = aqi.dominantPollutant ? ` (primary: ${aqi.dominantPollutant})` : '';
  return [
    {
      type: 'aqi',
      severity,
      summary: 'Air quality may affect respiratory health',
      evidence:
        (aqi.healthImplications && aqi.healthImplications.trim()
          ? aqi.healthImplications
          : `Air quality level is ${aqi.level.replace('_', ' ')}`) + pollutant,
      source: AQI_SOURCE,
      weight: severity === 'high' ? 0.4 : 0.25,
      freshness: 'live',
    },
  ];
}
