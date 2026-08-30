import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseWaitlistInput, WaitlistValidationError } from './validation.ts';

Deno.test('waitlist normalizes a valid entry', () => {
  assertEquals(parseWaitlistInput({ email: '  PERSON@Example.COM ', platform: 'android', consent: true, company: '' }), {
    email: 'person@example.com', platform: 'android', consent: true, honeypotFilled: false,
  });
});

Deno.test('waitlist defaults an omitted platform', () => {
  assertEquals(parseWaitlistInput({ email: 'person@example.com', consent: true }).platform, 'other');
});

Deno.test('waitlist rejects missing consent', () => {
  assertThrows(() => parseWaitlistInput({ email: 'person@example.com', consent: false }), WaitlistValidationError, 'consent_required');
});

Deno.test('waitlist rejects malformed and oversized emails', () => {
  assertThrows(() => parseWaitlistInput({ email: 'not-email', consent: true }), WaitlistValidationError, 'invalid_email');
  assertThrows(() => parseWaitlistInput({ email: `${'a'.repeat(250)}@example.com`, consent: true }), WaitlistValidationError, 'invalid_email');
});

Deno.test('waitlist rejects unknown platforms', () => {
  assertThrows(() => parseWaitlistInput({ email: 'person@example.com', platform: 'windows', consent: true }), WaitlistValidationError, 'invalid_platform');
});

Deno.test('waitlist detects the invisible honeypot', () => {
  assertEquals(parseWaitlistInput({ email: 'person@example.com', consent: true, company: 'spam inc' }).honeypotFilled, true);
});
