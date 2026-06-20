/**
 * MedGuard Brain v1 — Symptom trend analysis (PURE)
 *
 * Consumes anonymous community trend rows and/or the Phase 4 SQL RPC baseline
 * (current week vs 4-week rolling average). AGGREGATES ONLY — never raw
 * personal rows. Produces `symptom_trend` and `historical_pattern` signals.
 *
 * Phase 2: works off community_weekly_trends-style aggregates that already
 * exist. The richer rolling-average baseline arrives in Phase 4 and is
 * consumed via `trendBaseline` when present.
 */

import type {
  BrainCommunityTrendInput,
  BrainSignal,
  BrainTrendBaselineInput,
} from "./types.ts";
import { loadTrendBaseline, type RpcCapableClient } from "./trendBaseline.ts";

export async function analyzeSymptomTrendsFromRpc(
  client: RpcCapableClient | null | undefined,
  state: string,
  isoWeek?: string | null,
  communityTrends?: BrainCommunityTrendInput[] | null,
): Promise<BrainSignal[]> {
  const trendBaseline = await loadTrendBaseline(client, state, isoWeek);
  return analyzeSymptomTrends(communityTrends, trendBaseline);
}

/** Analyze week-over-week community aggregates (anonymous). */
export function analyzeSymptomTrends(
  communityTrends: BrainCommunityTrendInput[] | null | undefined,
  trendBaseline?: BrainTrendBaselineInput[] | null,
): BrainSignal[] {
  const signals: BrainSignal[] = [];
  const baselineRows = trendBaseline ?? [];

  // Prefer the explicit rolling-average baseline (Phase 4) when available.
  for (const b of baselineRows) {
    if (b.classification === "normal") continue;
    if (b.confidence === "low") continue;
    const average = b.previous4WeekAverage ?? b.rollingAvg4w;
    const ratio = average > 0 ? b.currentWeekCount / average : 0;
    const pct = typeof b.percentageChange === "number" &&
        Number.isFinite(b.percentageChange)
      ? `, ${Math.round(b.percentageChange)}% change`
      : "";
    const confidence = b.confidence ? `, ${b.confidence} confidence` : "";
    signals.push({
      type: b.classification === "elevated"
        ? "historical_pattern"
        : "symptom_trend",
      severity: b.classification === "elevated" ? "high" : "medium",
      summary: `${
        capitalize(b.symptomGroup)
      } reports are ${b.classification} versus recent weeks`,
      evidence:
        `${b.currentWeekCount} this week vs ${
          average.toFixed(1)
        } previous 4-week average` +
        (ratio > 0
          ? ` (${ratio.toFixed(1)}x${pct}${confidence})`
          : `${pct}${confidence}`),
      source: "community_trends_baseline",
      weight: b.classification === "elevated" ? 0.65 : 0.4,
      freshness: "recent",
    });
  }

  if (baselineRows.length > 0) return signals;

  // Fallback: simple week-over-week from community_weekly_trends aggregates.
  const latest = pickLatest(communityTrends);
  if (!latest) return signals;

  const prev = latest.prevWeekTotal ?? null;
  if (prev !== null && prev > 0) {
    const ratio = latest.totalCheckins / prev;
    if (ratio >= 1.5) {
      signals.push({
        type: "symptom_trend",
        severity: ratio >= 2 ? "high" : "medium",
        summary: "Community health reports are higher than the previous week",
        evidence:
          `${latest.totalCheckins} reports this week vs ${prev} last week`,
        source: "community_trends",
        sourceId: `${latest.state}:${latest.isoWeek}`,
        weight: ratio >= 2 ? 0.55 : 0.35,
        freshness: "recent",
      });
    }
  }

  // Elevated-share signal (share of check-ins marked elevated this week).
  if (latest.totalCheckins >= 5) {
    const elevatedShare = latest.elevatedRiskCount / latest.totalCheckins;
    if (elevatedShare >= 0.3) {
      signals.push({
        type: "symptom_trend",
        severity: elevatedShare >= 0.5 ? "high" : "medium",
        summary:
          "A notable share of community check-ins are elevated this week",
        evidence:
          `${latest.elevatedRiskCount} of ${latest.totalCheckins} check-ins elevated`,
        source: "community_trends",
        sourceId: `${latest.state}:${latest.isoWeek}`,
        weight: elevatedShare >= 0.5 ? 0.5 : 0.3,
        freshness: "recent",
      });
    }
  }

  return signals;
}

function pickLatest(
  rows: BrainCommunityTrendInput[] | null | undefined,
): BrainCommunityTrendInput | null {
  if (!rows || rows.length === 0) return null;
  return rows.slice().sort((a, b) => b.isoWeek.localeCompare(a.isoWeek))[0];
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
