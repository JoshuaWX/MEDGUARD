/**
 * MedGuard Brain v1 — Confidence scoring (PURE)
 *
 * Confidence depends on:
 *  - amount of data available (number of signals)
 *  - freshness of data
 *  - number of independent signal TYPES agreeing
 *  - source credibility (verified/outbreak vs contextual weather/aqi)
 *
 * CALIBRATION: pinned by __tests__/calibration.test.ts. A STALE-DATA CAP holds
 * confidence at Low when the average freshness is stale (avg < 0.4) — old data
 * should never read as confident no matter how many signals corroborate.
 */

import type { BrainSignal, BrainConfidence } from './types.ts';

const FRESHNESS_SCORE: Record<NonNullable<BrainSignal['freshness']>, number> = {
  live: 1,
  recent: 0.7,
  stale: 0.3,
  unknown: 0.4,
};

const CREDIBLE_TYPES: BrainSignal['type'][] = ['verified_report', 'outbreak_alert', 'symptom_trend', 'historical_pattern', 'risk_forecast'];

export interface ConfidenceResult {
  confidence: BrainConfidence;
  score: number;
}

export function calculateConfidence(signals: BrainSignal[]): ConfidenceResult {
  if (!signals || signals.length === 0) {
    return { confidence: 'Low', score: 0 };
  }

  // Data volume (capped).
  const volume = Math.min(signals.length / 4, 1); // 4+ signals = full

  // Average freshness.
  const freshness =
    signals.reduce((acc, s) => acc + (FRESHNESS_SCORE[s.freshness ?? 'unknown'] ?? 0.4), 0) /
    signals.length;

  // Independent agreement: distinct signal types present.
  const distinctTypes = new Set(signals.map((s) => s.type)).size;
  const agreement = Math.min(distinctTypes / 3, 1); // 3+ distinct types = full

  // Source credibility: presence of credible types.
  const credible = signals.some((s) => CREDIBLE_TYPES.includes(s.type)) ? 1 : 0.5;

  const score = round2(0.3 * volume + 0.25 * freshness + 0.25 * agreement + 0.2 * credible);

  // Stale-data cap: if the evidence is, on average, stale, confidence is Low
  // regardless of the computed score (old signals shouldn't read as confident).
  const confidence: BrainConfidence = freshness < 0.4
    ? 'Low'
    : score >= 0.7 ? 'High' : score >= 0.45 ? 'Medium' : 'Low';
  return { confidence, score };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
