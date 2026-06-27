// MedGuard Brain v1 — chat/manual symptom-log analyzer tests
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { analyzeSymptomLogs } from '../analyzeSymptomLogs.ts';
import type { BrainSymptomLogInput } from '../types.ts';

const NOW = new Date('2026-06-16T00:00:00Z');

function log(partial: Partial<BrainSymptomLogInput>): BrainSymptomLogInput {
  return {
    symptomKey: 'cough',
    occurredAt: '2026-06-15T00:00:00Z',
    source: 'chat',
    ...partial,
  };
}

Deno.test('symptom logs: empty/null => no signal', () => {
  assertEquals(analyzeSymptomLogs(null, NOW), []);
  assertEquals(analyzeSymptomLogs([], NOW), []);
});

Deno.test('symptom logs: stale (outside 7-day window) => no signal', () => {
  const r = analyzeSymptomLogs([log({ occurredAt: '2026-06-01T00:00:00Z' })], NOW);
  assertEquals(r, []);
});

Deno.test('symptom logs: single recent symptom => low signal', () => {
  const r = analyzeSymptomLogs([log({ symptomKey: 'cough' })], NOW);
  assertEquals(r.length, 1);
  assertEquals(r[0].severity, 'low');
  assertEquals(r[0].source, 'symptom_logs');
});

Deno.test('symptom logs: repeating the same key does NOT inflate (still low)', () => {
  const r = analyzeSymptomLogs(
    [log({ symptomKey: 'fever' }), log({ symptomKey: 'fever' }), log({ symptomKey: 'Fever' })],
    NOW,
  );
  assertEquals(r.length, 1);
  assertEquals(r[0].severity, 'low');
});

Deno.test('symptom logs: notable + another distinct => medium', () => {
  const r = analyzeSymptomLogs(
    [log({ symptomKey: 'fever' }), log({ symptomKey: 'cough' })],
    NOW,
  );
  assertEquals(r[0].severity, 'medium');
});

Deno.test('symptom logs: three distinct symptoms => medium', () => {
  const r = analyzeSymptomLogs(
    [log({ symptomKey: 'cough' }), log({ symptomKey: 'headache' }), log({ symptomKey: 'fatigue' })],
    NOW,
  );
  assertEquals(r[0].severity, 'medium');
});

Deno.test('symptom logs: weight stays modest (<= 0.3)', () => {
  const r = analyzeSymptomLogs(
    [log({ symptomKey: 'fever' }), log({ symptomKey: 'vomiting' }), log({ symptomKey: 'diarrhea' })],
    NOW,
  );
  assert((r[0].weight ?? 1) <= 0.3, `weight too high: ${r[0].weight}`);
});
