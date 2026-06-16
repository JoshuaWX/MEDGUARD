// MedGuard Brain v1 — Phase 3 LLM-assisted explanation tests.
// These do NOT hit the network: with useLlm=false (or no provider configured),
// the async path must return deterministic, safe output.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateSafeExplanationAsync } from '../generateSafeExplanation.ts';
import { buildBrainAsync } from '../buildBrain.ts';
import { validateSummary } from '../safetyGuardrails.ts';
import type { BrainBuildInput, BrainSignal } from '../types.ts';

const signals: BrainSignal[] = [
  { type: 'weather', severity: 'high', summary: 'Heavy rainfall may increase exposure', evidence: '20mm', source: 'OpenWeather', weight: 0.6 },
  { type: 'symptom_trend', severity: 'medium', summary: 'Community reports rising', evidence: '1.6x', source: 'community_trends', weight: 0.4 },
];

Deno.test('async explanation (useLlm=false): deterministic + safe + actions kept', async () => {
  const r = await generateSafeExplanationAsync('Lagos', 'Elevated', signals, { useLlm: false });
  assertEquals(r.generatedBy, 'deterministic');
  assert(validateSummary(r.summary).ok);
  assert(r.recommendedActions.some((a) => a.toLowerCase().includes('seek medical care')));
});

Deno.test('async explanation defaults to deterministic when options omitted', async () => {
  const r = await generateSafeExplanationAsync('Kano', 'Moderate', signals);
  assertEquals(r.generatedBy, 'deterministic');
  assert(validateSummary(r.summary).ok);
});

Deno.test('buildBrainAsync (useLlm=false) matches safety invariants', async () => {
  const input: BrainBuildInput = {
    area: 'Lagos',
    scope: 'area',
    weather: { temp: 28, humidity: 80, precipitation: 20 },
    forecast: { dates: [], maxTemps: [], minTemps: [], precipitation: [10, 12, 15] },
    season: { label: 'rainy', description: 'Rainy season', confidence: 0.8 },
    aqi: { level: 'poor', dominantPollutant: 'PM2.5' },
    diseases: [{ disease: 'Malaria', riskLevel: 'high', isActive: true, reasons: ['humid'], sources: ['NCDC'] }],
    outbreaks: [],
    whoAlerts: [],
    now: new Date('2026-06-16T00:00:00Z'),
  };
  const brain = await buildBrainAsync(input, { useLlm: false });
  assertEquals(brain.diagnosis, false);
  assertEquals(brain.outbreakConfirmed, false);
  assertEquals(brain.meta.schemaVersion, 'brain_v1');
  assertEquals(brain.meta.generatedBy, 'deterministic');
  assert(validateSummary(brain.summary).ok);
});
