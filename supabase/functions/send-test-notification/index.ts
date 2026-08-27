import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';
import { isExpoToken, sendExpoPush } from '../_shared/push.ts';

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const userClient = createUserClient(req);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null) as { token?: string } | null;
  const token = String(body?.token ?? '');
  if (!isExpoToken(token)) return json({ error: 'invalid_token' }, 400);

  const admin = createAdminClient();
  const { data: device } = await admin.from('push_devices').select('id, expo_push_token')
    .eq('user_id', user.id).eq('expo_push_token', token).is('disabled_at', null).maybeSingle();
  if (!device) return json({ error: 'device_not_registered' }, 409);

  const title = 'MedGuard test notification';
  const message = { to: token, title, body: 'Notifications are connected to this device.', sound: 'default' as const, channelId: 'area-alerts', data: { type: 'test_notification' } };
  const [ticket] = await sendExpoPush([message]);
  const now = new Date().toISOString();
  await admin.from('notification_log').insert({
    user_id: user.id, push_device_id: device.id, notification_type: 'general', ref_id: `test:${now}`,
    title, body: message.body, status: ticket?.status ?? 'failed', expo_ticket_id: ticket?.ticketId ?? null,
    error_message: ticket?.error ?? null, scheduled_for: now, sent_at: ticket?.status === 'accepted' ? now : null,
  });
  return json({ accepted: ticket?.status === 'accepted' });
});
