/**
 * MedGuard Brain v1 — Verified report analysis (PURE)
 *
 * Phase 2: functional but only activates on verified+active reports. The
 * admin-entry table and RLS arrive in Phase 5; this module already enforces
 * the safety rules so it is ready to consume real rows.
 *
 * RULES:
 *  - Only `verificationStatus === 'verified'` reports are user-facing.
 *  - Expired reports (expiresAt in the past) are excluded.
 *  - Strength DECAYS with age: a report older than 14 days becomes a weak
 *    signal unless still within its active/expiry window.
 *  - Only the approved `summary` is surfaced — never raw unverified text.
 */

import type { BrainSignal, BrainVerifiedReportInput } from './types.ts';

const DECAY_DAYS = 14;

export function analyzeVerifiedReports(
  reports: BrainVerifiedReportInput[] | null | undefined,
  now: Date = new Date(),
): BrainSignal[] {
  const signals: BrainSignal[] = [];
  const nowMs = now.getTime();

  for (const r of reports ?? []) {
    if (r.verificationStatus !== 'verified') continue;

    // Exclude expired reports.
    if (r.expiresAt) {
      const exp = new Date(r.expiresAt).getTime();
      if (Number.isFinite(exp) && exp < nowMs) continue;
    }

    const occurredMs = new Date(r.occurredAt).getTime();
    const ageDays = Number.isFinite(occurredMs)
      ? Math.max(0, (nowMs - occurredMs) / (1000 * 60 * 60 * 24))
      : Infinity;

    const stillActive = r.expiresAt ? true : false;
    const decayed = ageDays > DECAY_DAYS && !stillActive;

    const baseSeverity: BrainSignal['severity'] =
      r.credibilityLevel === 'high' ? 'high' : r.credibilityLevel === 'medium' ? 'medium' : 'low';
    const severity: BrainSignal['severity'] = decayed ? 'low' : baseSeverity;

    const baseWeight = r.credibilityLevel === 'high' ? 0.7 : r.credibilityLevel === 'medium' ? 0.45 : 0.25;
    const weight = decayed ? Math.min(baseWeight, 0.2) : baseWeight;

    signals.push({
      type: 'verified_report',
      severity,
      summary: r.summary, // approved summary only
      evidence: `Verified ${r.sourceType} report` +
        (Number.isFinite(ageDays) ? `, ~${Math.round(ageDays)} day(s) old` : '') +
        (decayed ? ' (older report, reduced weight)' : ''),
      source: r.sourceType,
      sourceId: r.id,
      weight,
      freshness: decayed ? 'stale' : 'recent',
    });
  }

  return signals;
}
