/**
 * MedGuard Brain v1 — Signal collection (PURE)
 *
 * Fans the already-computed intel inputs out to the individual analyze modules
 * and concatenates their normalized signals. Personal signals (check-ins) are
 * only included when the caller passes them in (i.e. authenticated scope).
 *
 * No fetching, no DB, no network. Orchestration only.
 */

import type { BrainBuildInput, BrainSignal } from './types.ts';
import { analyzeWeather } from './analyzeWeather.ts';
import { analyzeAqi } from './analyzeAqi.ts';
import { analyzeOutbreakAlerts } from './analyzeOutbreakAlerts.ts';
import { analyzeSymptomTrends } from './analyzeSymptomTrends.ts';
import { analyzeCheckins } from './analyzeCheckins.ts';
import { analyzeVerifiedReports } from './analyzeVerifiedReports.ts';

export function collectSignals(input: BrainBuildInput): BrainSignal[] {
  const now = input.now ?? new Date();
  const signals: BrainSignal[] = [];

  signals.push(...analyzeWeather(input.weather, input.forecast, input.season, input.diseases));
  signals.push(...analyzeAqi(input.aqi));
  signals.push(...analyzeOutbreakAlerts(input.outbreaks, input.whoAlerts));
  signals.push(...analyzeSymptomTrends(input.communityTrends, input.trendBaseline));
  signals.push(...analyzeVerifiedReports(input.verifiedReports, now));

  // Personal signals only for the personal scope (authenticated callers).
  if (input.scope === 'personal') {
    signals.push(...analyzeCheckins(input.checkins));
  }

  return signals;
}
