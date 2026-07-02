/**
 * MedGuard Brain v1 — Weighted risk scoring (PURE)
 *
 * Combines normalized signals into a single area/community risk level.
 * Deterministic and explainable. Severity + per-signal weight drive the score.
 *
 * Mapping: Low / Moderate / Elevated. "Elevated" corresponds to the existing
 * risk-engine "high" where the app needs a single level.
 */

import type { BrainSignal, BrainRiskLevel } from './types.ts';

const SEVERITY_BASE: Record<BrainSignal['severity'], number> = {
  low: 1,
  medium: 2.5,
  high: 4,
};

/** Strong signal types get a slight multiplier; weak/contextual get less. */
const TYPE_MULTIPLIER: Record<BrainSignal['type'], number> = {
  symptom_trend: 1.1,
  verified_report: 1.2,
  outbreak_alert: 1.0,
  weather: 0.9,
  aqi: 0.8,
  historical_pattern: 1.1,
  // A model projection is informative but must not dominate confirmed signals.
  risk_forecast: 1.0,
};

export interface RiskScoreResult {
  score: number;
  riskLevel: BrainRiskLevel;
  topContributors: BrainSignal[];
}

export function calculateRiskScore(signals: BrainSignal[]): RiskScoreResult {
  if (!signals || signals.length === 0) {
    return { score: 0, riskLevel: 'Low', topContributors: [] };
  }

  let score = 0;
  for (const s of signals) {
    const base = SEVERITY_BASE[s.severity] ?? 1;
    const weight = typeof s.weight === 'number' ? clamp(s.weight, 0, 1) : 0.3;
    const typeMult = TYPE_MULTIPLIER[s.type] ?? 1;
    score += base * (0.5 + weight) * typeMult;
  }

  // Independent-agreement boost: multiple medium/high signals reinforce.
  const strong = signals.filter((s) => s.severity !== 'low').length;
  if (strong >= 3) score *= 1.15;
  else if (strong >= 2) score *= 1.07;

  const riskLevel: BrainRiskLevel = score >= 8 ? 'Elevated' : score >= 3.5 ? 'Moderate' : 'Low';

  const topContributors = signals
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 3);

  return { score: round1(score), riskLevel, topContributors };
}

function severityRank(s: BrainSignal['severity']): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
