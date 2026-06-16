/**
 * MedGuard Brain v1 — Outbreak/WHO alert signal analysis (PURE)
 *
 * Consumes already-fetched outbreak feed entries and WHO alert items from the
 * intel function. Produces `outbreak_alert` signals. These are external feed
 * signals (not user data) and are treated as area-level context only.
 *
 * SAFETY: feed presence is awareness context, NOT outbreak confirmation.
 */

import type {
  BrainSignal,
  BrainOutbreakInput,
  BrainWhoAlertInput,
} from './types.ts';

export function analyzeOutbreakAlerts(
  outbreaks: BrainOutbreakInput[] | null | undefined,
  whoAlerts: BrainWhoAlertInput[] | null | undefined,
): BrainSignal[] {
  const signals: BrainSignal[] = [];

  for (const o of outbreaks ?? []) {
    const sev = String(o.severity || '').toLowerCase();
    const severity: BrainSignal['severity'] = sev === 'high' ? 'high' : sev === 'moderate' ? 'medium' : 'low';
    signals.push({
      type: 'outbreak_alert',
      severity,
      summary: `${o.disease} activity reported (${o.region})`,
      evidence: o.summary && o.summary.trim() ? o.summary : `Reported via ${o.source}`,
      source: o.source,
      sourceId: `${o.disease}:${o.region}`.toLowerCase().replace(/\s+/g, '_'),
      weight: severity === 'high' ? 0.5 : severity === 'medium' ? 0.3 : 0.15,
      freshness: o.updated ? 'recent' : 'unknown',
    });
  }

  for (const w of whoAlerts ?? []) {
    signals.push({
      type: 'outbreak_alert',
      severity: 'low',
      summary: 'WHO disease outbreak news relevant to the region',
      evidence: w.title,
      source: w.source,
      sourceId: w.url || undefined,
      weight: 0.2,
      freshness: 'recent',
    });
  }

  return signals;
}
