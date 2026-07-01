/**
 * notify-area — server-side push dispatcher for OFFICIAL area health alerts.
 *
 * Sends a push notification to opted-in users when there is a fresh, verified
 * outbreak report (NCDC/WHO via `verified_reports`) for their state. This is the
 * only condition that triggers an automatic push — matching the app's stance
 * that only OFFICIAL sources drive outbreak alerts; the Brain never self-declares.
 *
 * Delivery uses the Expo Push API. NOTE: push tokens are only captured once
 * Firebase Cloud Messaging (FCM) is configured for the Expo project, so until
 * then this dispatcher simply finds no tokens and sends nothing (safe no-op).
 *
 * Intended to be called on a schedule (pg_cron) with the service role. It uses
 * the admin client to read across users; never exposes personal data.
 */

import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const COOLDOWN_HOURS = 24;
const MAX_PER_RUN = 500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Optional shared-secret guard so only the scheduler can trigger dispatch.
  const cronSecret = Deno.env.get('NOTIFY_CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = tryCreateAdminClient();
  if (!admin) return json({ error: 'service role not configured' }, 500);

  const nowIso = new Date().toISOString();
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();

  // 1. Active, verified, non-expired outbreak reports.
  const { data: reports, error: repErr } = await admin
    .from('verified_reports')
    .select('id, state, summary, source_url, occurred_at, expires_at, verification_status')
    .eq('verification_status', 'verified')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

  if (repErr) return json({ error: repErr.message }, 500);
  if (!reports || reports.length === 0) return json({ sent: 0, reason: 'no_active_reports' });

  const messages: ExpoMessage[] = [];
  const logRows: Array<Record<string, unknown>> = [];

  for (const report of reports as Array<Record<string, unknown>>) {
    const state = String(report.state || '').trim();
    if (!state) continue;

    // 2. Opted-in users in that state with a push token, not recently alerted.
    //    profiles.state is matched case-insensitively against the report state.
    const { data: recipients, error: recErr } = await admin
      .from('notification_preferences')
      .select('user_id, push_token, profiles!inner(state)')
      .eq('community_alerts_enabled', true)
      .eq('notifications_paused', false)
      .not('push_token', 'is', null)
      .ilike('profiles.state', state)
      .limit(MAX_PER_RUN);

    if (recErr || !Array.isArray(recipients)) continue;

    for (const r of recipients as Array<Record<string, unknown>>) {
      const userId = String(r.user_id);
      const token = String(r.push_token || '');
      if (!token.startsWith('ExponentPushToken') && !token.startsWith('ExpoPushToken')) continue;

      // Cooldown: skip if a community alert was sent to this user recently.
      const { data: recent } = await admin
        .from('notification_log')
        .select('id')
        .eq('user_id', userId)
        .eq('notification_type', 'community_trend')
        .gte('created_at', cooldownCutoff)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) continue;

      const title = `Health alert — ${state}`;
      const body = String(report.summary || 'An official health report has been issued for your area.');
      messages.push({ to: token, title, body, sound: 'default', channelId: 'health-reminders', data: { type: 'community_trend', reportId: report.id } });
      logRows.push({
        user_id: userId,
        notification_type: 'community_trend',
        title,
        body,
        status: 'sent',
        scheduled_for: nowIso,
        sent_at: nowIso,
      });
    }
  }

  if (messages.length === 0) return json({ sent: 0, reason: 'no_recipients' });

  // 3. Deliver via Expo Push (batches of 100).
  let delivered = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) delivered += batch.length;
    } catch {
      // best-effort; logged rows below reflect intent
    }
  }

  // 4. Record sends for cooldown + history.
  if (logRows.length > 0) {
    await admin.from('notification_log').insert(logRows);
  }

  console.log(JSON.stringify({ event: 'notify_area_done', reports: reports.length, queued: messages.length, delivered }));
  return json({ sent: delivered, queued: messages.length });
});
