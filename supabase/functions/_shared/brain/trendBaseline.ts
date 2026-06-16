/**
 * MedGuard Brain v1 — Trend baseline loader (Phase 4)
 *
 * Calls the `get_symptom_trend_baseline` SQL RPC and maps the AGGREGATED rows
 * into BrainTrendBaselineInput[] for analyzeSymptomTrends.
 *
 * SAFETY: the RPC returns aggregates only (no user rows / identifiers). This
 * loader is best-effort: any error returns an empty array so the area Brain
 * still builds from the remaining signals.
 */

import type { BrainTrendBaselineInput } from './types.ts';

// Minimal structural type for the admin/service client `.rpc()` we rely on.
// The Supabase client returns a thenable builder (not a plain Promise), so we
// accept anything awaitable that yields { data, error }.
interface RpcCapableClient {
  // deno-lint-ignore no-explicit-any
  rpc: (fn: string, params: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
}

interface RawBaselineRow {
  symptom_group?: string;
  current_week_count?: number;
  rolling_avg_4w?: number | string;
  classification?: string;
}

const VALID_CLASS = ['normal', 'rising', 'elevated'] as const;

export async function loadTrendBaseline(
  client: RpcCapableClient | null | undefined,
  state: string,
  isoWeek?: string | null,
): Promise<BrainTrendBaselineInput[]> {
  if (!client || !state || !state.trim()) return [];

  try {
    const { data, error } = await client.rpc('get_symptom_trend_baseline', {
      p_state: state,
      p_iso_week: isoWeek ?? null,
    });
    if (error || !Array.isArray(data)) return [];

    return (data as RawBaselineRow[]).map((r) => ({
      symptomGroup: String(r.symptom_group ?? 'unknown'),
      currentWeekCount: toNum(r.current_week_count),
      rollingAvg4w: toNum(r.rolling_avg_4w),
      classification: (VALID_CLASS as readonly string[]).includes(r.classification ?? '')
        ? (r.classification as BrainTrendBaselineInput['classification'])
        : 'normal',
    }));
  } catch {
    return [];
  }
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
