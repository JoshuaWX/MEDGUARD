// MedGuard Brain v1 — Phase 4: symptom trend baseline tests.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  analyzeSymptomTrends,
  analyzeSymptomTrendsFromRpc,
} from "../analyzeSymptomTrends.ts";
import { loadTrendBaseline } from "../trendBaseline.ts";
import type {
  BrainCommunityTrendInput,
  BrainTrendBaselineInput,
} from "../types.ts";

Deno.test("baseline: elevated classification => high-severity historical_pattern signal", () => {
  const baseline: BrainTrendBaselineInput[] = [
    {
      symptomGroup: "fever",
      currentWeekCount: 20,
      previous4WeekAverage: 5,
      rollingAvg4w: 5,
      percentageChange: 300,
      confidence: "high",
      classification: "elevated",
    },
    {
      symptomGroup: "headache",
      currentWeekCount: 3,
      previous4WeekAverage: 3,
      rollingAvg4w: 3,
      percentageChange: 0,
      confidence: "high",
      classification: "normal",
    },
  ];
  const signals = analyzeSymptomTrends(null, baseline);
  assertEquals(signals.length, 1);
  assertEquals(signals[0].type, "historical_pattern");
  assertEquals(signals[0].severity, "high");
  assert(signals[0].evidence.includes("20"));
  assert(signals[0].evidence.includes("previous 4-week average"));
  assert(signals[0].evidence.includes("high confidence"));
});

Deno.test("baseline: rising classification => medium symptom_trend signal", () => {
  const baseline: BrainTrendBaselineInput[] = [
    {
      symptomGroup: "digestive",
      currentWeekCount: 9,
      previous4WeekAverage: 5,
      rollingAvg4w: 5,
      percentageChange: 80,
      confidence: "medium",
      classification: "rising",
    },
  ];
  const signals = analyzeSymptomTrends(null, baseline);
  assertEquals(signals.length, 1);
  assertEquals(signals[0].type, "symptom_trend");
  assertEquals(signals[0].severity, "medium");
});

Deno.test("baseline: all normal => no signals", () => {
  const baseline: BrainTrendBaselineInput[] = [
    {
      symptomGroup: "fever",
      currentWeekCount: 1,
      previous4WeekAverage: 2,
      rollingAvg4w: 2,
      percentageChange: -50,
      confidence: "low",
      classification: "normal",
    },
  ];
  assertEquals(analyzeSymptomTrends(null, baseline).length, 0);
});

Deno.test("baseline: low-confidence sparse row does not emit a signal", () => {
  const baseline: BrainTrendBaselineInput[] = [
    {
      symptomGroup: "fever",
      currentWeekCount: 4,
      previous4WeekAverage: 1,
      rollingAvg4w: 1,
      percentageChange: 300,
      confidence: "low",
      classification: "elevated",
    },
  ];
  assertEquals(analyzeSymptomTrends(null, baseline).length, 0);
});

Deno.test("baseline: takes precedence over community week-over-week fallback", () => {
  const baseline: BrainTrendBaselineInput[] = [
    {
      symptomGroup: "fever",
      currentWeekCount: 30,
      previous4WeekAverage: 5,
      rollingAvg4w: 5,
      percentageChange: 500,
      confidence: "high",
      classification: "elevated",
    },
  ];
  const community: BrainCommunityTrendInput[] = [
    {
      isoWeek: "2026-W24",
      state: "lagos",
      totalCheckins: 100,
      feverCount: 50,
      digestiveCount: 10,
      elevatedRiskCount: 60,
      prevWeekTotal: 10,
      trendDirection: "increasing",
    },
  ];
  const signals = analyzeSymptomTrends(community, baseline);
  // Should use baseline only (1 signal), not also the community fallback.
  assertEquals(signals.length, 1);
  assertEquals(signals[0].source, "community_trends_baseline");
});

Deno.test("baseline: normal RPC rows suppress noisier community fallback", () => {
  const baseline: BrainTrendBaselineInput[] = [
    {
      symptomGroup: "fever",
      currentWeekCount: 3,
      previous4WeekAverage: 2,
      rollingAvg4w: 2,
      percentageChange: 50,
      confidence: "medium",
      classification: "normal",
    },
  ];
  const community: BrainCommunityTrendInput[] = [
    {
      isoWeek: "2026-W24",
      state: "osun",
      totalCheckins: 30,
      feverCount: 10,
      digestiveCount: 3,
      elevatedRiskCount: 20,
      prevWeekTotal: 5,
      trendDirection: "increasing",
    },
  ];
  assertEquals(analyzeSymptomTrends(community, baseline).length, 0);
});

Deno.test("loadTrendBaseline: maps RPC rows and coerces numeric strings", async () => {
  const fakeClient = {
    rpc: (_fn: string, _params: Record<string, unknown>) =>
      Promise.resolve({
        data: [
          {
            state: "osun",
            symptom_group: "fever",
            current_week_count: 12,
            previous_4_week_average: "4.50",
            percentage_change: "166.67",
            confidence: "medium",
            classification: "rising",
          },
          {
            symptom_group: "weird",
            current_week_count: 1,
            rolling_avg_4w: 0,
            classification: "banana",
            confidence: "banana",
          },
        ],
        error: null,
      }),
  };
  const out = await loadTrendBaseline(fakeClient, "Lagos", null);
  assertEquals(out.length, 2);
  assertEquals(out[0].state, "osun");
  assertEquals(out[0].rollingAvg4w, 4.5);
  assertEquals(out[0].previous4WeekAverage, 4.5);
  assertEquals(out[0].percentageChange, 166.67);
  assertEquals(out[0].confidence, "medium");
  assertEquals(out[0].classification, "rising");
  // invalid classification falls back to 'normal'
  assertEquals(out[1].classification, "normal");
  assertEquals(out[1].confidence, "low");
});

Deno.test("loadTrendBaseline: null client or empty state => []", async () => {
  assertEquals((await loadTrendBaseline(null, "Lagos")).length, 0);
  const fakeClient = { rpc: () => Promise.resolve({ data: [], error: null }) };
  assertEquals((await loadTrendBaseline(fakeClient, "")).length, 0);
});

Deno.test("loadTrendBaseline: rpc error => [] (best-effort)", async () => {
  const fakeClient = {
    rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
  };
  assertEquals((await loadTrendBaseline(fakeClient, "Lagos")).length, 0);
});

Deno.test("analyzeSymptomTrendsFromRpc: loads RPC baseline and emits trend signal", async () => {
  const fakeClient = {
    rpc: (fn: string, params: Record<string, unknown>) => {
      assertEquals(fn, "get_symptom_trend_baseline");
      assertEquals(params.p_state, "Osun");
      return Promise.resolve({
        data: [
          {
            state: "osun",
            symptom_group: "digestive",
            current_week_count: 9,
            previous_4_week_average: 5,
            percentage_change: 80,
            confidence: "medium",
            classification: "rising",
          },
        ],
        error: null,
      });
    },
  };
  const signals = await analyzeSymptomTrendsFromRpc(fakeClient, "Osun");
  assertEquals(signals.length, 1);
  assertEquals(signals[0].type, "symptom_trend");
});
