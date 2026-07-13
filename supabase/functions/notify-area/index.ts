/**
 * notify-area — server-side push dispatcher for OFFICIAL health notifications.
 *
 * Two passes, both official-only (the Brain never self-declares):
 *   A) OUTBREAK ALERTS — a fresh, verified outbreak report (NCDC/WHO via
 *      verified_reports) for the user's state → one push, 24h cooldown per user.
 *   B) HEALTH-NEWS POSTS — a newly published official_update in the feed
 *      (health_posts) → one push per user per post (deduped via
 *      notification_log.ref_id). National post → all opted-in users; state-
 *      tagged → that state. (Outbreak_news posts are mirrored to
 *      verified_reports at ingest, so pass A already covers them.)
 *
 * Delivery uses the Expo Push API. Push tokens are only captured once the Expo
 * project has a real EAS projectId + FCM, so until then both passes find no
 * tokens and send nothing (safe no-op).
 *
 * Intended to be called on a schedule (pg_cron) with the service role. Uses the
 * admin client to read across users; never exposes personal data. Guard with
 * NOTIFY_CRON_SECRET.
 */

import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { ExpoMessage, isExpoToken, sendExpoPush } from '../_shared/push.ts';

const COOLDOWN_HOURS = 24;
const MAX_PER_RUN = 500;
const POST_WINDOW_DAYS = 3; // only push official posts published within this window

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Recipient = { user_id: string; push_token: string };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Optional shared-secret guard so only the scheduler can trigger dispatch.
  const cronSecret = Deno.env.get('NOTIFY_CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = tryCreateAdminClient();
  if (!admin) return json({ error: 'service role not configured' }, 500);
  const db = admin; // non-null binding for use inside closures

  const nowIso = new Date().toISOString();
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();

  const messages: ExpoMessage[] = [];
  const logRows: Array<Record<string, unknown>> = [];

  // Opted-in recipients with a valid push token, optionally scoped to a state.
  // state === null → all states (national post).
  async function recipientsForState(state: string | null): Promise<Recipient[]> {
    let q = db
      .from('notification_preferences')
      .select('user_id, push_token, profiles!inner(state)')
      .eq('community_alerts_enabled', true)
      .eq('notifications_paused', false)
      .not('push_token', 'is', null)
      .limit(MAX_PER_RUN);
    if (state) q = q.ilike('profiles.state', state);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return (data as Array<Record<string, unknown>>)
      .map((r) => ({ user_id: String(r.user_id), push_token: String(r.push_token || '') }))
      .filter((r) => isExpoToken(r.push_token));
  }

  // ── Pass A: verified outbreak reports → community_trend (24h cooldown) ──────
  const { data: reports, error: repErr } = await admin
    .from('verified_reports')
    .select('id, state, summary, source_url, occurred_at, expires_at, verification_status')
    .eq('verification_status', 'verified')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);
  if (repErr) return json({ error: repErr.message }, 500);

  for (const report of (reports ?? []) as Array<Record<string, unknown>>) {
    const state = String(report.state || '').trim();
    if (!state) continue;

    const recipients = await recipientsForState(state);
    for (const r of recipients) {
      // Cooldown: skip if a community alert went to this user recently.
      const { data: recent } = await admin
        .from('notification_log')
        .select('id')
        .eq('user_id', r.user_id)
        .eq('notification_type', 'community_trend')
        .gte('created_at', cooldownCutoff)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) continue;

      const title = `Health alert — ${state}`;
      const body = String(report.summary || 'An official health report has been issued for your area.');
      messages.push({ to: r.push_token, title, body, sound: 'default', channelId: 'health-reminders', data: { type: 'community_trend', reportId: report.id } });
      logRows.push({
        user_id: r.user_id, notification_type: 'community_trend', ref_id: String(report.id),
        title, body, status: 'sent', scheduled_for: nowIso, sent_at: nowIso,
      });
    }
  }

  // ── Pass B: new official_update health posts → health_post (dedupe per post) ─
  const sinceIso = new Date(Date.now() - POST_WINDOW_DAYS * 86400_000).toISOString();
  const { data: postsRaw } = await admin
    .from('health_posts')
    .select('id, title, summary, source, state')
    .eq('status', 'published')
    .eq('category', 'official_update')
    .gte('published_at', sinceIso)
    .order('published_at', { ascending: false });
  const posts = (postsRaw ?? []) as Array<Record<string, string | null>>;

  for (const p of posts) {
    const postId = String(p.id);
    const state = (p.state && String(p.state).trim()) || null;
    const recipients = await recipientsForState(state);
    if (recipients.length === 0) continue;

    // Which of these users were already pushed this post?
    const { data: sent } = await admin
      .from('notification_log')
      .select('user_id')
      .eq('notification_type', 'health_post')
      .eq('ref_id', postId)
      .in('user_id', recipients.map((r) => r.user_id));
    const already = new Set((sent ?? []).map((s: Record<string, unknown>) => String(s.user_id)));

    const title = `${p.source || 'NCDC'} update`;
    const body = String(p.title || 'A new official health update is available.');
    for (const r of recipients) {
      if (already.has(r.user_id)) continue;
      messages.push({ to: r.push_token, title, body, sound: 'default', channelId: 'health-reminders', data: { type: 'health_post', postId } });
      logRows.push({
        user_id: r.user_id, notification_type: 'health_post', ref_id: postId,
        title, body, status: 'sent', scheduled_for: nowIso, sent_at: nowIso,
      });
    }
  }

  if (messages.length === 0) return json({ sent: 0, reason: 'no_recipients' });

  const delivered = await sendExpoPush(messages);
  if (logRows.length > 0) await admin.from('notification_log').insert(logRows);

  console.log(JSON.stringify({ event: 'notify_area_done', reports: (reports ?? []).length, posts: posts.length, queued: messages.length, delivered }));
  return json({ sent: delivered, queued: messages.length });
});
