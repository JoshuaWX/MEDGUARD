import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseInquiryInput } from './validation.ts';

const valid = {
  email: ' Pilot@Example.com ',
  topic: 'pilot',
  organization: ' Community Health Network ',
  role: ' Coordinator ',
  message: 'We would like to explore a bounded community pilot in one state.',
  consent: true,
  company: '',
};

Deno.test('inquiry normalizes valid input', () => {
  const parsed = parseInquiryInput(valid);
  assertEquals(parsed.email, 'pilot@example.com');
  assertEquals(parsed.organization, 'Community Health Network');
  assertEquals(parsed.role, 'Coordinator');
  assertEquals(parsed.honeypotFilled, false);
});

Deno.test('inquiry accepts each supported topic', () => {
  for (const topic of ['pilot', 'product_feedback', 'community_idea']) {
    assertEquals(parseInquiryInput({ ...valid, topic }).topic, topic);
  }
});

Deno.test('inquiry rejects missing consent and unknown topics', () => {
  assertThrows(() => parseInquiryInput({ ...valid, consent: false }));
  assertThrows(() => parseInquiryInput({ ...valid, topic: 'marketing' }));
});

Deno.test('inquiry rejects malformed and oversized fields', () => {
  assertThrows(() => parseInquiryInput({ ...valid, email: 'not-an-email' }));
  assertThrows(() => parseInquiryInput({ ...valid, organization: 'x'.repeat(121) }));
  assertThrows(() => parseInquiryInput({ ...valid, role: 'x'.repeat(81) }));
  assertThrows(() => parseInquiryInput({ ...valid, message: 'too short' }));
  assertThrows(() => parseInquiryInput({ ...valid, message: 'x'.repeat(1501) }));
});

Deno.test('inquiry detects the invisible honeypot', () => {
  assert(parseInquiryInput({ ...valid, company: 'bot company' }).honeypotFilled);
});
