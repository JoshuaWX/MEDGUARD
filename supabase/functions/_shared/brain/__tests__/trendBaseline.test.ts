// MedGuard Brain v1 — Phase 4: symptom trend baseline tests.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { analyzeSymptomTrends } from '../analyzeSymptomTrends.ts';
import { loadTrendBaseline } from '../trendBaseline.ts';
import type { BrainTrendBaselineInput, BrainCommunityTrendInput } from '../types.ts';

Deno.test('baseline: elevated classification => high-severity historical_pattern signal', () => {
  const baseline: BrainTrendBaselineInput[] = [
    { symptomGroup: 'fever', currentWeekCount: 20, rollingAvg4w: 5, classification: 'elevated' },
    { symptomGroup: 'headache', currentWeekCount: 3, rollingAvg4w: 3, classification: 'normal' },
  ];
  const signals = analyzeSymptomTrends(null, baseline);
  assertEquals(signals.length, 1);
  assertEquals(signals[0].type, 'historical_pattern');
  assertEquals(signals[0].severity, 'high');
  assert(signals[0].evidence.includes('20'));
});

Deno.test('baseline: rising classification => medium symptom_trend signal', () => {
  const baseline: BrainTrendBaselineInput[] = [
    { symptomGroup: 'digestive', currentWeekCount: 9, rollingAvg4w: 5, classification: 'rising' },
  ];
  const signals = analyzeSymptomTrends(null, baseline);
  assertEquals(signals.length, 1);
  assertEquals(signals[0].type, 'symptom_trend');
  assertEquals(signals[0].severity, 'medium');
});

Deno.test('baseline: all normal => no signals', () => {
  const baseline: BrainTrendBaselineInput[] = [
    { symptomGroup: 'fever', currentWeekCount: 1, rollingAvg4w: 2, classification: 'normal' },
  ];
  assertEquals(analyzeSymptomTrends(null, baseline).length, 0);
});

Deno.test('baseline: takes precedence over community week-over-week fallback', () => {
  const baseline: BrainTrendBaselineInput[] = [
    { symptomGroup: 'fever', currentWeekCount: 30, rollingAvg4w: 5, classification: 'elevated' },
  ];
  const community: BrainCommunityTrendInput[] = [
    { isoWeek: '2026-W24', state: 'lagos', totalCheckins: 100, feverCount: 50, digestiveCount: 10, elevatedRiskCount: 60, prevWeekTotal: 10, trendDirection: 'increasing' },
  ];
  const signals = analyzeSymptomTrends(community, baseline);
  // Should use baseline only (1 signal), not also the community fallback.
  assertEquals(signals.length, 1);
  assertEquals(signals[0].source, 'community_trends_baseline');
});

Deno.test('loadTrendBaseline: maps RPC rows and coerces numeric strings', async () => {
  const fakeClient = {
    rpc: (_fn: string, _params: Record<string, unknown>) =>
      Promise.resolve({
        data: [
          { symptom_group: 'fever', current_week_count: 12, rolling_avg_4w: '4.50', classification: 'rising' },
          { symptom_group: 'weird', current_week_count: 1, rolling_avg_4w: 0, classification: 'banana' },
        ],
        error: null,
      }),
  };
  const out = await loadTrendBaseline(fakeClient, 'Lagos', null);
  assertEquals(out.length, 2);
  assertEquals(out[0].rollingAvg4w, 4.5);
  assertEquals(out[0].classification, 'rising');
  // invalid classification falls back to 'normal'
  assertEquals(out[1].classification, 'normal');
});

Deno.test('loadTrendBaseline: null client or empty state => []', async () => {
  assertEquals((await loadTrendBaseline(null, 'Lagos')).length, 0);
  const fakeClient = { rpc: () => Promise.resolve({ data: [], error: null }) };
  assertEquals((await loadTrendBaseline(fakeClient, '')).length, 0);
});

Deno.test('loadTrendBaseline: rpc error => [] (best-effort)', async () => {
  const fakeClient = { rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }) };
  assertEquals((await loadTrendBaseline(fakeClient, 'Lagos')).length, 0);
});
