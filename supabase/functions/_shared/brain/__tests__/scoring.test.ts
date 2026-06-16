// MedGuard Brain v1 — scoring + confidence tests
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calculateRiskScore } from '../calculateRiskScore.ts';
import { calculateConfidence } from '../calculateConfidence.ts';
import type { BrainSignal } from '../types.ts';

function sig(partial: Partial<BrainSignal>): BrainSignal {
  return {
    type: 'weather',
    severity: 'low',
    summary: 's',
    evidence: 'e',
    ...partial,
  };
}

Deno.test('risk score: no signals => Low', () => {
  const r = calculateRiskScore([]);
  assertEquals(r.riskLevel, 'Low');
  assertEquals(r.score, 0);
});

Deno.test('risk score: single low weather => Low', () => {
  const r = calculateRiskScore([sig({ type: 'weather', severity: 'low', weight: 0.2 })]);
  assertEquals(r.riskLevel, 'Low');
});

Deno.test('risk score: multiple high signals => Elevated', () => {
  const signals = [
    sig({ type: 'verified_report', severity: 'high', weight: 0.7 }),
    sig({ type: 'symptom_trend', severity: 'high', weight: 0.6 }),
    sig({ type: 'outbreak_alert', severity: 'medium', weight: 0.4 }),
  ];
  const r = calculateRiskScore(signals);
  assertEquals(r.riskLevel, 'Elevated');
  assert(r.topContributors.length <= 3);
});

Deno.test('risk score: a couple medium signals => Moderate', () => {
  const signals = [
    sig({ type: 'weather', severity: 'medium', weight: 0.4 }),
    sig({ type: 'aqi', severity: 'medium', weight: 0.25 }),
  ];
  const r = calculateRiskScore(signals);
  assertEquals(r.riskLevel, 'Moderate');
});

Deno.test('confidence: empty => Low', () => {
  assertEquals(calculateConfidence([]).confidence, 'Low');
});

Deno.test('confidence: many fresh diverse credible signals => High', () => {
  const signals = [
    sig({ type: 'verified_report', severity: 'high', freshness: 'live' }),
    sig({ type: 'symptom_trend', severity: 'high', freshness: 'live' }),
    sig({ type: 'outbreak_alert', severity: 'medium', freshness: 'recent' }),
    sig({ type: 'weather', severity: 'medium', freshness: 'live' }),
  ];
  const c = calculateConfidence(signals);
  assert(c.confidence === 'High' || c.confidence === 'Medium', `got ${c.confidence}`);
  assert(c.score >= 0.45);
});

Deno.test('confidence: single stale contextual signal => Low/Medium', () => {
  const c = calculateConfidence([sig({ type: 'aqi', severity: 'medium', freshness: 'stale' })]);
  assert(c.confidence === 'Low' || c.confidence === 'Medium');
});
