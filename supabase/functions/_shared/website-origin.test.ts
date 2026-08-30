import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { allowedWebsiteOrigin, websiteCors } from './website-origin.ts';

Deno.test('allows only MedGuard production, local, and project preview origins', () => {
  for (const origin of [
    'https://medguardng.me',
    'https://www.medguardng.me',
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'https://medguard-3qnselzs6-joshuawxs-projects.vercel.app',
  ]) assert(allowedWebsiteOrigin(origin), `expected ${origin} to be allowed`);

  for (const origin of [
    'https://medguard-random-other-team.vercel.app',
    'https://random-joshuawxs-projects.vercel.app',
    'http://medguard-3qnselzs6-joshuawxs-projects.vercel.app',
    'https://medguard-3qnselzs6-joshuawxs-projects.vercel.app.evil.example',
    'https://example.com',
  ]) assert(!allowedWebsiteOrigin(origin), `expected ${origin} to be rejected`);
});

Deno.test('uses the accepted request origin in CORS responses', () => {
  assertEquals(new Headers(websiteCors('https://medguardng.me')).get('Access-Control-Allow-Origin'), 'https://medguardng.me');
});
