/** Official area-alert and Health News push dispatcher (cron secret only). */
import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { ExpoMessage, sendExpoPush } from '../_shared/push.ts';
import { activeRecipientsForState, PushRecipient } from '../_shared/push-recipients.ts';
import { requireCronSecret } from '../_shared/request-auth.ts';

const COOLDOWN_HOURS = 24;
const POST_WINDOW_DAYS = 3;
type Queued = { recipient: PushRecipient; message: ExpoMessage; log: Record<string, unknown> };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = requireCronSecret(req); if (!auth.ok) return json({ error: auth.error }, auth.status);
  const admin = tryCreateAdminClient(); if (!admin) return json({ error: 'service_role_not_configured' }, 500);
  const now = new Date().toISOString();
  const queued: Queued[] = [];

  const { data: reports, error: reportError } = await admin.from('verified_reports')
    .select('id, state, summary, expires_at, verification_status').eq('verification_status', 'verified')
    .or(`expires_at.is.null,expires_at.gte.${now}`);
  if (reportError) return json({ error: 'reports_failed' }, 500);
  const cooldown = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString();
  for (const report of (reports ?? []) as Array<Record<string, unknown>>) {
    const state = String(report.state ?? '').trim(); if (!state) continue;
    const recipients = await activeRecipientsForState(admin, state);
    const users = [...new Set(recipients.map((r) => r.userId))]; if (!users.length) continue;
    const { data: recent } = await admin.from('notification_log').select('user_id').eq('notification_type', 'community_trend').in('user_id', users).gte('created_at', cooldown);
    const blocked = new Set((recent ?? []).map((row: Record<string, unknown>) => String(row.user_id)));
    for (const recipient of recipients) {
      if (blocked.has(recipient.userId)) continue;
      const title = `Official health alert — ${state}`;
      const body = String(report.summary ?? 'An official health report has been issued for your area.');
      queued.push({ recipient, message: { to: recipient.token, title, body, sound: 'default', channelId: 'area-alerts', data: { type: 'community_trend', reportId: report.id } }, log: { user_id: recipient.userId, push_device_id: recipient.deviceId, notification_type: 'community_trend', ref_id: String(report.id), title, body, scheduled_for: now } });
    }
  }

  const since = new Date(Date.now() - POST_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: posts } = await admin.from('health_posts').select('id, title, source, state').eq('status', 'published').eq('category', 'official_update').gte('published_at', since).order('published_at', { ascending: false });
  for (const post of (posts ?? []) as Array<Record<string, unknown>>) {
    const recipients = await activeRecipientsForState(admin, post.state ? String(post.state) : null);
    const users = [...new Set(recipients.map((r) => r.userId))]; if (!users.length) continue;
    const postId = String(post.id);
    const { data: alreadyRows } = await admin.from('notification_log').select('user_id').eq('notification_type', 'health_post').eq('ref_id', postId).in('user_id', users);
    const sent = new Set((alreadyRows ?? []).map((row: Record<string, unknown>) => String(row.user_id)));
    // A normal Health News push is capped once per user per 24h. Verified reports above retain priority.
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: cappedRows } = await admin.from('notification_log').select('user_id').eq('notification_type', 'health_post').in('user_id', users).gte('created_at', cutoff);
    const capped = new Set((cappedRows ?? []).map((row: Record<string, unknown>) => String(row.user_id)));
    for (const recipient of recipients) {
      if (sent.has(recipient.userId) || capped.has(recipient.userId)) continue;
      const title = `${String(post.source ?? 'Official')} update`;
      const body = String(post.title ?? 'A new official health update is available.');
      queued.push({ recipient, message: { to: recipient.token, title, body, sound: 'default', channelId: 'health-news', data: { type: 'health_post', postId } }, log: { user_id: recipient.userId, push_device_id: recipient.deviceId, notification_type: 'health_post', ref_id: postId, title, body, scheduled_for: now } });
    }
  }

  if (!queued.length) return json({ queued: 0 });
  const tickets = await sendExpoPush(queued.map((item) => item.message));
  const rows = tickets.map((ticket, index) => ({ ...queued[index].log, status: ticket.status, expo_ticket_id: ticket.ticketId ?? null, error_message: ticket.error ?? null, sent_at: ticket.status === 'accepted' ? now : null }));
  await admin.from('notification_log').insert(rows);
  return json({ queued: queued.length, accepted: tickets.filter((ticket) => ticket.status === 'accepted').length });
});
