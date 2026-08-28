/** Official area-alert and Health News push dispatcher (cron secret only). */
import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { ExpoMessage, sendExpoPush } from '../_shared/push.ts';
import { activeRecipientsForState, PushRecipient } from '../_shared/push-recipients.ts';
import { requireCronSecret } from '../_shared/request-auth.ts';
import { dispatchHealthNews } from '../_shared/health-news-delivery.ts';

const COOLDOWN_HOURS = 24;
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
    const { data: recent, error: recentError } = await admin.from('notification_log').select('user_id')
      .eq('notification_type', 'community_trend')
      .in('status', ['pending', 'accepted', 'receipt_ok'])
      .in('user_id', users)
      .gte('created_at', cooldown);
    if (recentError) return json({ error: 'notification_deduplication_failed' }, 500);
    const blocked = new Set((recent ?? []).map((row: Record<string, unknown>) => String(row.user_id)));
    for (const recipient of recipients) {
      if (blocked.has(recipient.userId)) continue;
      const title = `Official health alert — ${state}`;
      const body = String(report.summary ?? 'An official health report has been issued for your area.');
      queued.push({ recipient, message: { to: recipient.token, title, body, sound: 'default', channelId: 'area-alerts', data: { type: 'community_trend', reportId: report.id } }, log: { user_id: recipient.userId, push_device_id: recipient.deviceId, notification_type: 'community_trend', ref_id: String(report.id), title, body, scheduled_for: now } });
    }
  }

  let verifiedAccepted = 0;
  if (queued.length) {
    const tickets = await sendExpoPush(queued.map((item) => item.message));
    verifiedAccepted = tickets.filter((ticket) => ticket.status === 'accepted').length;
    const rows = tickets.map((ticket, index) => ({ ...queued[index].log, status: ticket.status, expo_ticket_id: ticket.ticketId ?? null, error_message: ticket.error ?? null, sent_at: ticket.status === 'accepted' ? now : null }));
    const { error: logError } = await admin.from('notification_log').insert(rows);
    if (logError) return json({ error: 'notification_log_failed' }, 500);
  }

  const healthNews = await dispatchHealthNews(admin, { auditJob: 'notify_area_fallback' });
  return json({
    verifiedReports: { queued: queued.length, accepted: verifiedAccepted },
    healthNews,
  });
});
