// MedGuard Brain v1 — Safety guardrails tests
import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  validateSummary,
  deterministicFallbackSummary,
  enforceSafetyInvariants,
} from '../safetyGuardrails.ts';

Deno.test('guardrails: blocks direct diagnosis', () => {
  assertFalse(validateSummary('Based on this, you have malaria.').ok);
});

Deno.test('guardrails: blocks confirmed-outbreak language', () => {
  assertFalse(validateSummary('A cholera outbreak confirmed in your area.').ok);
  assertFalse(validateSummary('Outbreak detected nearby.').ok);
});

Deno.test('guardrails: blocks prescription + panic', () => {
  assertFalse(validateSummary('Take 500mg of antibiotics now.').ok);
  assertFalse(validateSummary('This is a deadly outbreak, panic now!').ok);
});

Deno.test('guardrails: allows safe awareness text', () => {
  const safe = deterministicFallbackSummary('Lagos', 'Elevated');
  assert(validateSummary(safe).ok, 'fallback summary must be safe');
  assert(safe.includes('not a diagnosis'));
});

Deno.test('guardrails: enforceSafetyInvariants forces flags false', () => {
  const out = enforceSafetyInvariants({ diagnosis: true, outbreakConfirmed: true, x: 1 });
  assertEquals(out.diagnosis, false);
  assertEquals(out.outbreakConfirmed, false);
});
