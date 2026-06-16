/**
 * MedGuard Brain v1 — Personal check-in signal analysis (PURE)
 *
 * Consumes the authenticated user's recent check-in rows (already fetched
 * elsewhere under a verified JWT). These are PERSONAL signals and must only be
 * used for the `personal` Brain scope, never written to the shared cache.
 *
 * No diagnosis: a streak of elevated self-reported risk raises awareness only.
 */

import type { BrainSignal, BrainCheckinInput } from './types.ts';

export function analyzeCheckins(
  checkins: BrainCheckinInput[] | null | undefined,
): BrainSignal[] {
  const rows = (checkins ?? []).slice().sort((a, b) => b.checkinDate.localeCompare(a.checkinDate));
  if (rows.length === 0) return [];

  const recent = rows.slice(0, 7);
  const elevated = recent.filter((r) => r.riskLevel === 'elevated').length;
  const moderate = recent.filter((r) => r.riskLevel === 'moderate').length;
  const feverDays = recent.filter((r) => r.hasFever).length;

  const signals: BrainSignal[] = [];

  if (elevated >= 2 || (elevated >= 1 && feverDays >= 2)) {
    signals.push({
      type: 'symptom_trend',
      severity: 'high',
      summary: 'Your recent self-check-ins show repeated elevated readings',
      evidence: `${elevated} elevated and ${feverDays} fever day(s) in your last ${recent.length} check-ins`,
      source: 'personal_checkins',
      weight: 0.6,
      freshness: 'live',
    });
  } else if (elevated >= 1 || moderate >= 2) {
    signals.push({
      type: 'symptom_trend',
      severity: 'medium',
      summary: 'Your recent self-check-ins show some raised readings',
      evidence: `${elevated} elevated, ${moderate} moderate in your last ${recent.length} check-ins`,
      source: 'personal_checkins',
      weight: 0.35,
      freshness: 'live',
    });
  }

  return signals;
}
