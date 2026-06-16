// PHASE 1 — Intel response shape freeze test.
//
// GOAL: Guarantee the intel Edge Function response contract stays stable so the
// mobile app (useIntel / useAlerts) does not break. This test does NOT perform
// any network I/O. It statically introspects the response-builder object literal
// in ../index.ts and compares its key set against a reviewed snapshot.
//
// If this test fails, either:
//   (a) a contract-changing edit was made (update the snapshot intentionally), or
//   (b) an accidental regression removed/renamed a key the app depends on.
//
// Run: deno test --allow-read supabase/functions/intel/__tests__/

import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const here = new URL('.', import.meta.url);
const indexUrl = new URL('../index.ts', here);
const snapshotUrl = new URL('./intel-response-shape.snapshot.json', here);

const source = await Deno.readTextFile(indexUrl);
const snapshot = JSON.parse(await Deno.readTextFile(snapshotUrl)) as {
  topLevel: string[];
  location: string[];
  meta: string[];
  metaDataFreshness: string[];
  riskAssessment: string[];
  version: string;
};

/**
 * Extract the balanced `{ ... }` block that immediately follows a marker.
 * Used to isolate the response object literal and nested literals.
 */
function extractBlockAfter(text: string, marker: string): string {
  const start = text.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  const braceStart = text.indexOf('{', start);
  if (braceStart === -1) throw new Error(`no opening brace after marker: ${marker}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(braceStart, i + 1);
    }
  }
  throw new Error(`unbalanced braces after marker: ${marker}`);
}

/** Return the top-level keys declared directly inside an object-literal string. */
function topLevelKeys(block: string): string[] {
  // Strip the outer braces, then scan at brace/bracket/paren depth 0 for property
  // keys. Handles both regular `key: value` and shorthand `key,` properties.
  const inner = block.slice(1, block.length - 1);
  const keys: string[] = [];
  let depth = 0;
  let expectingKey = true;
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === '{' || ch === '[' || ch === '(') { depth++; i++; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; i++; continue; }
    if (depth !== 0) { i++; continue; }
    if (ch === ',') { expectingKey = true; i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && inner[i + 1] === '/') {
      const nl = inner.indexOf('\n', i);
      i = nl === -1 ? inner.length : nl + 1;
      continue;
    }
    if (expectingKey && /[A-Za-z_$'"]/.test(ch)) {
      let j = i;
      let token = '';
      while (j < inner.length && /[A-Za-z0-9_$'"]/.test(inner[j])) { token += inner[j]; j++; }
      let k = j;
      while (k < inner.length && /\s/.test(inner[k])) k++;
      const next = inner[k];
      const key = token.replace(/^['"]|['"]$/g, '');
      if (/^[A-Za-z_$][\w$]*$/.test(key) && (next === ':' || next === ',' || next === undefined)) {
        keys.push(key);
      }
      expectingKey = false;
      i = j;
      continue;
    }
    expectingKey = false;
    i++;
  }
  return keys;
}

Deno.test('intel response: top-level keys match frozen contract', () => {
  const responseBlock = extractBlockAfter(source, 'const response = ');
  const keys = topLevelKeys(responseBlock);
  assertEquals(
    keys.sort(),
    [...snapshot.topLevel].sort(),
    'Top-level intel response keys changed. If intentional (e.g. adding `brain`), update the snapshot in a reviewed change.',
  );
});

Deno.test('intel response: location sub-keys are stable', () => {
  const block = extractBlockAfter(source, 'location: {');
  const keys = topLevelKeys('{' + block.slice(1));
  for (const required of snapshot.location) {
    if (!keys.includes(required)) {
      throw new Error(`location.${required} missing from response contract`);
    }
  }
});

Deno.test('intel response: meta + dataFreshness keys are stable', () => {
  const metaBlock = extractBlockAfter(source, 'meta: {');
  const metaKeys = topLevelKeys(metaBlock);
  for (const required of snapshot.meta) {
    if (!metaKeys.includes(required)) {
      throw new Error(`meta.${required} missing from response contract`);
    }
  }
  const freshnessBlock = extractBlockAfter(source, 'dataFreshness: {');
  const freshnessKeys = topLevelKeys(freshnessBlock);
  assertEquals(
    freshnessKeys.sort(),
    [...snapshot.metaDataFreshness].sort(),
    'meta.dataFreshness keys changed unexpectedly.',
  );
});

Deno.test('intel response: riskAssessment shape is stable', () => {
  const block = extractBlockAfter(source, 'riskAssessment: riskAssessment ?');
  const keys = topLevelKeys(block);
  for (const required of snapshot.riskAssessment) {
    if (!keys.includes(required)) {
      throw new Error(`riskAssessment.${required} missing from response contract`);
    }
  }
});

Deno.test('intel response: version string is frozen as v2', () => {
  const match = source.match(/version:\s*'([^']+)'/);
  if (!match) throw new Error('response version literal not found');
  assertEquals(match[1], snapshot.version);
});

Deno.test('intel response: brain field is present and additive', () => {
  // `brain` must appear as a top-level response key (added in Phase 3).
  const responseBlock = extractBlockAfter(source, 'const response = ');
  const keys = topLevelKeys(responseBlock);
  if (!keys.includes('brain')) {
    throw new Error('Expected additive `brain` field on the intel response.');
  }
});

Deno.test('intel: personalBrain is never written to the shared cache', () => {
  // The cache upsert must store `response` (area-only), and personalBrain must
  // only be attached via attachPersonalBrain on the returned payload.
  const upsertIdx = source.indexOf('.from(\'intel_cache\')');
  assertEquals(upsertIdx > -1, true, 'intel_cache upsert not found');
  const upsertRegion = source.slice(upsertIdx, upsertIdx + 400);
  if (upsertRegion.includes('personalBrain')) {
    throw new Error('personalBrain must NOT be written to intel_cache.');
  }
  // personalBrain is only introduced by the attach helper.
  assertEquals(source.includes('attachPersonalBrain'), true);
});
