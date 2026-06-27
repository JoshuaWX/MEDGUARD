/**
 * MedGuard Brain v1 — Personal symptom-log signal analysis (PURE)
 *
 * Consumes the authenticated user's recent logged symptoms (already fetched
 * elsewhere under a verified JWT). These rows include symptoms the user typed
 * in chat (`source: 'chat'`). PERSONAL signals only — never written to the
 * shared cache, never used for the area scope.
 *
 * No diagnosis: a cluster of recently logged symptoms raises awareness only.
 *
 * Calibration note: weights are intentionally MODEST. Logged symptoms are
 * softer evidence than structured check-ins, so this analyzer can nudge the
 * personal risk picture but must not, on its own, push a user to "Elevated".
 */

import type { BrainSignal, BrainSymptomLogInput } from './types.ts';

/** Symptoms that carry more weight when reported (febrile/GI/respiratory). */
const NOTABLE_KEYS = new Set([
  'fever',
  'vomiting',
  'diarrhea',
  'bleeding',
  'breathing',
  'chest_pain',
]);

/** How recent a symptom must be (days) to count toward the trend. */
const WINDOW_DAYS = 7;

export function analyzeSymptomLogs(
  logs: BrainSymptomLogInput[] | null | undefined,
  now: Date = new Date(),
): BrainSignal[] {
  const rows = logs ?? [];
  if (rows.length === 0) return [];

  const cutoff = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = rows.filter((r) => {
    const t = Date.parse(r.occurredAt);
    return Number.isFinite(t) && t >= cutoff;
  });
  if (recent.length === 0) return [];

  // Count distinct symptom kinds rather than raw rows, so repeating the same
  // word in chat does not inflate the signal.
  const distinctKeys = new Set(recent.map((r) => normalizeKey(r.symptomKey)).filter(Boolean));
  const notable = [...distinctKeys].filter((k) => NOTABLE_KEYS.has(k)).length;
  const distinctCount = distinctKeys.size;
  if (distinctCount === 0) return [];

  const evidence = `${distinctCount} distinct symptom(s) logged in the last ${WINDOW_DAYS} days`;

  // Medium only when there is a real cluster (multiple distinct symptoms with at
  // least one notable, or several distinct symptoms). Otherwise a soft low nudge.
  if ((notable >= 1 && distinctCount >= 2) || distinctCount >= 3) {
    return [{
      type: 'symptom_trend',
      severity: 'medium',
      summary: 'You have recently logged several symptoms',
      evidence,
      source: 'symptom_logs',
      weight: 0.3,
      freshness: 'live',
    }];
  }

  return [{
    type: 'symptom_trend',
    severity: 'low',
    summary: 'You have recently logged a symptom',
    evidence,
    source: 'symptom_logs',
    weight: 0.2,
    freshness: 'live',
  }];
}

function normalizeKey(key: string | null | undefined): string {
  return (key ?? '').trim().toLowerCase();
}
