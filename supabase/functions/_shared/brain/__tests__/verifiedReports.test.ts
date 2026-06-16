// MedGuard Brain v1 — verified report decay + safety tests
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { analyzeVerifiedReports } from '../analyzeVerifiedReports.ts';
import type { BrainVerifiedReportInput } from '../types.ts';

const NOW = new Date('2026-06-16T00:00:00Z');

function report(p: Partial<BrainVerifiedReportInput>): BrainVerifiedReportInput {
  return {
    id: 'r1',
    state: 'lagos',
    signalType: 'verified_report',
    summary: 'Local authorities report increased cases at a clinic.',
    sourceType: 'NCDC',
    credibilityLevel: 'high',
    verificationStatus: 'verified',
    occurredAt: '2026-06-15T00:00:00Z',
    expiresAt: null,
    ...p,
  };
}

Deno.test('verified: pending/rejected reports are excluded', () => {
  assertEquals(analyzeVerifiedReports([report({ verificationStatus: 'pending' })], NOW).length, 0);
  assertEquals(analyzeVerifiedReports([report({ verificationStatus: 'rejected' })], NOW).length, 0);
});

Deno.test('verified: expired reports are excluded', () => {
  const expired = report({ expiresAt: '2026-06-10T00:00:00Z' });
  assertEquals(analyzeVerifiedReports([expired], NOW).length, 0);
});

Deno.test('verified: fresh high-credibility => high severity, strong weight', () => {
  const s = analyzeVerifiedReports([report({ occurredAt: '2026-06-15T00:00:00Z' })], NOW);
  assertEquals(s.length, 1);
  assertEquals(s[0].severity, 'high');
  assert((s[0].weight ?? 0) >= 0.6);
  assertEquals(s[0].summary, 'Local authorities report increased cases at a clinic.');
});

Deno.test('verified: older-than-14-days without active window => decayed weak', () => {
  const old = report({ occurredAt: '2026-05-20T00:00:00Z', expiresAt: null });
  const s = analyzeVerifiedReports([old], NOW);
  assertEquals(s.length, 1);
  assertEquals(s[0].severity, 'low');
  assert((s[0].weight ?? 1) <= 0.2);
  assertEquals(s[0].freshness, 'stale');
});

Deno.test('verified: old but still within active/expiry window keeps strength', () => {
  const old = report({ occurredAt: '2026-05-20T00:00:00Z', expiresAt: '2026-07-01T00:00:00Z' });
  const s = analyzeVerifiedReports([old], NOW);
  assertEquals(s.length, 1);
  assertEquals(s[0].severity, 'high');
});
