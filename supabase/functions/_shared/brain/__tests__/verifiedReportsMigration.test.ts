// Phase 5: verified_reports migration safety guard (static SQL checks).
import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const sql = await Deno.readTextFile(
  new URL('../../../../../db/migrations/022_verified_reports.sql', import.meta.url),
);
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

Deno.test('verified_reports: RLS is enabled', () => {
  assert(/enable row level security/i.test(code));
});

Deno.test('verified_reports: clients can only SELECT verified + non-expired rows', () => {
  assert(/for select[\s\S]*to anon, authenticated/i.test(code), 'read policy for anon+authenticated');
  assert(/verification_status = 'verified'/i.test(code), 'must require verified status');
  assert(/expires_at is null or expires_at > now\(\)/i.test(code), 'must require non-expired');
});

Deno.test('verified_reports: writes are service-role only (admin-only write)', () => {
  // Clients get SELECT only; no insert/update/delete grants to anon/authenticated.
  assert(/grant select on table public\.verified_reports to anon, authenticated/i.test(code));
  assert(!/grant[\s\S]*insert[\s\S]*to anon/i.test(code), 'anon must not get insert');
  assert(!/grant[\s\S]*insert[\s\S]*authenticated/i.test(code), 'authenticated must not get insert');
  assert(/grant select, insert, update, delete on table public\.verified_reports to service_role/i.test(code));
  assert(/for all[\s\S]*to service_role/i.test(code), 'service role full-access policy');
});

Deno.test('verified_reports: has required provenance + decay columns', () => {
  for (const col of ['source_url', 'source_type', 'credibility_level', 'verification_status', 'reviewed_by', 'occurred_at', 'expires_at', 'created_at', 'updated_at']) {
    assert(code.includes(col), `missing column ${col}`);
  }
});

Deno.test('verified_reports: status + credibility are constrained', () => {
  assert(/verification_status[\s\S]*check[\s\S]*'pending', 'verified', 'rejected'/i.test(code));
  assert(/credibility_level[\s\S]*check[\s\S]*'low', 'medium', 'high'/i.test(code));
});
