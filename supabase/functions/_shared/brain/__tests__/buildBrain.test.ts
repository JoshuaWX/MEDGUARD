// MedGuard Brain v1 — buildBrain orchestration + scope gating + safety
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildBrain } from '../buildBrain.ts';
import { validateSummary } from '../safetyGuardrails.ts';
import type { BrainBuildInput, BrainCheckinInput } from '../types.ts';

const NOW = new Date('2026-06-16T00:00:00Z');

const elevatedCheckins: BrainCheckinInput[] = [
  { checkinDate: '2026-06-15', riskLevel: 'elevated', hasFever: true },
  { checkinDate: '2026-06-14', riskLevel: 'elevated', hasFever: true },
  { checkinDate: '2026-06-13', riskLevel: 'moderate' },
];

function baseInput(p: Partial<BrainBuildInput>): BrainBuildInput {
  return {
    area: 'Lagos',
    scope: 'area',
    weather: { temp: 28, humidity: 80, precipitation: 20 },
    forecast: { dates: [], maxTemps: [], minTemps: [], precipitation: [10, 12, 15] },
    season: { label: 'rainy', description: 'Rainy season', confidence: 0.8 },
    aqi: { level: 'poor', dominantPollutant: 'PM2.5' },
    diseases: [
      { disease: 'Malaria', riskLevel: 'high', isActive: true, reasons: ['humid'], sources: ['NCDC'] },
      { disease: 'Cholera', riskLevel: 'medium', isActive: true, reasons: ['rain'], sources: ['NCDC'] },
    ],
    outbreaks: [],
    whoAlerts: [],
    now: NOW,
    ...p,
  };
}

Deno.test('buildBrain: always safe + invariants false + schemaVersion', () => {
  const brain = buildBrain(baseInput({}));
  assertEquals(brain.diagnosis, false);
  assertEquals(brain.outbreakConfirmed, false);
  assertEquals(brain.meta.schemaVersion, 'brain_v1');
  assert(validateSummary(brain.summary).ok, 'summary must pass guardrails');
  assert(brain.recommendedActions.length >= 1);
  // recommendedActions always include the safe baseline seek-care line.
  assert(brain.recommendedActions.some((a) => a.toLowerCase().includes('seek medical care')));
});

Deno.test('buildBrain: area scope ignores personal check-ins', () => {
  const withCheckins = buildBrain(baseInput({ scope: 'area', checkins: elevatedCheckins }));
  const hasPersonal = withCheckins.signals.some((s) => s.source === 'personal_checkins');
  assertFalseLocal(hasPersonal);
});

Deno.test('buildBrain: personal scope includes personal check-ins', () => {
  const personal = buildBrain(baseInput({ scope: 'personal', checkins: elevatedCheckins }));
  const hasPersonal = personal.signals.some((s) => s.source === 'personal_checkins');
  assert(hasPersonal, 'personal scope should include check-in signals');
  assertEquals(personal.scope, 'personal');
});

Deno.test('buildBrain: low-signal area => Low risk, still safe', () => {
  const quiet = buildBrain({
    area: 'Lagos',
    scope: 'area',
    weather: { temp: 27, humidity: 50, precipitation: 0 },
    forecast: { dates: [], maxTemps: [], minTemps: [], precipitation: [0, 0, 0] },
    season: { label: 'dry', description: 'Dry season', confidence: 0.6 },
    aqi: { level: 'good' },
    diseases: [],
    outbreaks: [],
    whoAlerts: [],
    now: NOW,
  });
  assertEquals(quiet.riskLevel, 'Low');
  assert(validateSummary(quiet.summary).ok);
});

Deno.test('buildBrain: personal scope surfaces chat-logged symptoms', () => {
  const brain = buildBrain({
    area: 'Lagos',
    scope: 'personal',
    weather: { temp: 27, humidity: 55, precipitation: 0 },
    season: { label: 'dry', description: 'Dry season', confidence: 0.6 },
    aqi: { level: 'good' },
    diseases: [],
    outbreaks: [],
    whoAlerts: [],
    symptomLogs: [
      { symptomKey: 'fever', occurredAt: '2026-06-15T00:00:00Z', source: 'chat' },
      { symptomKey: 'cough', occurredAt: '2026-06-15T00:00:00Z', source: 'chat' },
    ],
    now: NOW,
  });
  const fromLogs = brain.signals.find((s) => s.source === 'symptom_logs');
  assert(fromLogs, 'expected a symptom_logs signal in personal scope');
});

Deno.test('buildBrain: area scope ignores symptom logs', () => {
  const brain = buildBrain(baseInput({
    scope: 'area',
    symptomLogs: [{ symptomKey: 'fever', occurredAt: '2026-06-15T00:00:00Z', source: 'chat' }],
  }));
  assertFalseLocal(brain.signals.some((s) => s.source === 'symptom_logs'));
});

Deno.test('buildBrain: a few logged symptoms alone must NOT reach Elevated', () => {
  const brain = buildBrain({
    area: 'Lagos',
    scope: 'personal',
    weather: { temp: 27, humidity: 55, precipitation: 0 },
    season: { label: 'dry', description: 'Dry season', confidence: 0.6 },
    aqi: { level: 'good' },
    diseases: [],
    outbreaks: [],
    whoAlerts: [],
    symptomLogs: [
      { symptomKey: 'fever', occurredAt: '2026-06-15T00:00:00Z', source: 'chat' },
      { symptomKey: 'cough', occurredAt: '2026-06-15T00:00:00Z', source: 'chat' },
      { symptomKey: 'headache', occurredAt: '2026-06-15T00:00:00Z', source: 'chat' },
    ],
    now: NOW,
  });
  assert(brain.riskLevel !== 'Elevated', `logged symptoms alone should not be Elevated, got ${brain.riskLevel}`);
  assert(validateSummary(brain.summary).ok);
});

Deno.test('buildBrain: signalsUsed matches signals length', () => {
  const brain = buildBrain(baseInput({}));
  assertEquals(brain.meta.signalsUsed, brain.signals.length);
});

function assertFalseLocal(v: boolean) {
  assert(!v);
}

// Phase 5 integration: a fresh verified report contributes a verified_report signal.
import { buildBrain as _bb } from '../buildBrain.ts';

Deno.test('buildBrain: fresh verified report surfaces as a signal', () => {
  const brain = _bb({
    area: 'Lagos',
    scope: 'area',
    weather: { temp: 27, humidity: 55, precipitation: 0 },
    season: { label: 'dry', description: 'Dry season', confidence: 0.6 },
    aqi: { level: 'good' },
    diseases: [],
    outbreaks: [],
    whoAlerts: [],
    verifiedReports: [{
      id: 'r1', state: 'lagos', signalType: 'verified_report',
      summary: 'Authorities note a localized increase in cases.',
      sourceType: 'NCDC', credibilityLevel: 'high', verificationStatus: 'verified',
      occurredAt: '2026-06-15T00:00:00Z', expiresAt: null,
    }],
    now: new Date('2026-06-16T00:00:00Z'),
  });
  const vr = brain.signals.find((s) => s.type === 'verified_report');
  if (!vr) throw new Error('expected a verified_report signal');
  if (vr.summary !== 'Authorities note a localized increase in cases.') {
    throw new Error('verified summary not carried through');
  }
});
