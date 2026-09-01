import { assertEquals } from 'jsr:@std/assert@1';
import { deliverWebsiteEmail, isUsableSender, type WebsiteMailer } from './website-email.ts';

const mailer: WebsiteMailer = {
  apiKey: 're_test',
  owner: 'medguardng@gmail.com',
  sender: 'MedGuard <updates@medguardng.me>',
};

Deno.test('website mail accepts a branded Resend sender and passes Reply-To through', async () => {
  let sent: Record<string, unknown> | undefined;
  const result = await deliverWebsiteEmail(mailer, {
    to: 'visitor@example.com', subject: 'Received', text: 'Thank you', replyTo: 'medguardng@gmail.com',
  }, async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 201 });
  });
  assertEquals(result, { accepted: true, category: 'accepted', status: 201, id: 'email_123' });
  assertEquals(sent?.from, mailer.sender);
  assertEquals(sent?.reply_to, 'medguardng@gmail.com');
});

Deno.test('website mail reports missing configuration and provider rejection without content logging', async () => {
  assertEquals(await deliverWebsiteEmail(undefined, { to: 'visitor@example.com', subject: 'Received', text: 'Thank you' }), {
    accepted: false, category: 'missing_configuration',
  });
  const rejected = await deliverWebsiteEmail(mailer, { to: 'visitor@example.com', subject: 'Received', text: 'Thank you' }, async () => new Response('no', { status: 403 }));
  assertEquals(rejected, { accepted: false, category: 'provider_rejected', status: 403 });
  assertEquals(isUsableSender('MedGuard <updates@medguardng.me>'), true);
  assertEquals(isUsableSender('medguardng@gmail.com'), true);
  assertEquals(isUsableSender('not an email'), false);
});
