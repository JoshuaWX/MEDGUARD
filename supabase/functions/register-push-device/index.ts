import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';
import { isExpoToken } from '../_shared/push.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const userClient = createUserClient(req);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null) as { action?: string; token?: string; platform?: string } | null;
  const token = String(body?.token ?? '');
  if (!isExpoToken(token)) return json({ error: 'invalid_token' }, 400);
  const admin = createAdminClient();
  if (body?.action === 'unregister') {
    const { error } = await admin.from('push_devices').update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('expo_push_token', token).is('disabled_at', null);
    if (error) return json({ error: 'unregister_failed' }, 500);
    return json({ ok: true });
  }

  const platform = body?.platform === 'android' || body?.platform === 'ios' ? body.platform : 'unknown';
  // The unique token constraint safely reassigns this physical device when an
  // account switches. The user id always comes from the verified JWT.
  const { error } = await admin.from('push_devices').upsert({
    user_id: user.id, expo_push_token: token, platform, disabled_at: null,
    last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'expo_push_token' });
  if (error) return json({ error: 'registration_failed' }, 500);
  return json({ ok: true });
});
