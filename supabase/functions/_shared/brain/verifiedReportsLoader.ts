/**
 * MedGuard Brain v1 — Verified reports loader (Phase 5)
 *
 * Fetches admin-entered, verified + active reports for a state and maps them to
 * BrainVerifiedReportInput[] for analyzeVerifiedReports. Best-effort: any error
 * returns [] so the area Brain still builds from other signals.
 *
 * SAFETY:
 *  - Filters to verification_status = 'verified' and non-expired rows (the RLS
 *    policy enforces the same, but we filter explicitly for defense in depth).
 *  - Only the approved `summary` is carried forward (no raw media text).
 */

import type { BrainVerifiedReportInput, SignalType } from './types.ts';

interface QueryCapableClient {
  from: (table: string) => {
    // deno-lint-ignore no-explicit-any
    select: (cols: string) => any;
  };
}

interface RawReportRow {
  id?: string;
  state?: string;
  signal_type?: string;
  summary?: string;
  source_type?: string;
  credibility_level?: string;
  verification_status?: string;
  occurred_at?: string;
  expires_at?: string | null;
}

const VALID_SIGNAL_TYPES: SignalType[] = [
  'symptom_trend', 'weather', 'aqi', 'outbreak_alert', 'verified_report', 'historical_pattern',
];
const VALID_CRED = ['low', 'medium', 'high'] as const;

export async function loadVerifiedReports(
  client: QueryCapableClient | null | undefined,
  state: string,
  nowIso?: string,
): Promise<BrainVerifiedReportInput[]> {
  if (!client || !state || !state.trim()) return [];
  const now = nowIso ?? new Date().toISOString();

  try {
    const { data, error } = await client
      .from('verified_reports')
      .select('id, state, signal_type, summary, source_type, credibility_level, verification_status, occurred_at, expires_at')
      .eq('state', state)
      .eq('verification_status', 'verified')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('occurred_at', { ascending: false })
      .limit(20);

    if (error || !Array.isArray(data)) return [];

    return (data as RawReportRow[])
      .filter((r) => r.summary && r.summary.trim())
      .map((r) => ({
        id: String(r.id ?? ''),
        state: String(r.state ?? state),
        signalType: (VALID_SIGNAL_TYPES as readonly string[]).includes(r.signal_type ?? '')
          ? (r.signal_type as SignalType)
          : 'verified_report',
        summary: String(r.summary),
        sourceType: String(r.source_type ?? 'official'),
        credibilityLevel: (VALID_CRED as readonly string[]).includes(r.credibility_level ?? '')
          ? (r.credibility_level as BrainVerifiedReportInput['credibilityLevel'])
          : 'medium',
        verificationStatus: 'verified',
        occurredAt: String(r.occurred_at ?? now),
        expiresAt: r.expires_at ?? null,
      }));
  } catch {
    return [];
  }
}
