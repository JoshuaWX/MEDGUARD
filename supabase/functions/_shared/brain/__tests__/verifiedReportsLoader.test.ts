// MedGuard Brain v1 — Phase 5: verified reports loader tests.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { loadVerifiedReports } from '../verifiedReportsLoader.ts';

// Minimal chainable fake matching the subset of the query builder we use.
function fakeClient(rows: unknown, error: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.or = chain;
  builder.order = chain;
  builder.limit = () => Promise.resolve({ data: rows, error });
  return { from: () => builder } as unknown as Parameters<typeof loadVerifiedReports>[0];
}

const validRow = {
  id: 'r1',
  state: 'lagos',
  signal_type: 'verified_report',
  summary: 'Local clinic reports increased fever cases this week.',
  source_type: 'NCDC',
  credibility_level: 'high',
  verification_status: 'verified',
  occurred_at: '2026-06-15T00:00:00Z',
  expires_at: null,
};

Deno.test('loader: maps verified rows to BrainVerifiedReportInput', async () => {
  const out = await loadVerifiedReports(fakeClient([validRow]), 'lagos');
  assertEquals(out.length, 1);
  assertEquals(out[0].verificationStatus, 'verified');
  assertEquals(out[0].credibilityLevel, 'high');
  assertEquals(out[0].summary, validRow.summary);
});

Deno.test('loader: drops rows with empty summary', async () => {
  const out = await loadVerifiedReports(fakeClient([{ ...validRow, summary: '   ' }]), 'lagos');
  assertEquals(out.length, 0);
});

Deno.test('loader: invalid signal_type/credibility fall back to safe defaults', async () => {
  const out = await loadVerifiedReports(fakeClient([{ ...validRow, signal_type: 'x', credibility_level: 'y' }]), 'lagos');
  assertEquals(out[0].signalType, 'verified_report');
  assertEquals(out[0].credibilityLevel, 'medium');
});

Deno.test('loader: null client or empty state => []', async () => {
  assertEquals((await loadVerifiedReports(null, 'lagos')).length, 0);
  assertEquals((await loadVerifiedReports(fakeClient([]), '')).length, 0);
});

Deno.test('loader: query error => [] (best-effort)', async () => {
  const out = await loadVerifiedReports(fakeClient(null, { message: 'boom' }), 'lagos');
  assertEquals(out.length, 0);
});
