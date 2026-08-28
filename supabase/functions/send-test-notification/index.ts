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
  const body = await req.json().catch(() => null) as { token?: string; kind?: 'general' | 'health_news' } | null;
  const token = String(body?.token ?? '');
  if (!isExpoToken(token)) return json({ error: 'invalid_token' }, 400);

  const admin = createAdminClient();
  const { data: device } = await admin.from('push_devices').select('id, expo_push_token')
    .eq('user_id', user.id).eq('expo_push_token', token).is('disabled_at', null).maybeSingle();
  if (!device) return json({ error: 'device_not_registered' }, 409);

  const kind = body?.kind === 'health_news' ? 'health_news' : 'general';
  let postId: string | null = null;
  let title = 'MedGuard test notification';
  let notificationBody = 'Notifications are connected to this device.';
  let channelId = 'area-alerts';
  let data: Record<string, unknown> = { type: 'test_notification' };
  if (kind === 'health_news') {
    const { data: post } = await admin.from('health_posts').select('id, title, source')
      .eq('status', 'published').eq('category', 'official_update').order('published_at', { ascending: false }).limit(1).maybeSingle();
    if (!post) return json({ error: 'no_published_health_news' }, 409);
    postId = String(post.id);
    title = `Health News test · ${String(post.source ?? 'Official')}`;
    notificationBody = String(post.title ?? 'Open the latest official health update.');
    channelId = 'health-news';
    data = { type: 'health_post', postId, test: true };
  }
  const message = { to: token, title, body: notificationBody, sound: 'default' as const, channelId, data };
  const [ticket] = await sendExpoPush([message]);
  const now = new Date().toISOString();
  await admin.from('notification_log').insert({
    user_id: user.id, push_device_id: device.id, notification_type: 'general', ref_id: `test:${now}`,
    title, body: message.body, status: ticket?.status ?? 'failed', expo_ticket_id: ticket?.ticketId ?? null,
    error_message: ticket?.error ?? null, scheduled_for: now, sent_at: ticket?.status === 'accepted' ? now : null,
  });
  return json({ accepted: ticket?.status === 'accepted', postId });
});
