// MedGuard Brain v1 — risk/confidence CALIBRATION golden table.
//
// There is no labelled real-outcome dataset, so this is scenario-based
// (expert-expected) calibration, not statistical calibration against outcomes.
// Each row is a realistic bundle of signals with the risk level + confidence
// band a domain reviewer would expect. The scorers are tuned to satisfy these,
// and this table locks the behaviour against regressions.
//
// Guardrails specifically pinned here:
//   - PROJECTION CAP: model `risk_forecast` signals alone never reach Elevated.
//   - CONFIRMED-HIGH FLOOR: an official high-severity report reaches Elevated.
//   - STALE-DATA CAP: stale-only evidence yields Low confidence.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calculateRiskScore } from '../calculateRiskScore.ts';
import { calculateConfidence } from '../calculateConfidence.ts';
import type { BrainSignal, BrainConfidence, BrainRiskLevel } from '../types.ts';

function sig(partial: Partial<BrainSignal>): BrainSignal {
  return { type: 'weather', severity: 'low', summary: 's', evidence: 'e', ...partial };
}

interface Scenario {
  name: string;
  signals: BrainSignal[];
  level: BrainRiskLevel;
  confidence: BrainConfidence;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'no signals',
    signals: [],
    level: 'Low',
    confidence: 'Low',
  },
  {
    name: 'single stale low weather → Low / Low',
    signals: [sig({ type: 'weather', severity: 'low', weight: 0.2, freshness: 'stale' })],
    level: 'Low',
    confidence: 'Low',
  },
  {
    name: 'single moderate AQI (contextual) → Low / Low',
    signals: [sig({ type: 'aqi', severity: 'medium', weight: 0.3, freshness: 'recent' })],
    level: 'Low',
    confidence: 'Low',
  },
  {
    name: 'single medium symptom trend → Low / Medium',
    signals: [sig({ type: 'symptom_trend', severity: 'medium', weight: 0.4, freshness: 'live' })],
    level: 'Low',
    confidence: 'Medium',
  },
  {
    name: 'rainy season + historical pattern → Moderate / Medium',
    signals: [
      sig({ type: 'weather', severity: 'medium', weight: 0.4, freshness: 'recent' }),
      sig({ type: 'historical_pattern', severity: 'medium', weight: 0.5, freshness: 'recent' }),
    ],
    level: 'Moderate',
    confidence: 'Medium',
  },
  {
    name: 'one fresh verified NCDC report → Elevated (floor) / Medium',
    signals: [sig({ type: 'verified_report', severity: 'high', weight: 0.7, freshness: 'live' })],
    level: 'Elevated',
    confidence: 'Medium',
  },
  {
    name: 'high outbreak alert alone → Elevated (floor) / Medium',
    signals: [sig({ type: 'outbreak_alert', severity: 'high', weight: 0.5, freshness: 'recent' })],
    level: 'Elevated',
    confidence: 'Medium',
  },
  {
    name: 'verified report + rising symptoms + outbreak alert → Elevated / High',
    signals: [
      sig({ type: 'verified_report', severity: 'high', weight: 0.7, freshness: 'live' }),
      sig({ type: 'symptom_trend', severity: 'high', weight: 0.6, freshness: 'live' }),
      sig({ type: 'outbreak_alert', severity: 'medium', weight: 0.4, freshness: 'recent' }),
    ],
    level: 'Elevated',
    confidence: 'High',
  },
  {
    name: 'PROJECTION CAP: lone high risk_forecast → Moderate (not Elevated) / Medium',
    signals: [sig({ type: 'risk_forecast', severity: 'high', weight: 0.9, freshness: 'recent' })],
    level: 'Moderate',
    confidence: 'Medium',
  },
  {
    name: 'PROJECTION CAP: two high risk_forecasts still → Moderate',
    signals: [
      sig({ type: 'risk_forecast', severity: 'high', weight: 0.9, freshness: 'recent' }),
      sig({ type: 'risk_forecast', severity: 'high', weight: 0.8, freshness: 'recent' }),
    ],
    level: 'Moderate',
    confidence: 'Medium',
  },
  {
    name: 'projection + official verified report → Elevated / High',
    signals: [
      sig({ type: 'risk_forecast', severity: 'high', weight: 0.9, freshness: 'recent' }),
      sig({ type: 'verified_report', severity: 'high', weight: 0.7, freshness: 'live' }),
    ],
    level: 'Elevated',
    confidence: 'High',
  },
  {
    name: 'STALE-DATA CAP: stale-only medium signals → Moderate / Low confidence',
    signals: [
      sig({ type: 'aqi', severity: 'medium', weight: 0.3, freshness: 'stale' }),
      sig({ type: 'weather', severity: 'medium', weight: 0.4, freshness: 'stale' }),
    ],
    level: 'Moderate',
    confidence: 'Low',
  },
];

for (const s of SCENARIOS) {
  Deno.test(`calibration: ${s.name}`, () => {
    const risk = calculateRiskScore(s.signals);
    assertEquals(risk.riskLevel, s.level, `risk level for "${s.name}" (score=${risk.score})`);
    const conf = calculateConfidence(s.signals);
    assertEquals(conf.confidence, s.confidence, `confidence for "${s.name}" (score=${conf.score})`);
  });
}
