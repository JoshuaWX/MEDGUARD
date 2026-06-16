import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = resolve(repoRoot, 'supabase/functions/intel/index.ts');
const config = resolve(repoRoot, 'supabase/functions/deno.json');
const output = resolve(repoRoot, 'supabase/functions/_bundled/intel.txt');
const tempDir = mkdtempSync(join(tmpdir(), 'medguard-intel-bundle-'));
const tempOutput = join(tempDir, 'intel.bundle.js');

const generatedAt = new Date().toISOString();
const denoBinary = process.env.DENO_BIN
  || (process.platform === 'win32'
    ? join(process.env.APPDATA || '', 'npm', 'deno.cmd')
    : 'deno');

try {
  execFileSync(
    denoBinary,
    [
      'bundle',
      '--config',
      config,
      '--no-check',
      entry,
      '--output',
      tempOutput,
    ],
    { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' },
  );

  const bundled = readFileSync(tempOutput, 'utf8');
  const requiredMarkers = [
    'function logIntel',
    'async function enforceRateLimit',
    'async function buildBrainAsync',
    'BRAIN_LLM_SUMMARY',
    'personalBrain',
  ];

  const missing = requiredMarkers.filter((marker) => !bundled.includes(marker));
  if (missing.length > 0) {
    throw new Error(`Generated intel bundle is missing required markers: ${missing.join(', ')}`);
  }

  const header = `/**
 * MedGuard Intel Edge Function - Bundled Dashboard Fallback
 *
 * GENERATED FILE. Do not edit by hand.
 * Source: supabase/functions/intel/index.ts
 * Command: npm run supabase:bundle:intel
 * Generated: ${generatedAt}
 *
 * Prefer CLI deploy from the modular source:
 *   npx supabase functions deploy intel --project-ref cddfhyxlhtmrrtduwlqd
 *
 * This dashboard fallback exists because the Supabase Dashboard editor cannot
 * resolve this repo's relative shared-module imports.
 */

`;

  writeFileSync(output, header + bundled, 'utf8');
  console.log(`Wrote ${output}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
