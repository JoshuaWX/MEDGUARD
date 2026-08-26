/**
 * Authentication helpers for unauthenticated machine-to-machine callbacks.
 *
 * These endpoints deliberately run without Supabase JWT verification because
 * their callers are pg_cron or an external USSD gateway. They must therefore
 * enforce their own secret and fail closed when configuration is incomplete.
 */

export type SecretAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: 'unauthorized' | 'misconfigured' };

export function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function requiredSecret(name: string): string | null {
  const value = Deno.env.get(name)?.trim() || '';
  // A 32-character minimum prevents accidentally treating a placeholder or
  // short development value as a production access control.
  return value.length >= 32 ? value : null;
}

export function requireCronSecret(req: Request): SecretAuthResult {
  const expected = requiredSecret('NOTIFY_CRON_SECRET');
  if (!expected) return { ok: false, status: 500, error: 'misconfigured' };

  const supplied = req.headers.get('x-cron-secret') || '';
  if (!constantTimeEquals(supplied, expected)) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true };
}

export function requireUssdCallbackSecret(req: Request): SecretAuthResult {
  const expected = requiredSecret('USSD_CALLBACK_SECRET');
  if (!expected) return { ok: false, status: 500, error: 'misconfigured' };

  // The gateway cannot send custom headers, so the configured callback URL
  // carries this opaque, high-entropy value. Never log req.url.
  const supplied = new URL(req.url).searchParams.get('callback_secret') || '';
  if (!constantTimeEquals(supplied, expected)) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true };
}
