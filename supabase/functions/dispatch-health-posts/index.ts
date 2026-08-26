/**
 * dispatch-health-posts — pushes MedGuard Health News to USSD/SMS subscribers.
 *
 *   A) Newly published OFFICIAL / OUTBREAK posts (last few days) → full-text SMS
 *      to news-opted-in subscribers (national post → everyone; state-tagged →
 *      that state). Deduped per (post, msisdn) via sms_outbox so each is sent once.
 *   B) A WEEKLY prevention-tips DIGEST → one SMS to opted-in subscribers whose
 *      last_tip_digest_at is older than 7 days.
 *
 * Attributed relays only (never self-declared); opt-in with STOP opt-out. If no
 * Africa's Talking key is set it runs in SIMULATE mode (log to sms_outbox).
 * Meant to run on a schedule with the service role; guard with NOTIFY_CRON_SECRET.
 */

import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { readAtConfig, sendViaAfricasTalking, smsClamp } from '../_shared/sms.ts';
import { requireCronSecret } from '../_shared/request-auth.ts';

const POST_WINDOW_DAYS = 3;      // only SMS posts published within this window (avoid backlog burst)
const TIP_DIGEST_DAYS = 7;       // weekly tips cadence
const MAX_SUBS = 2000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Sub = { id: string; msisdn: string; state: string | null; last_tip_digest_at: string | null };

function postMsg(source: string, title: string, body: string): string {
  const head = `MedGuard — ${source} update: ${title}.`;
  return smsClamp(`${head} ${body}`, 440) + ' Reply STOP to opt out.';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = requireCronSecret(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const admin = tryCreateAdminClient();
  if (!admin) return json({ error: 'service role not configured' }, 500);

  const at = readAtConfig();
  const simulate = at.simulate;
  const nowIso = new Date().toISOString();
  const outbox: Array<Record<string, unknown>> = [];
  let queued = 0, delivered = 0;

  // Active, news-opted-in subscribers (shared by both flows).
  const { data: subsRaw } = await admin
    .from('ussd_subscribers')
    .select('id, msisdn, state, last_tip_digest_at')
    .eq('active', true).eq('news_opt_in', true)
    .limit(MAX_SUBS);
  const subs = (subsRaw ?? []) as Sub[];

  async function sendBatch(numbers: string[], message: string,
                           reason: 'health_post' | 'tip_digest', refId: string, state: string | null) {
    if (numbers.length === 0) return;
    let status: 'sent' | 'simulated' | 'failed' = 'simulated';
    let providerId: string | undefined, error: string | undefined;
    if (!simulate) {
      const r = await sendViaAfricasTalking(at, numbers, message);
      status = r.ok ? 'sent' : 'failed';
      providerId = r.id; error = r.error;
      if (r.ok) delivered += numbers.length;
    }
    for (const msisdn of numbers) {
      queued += 1;
      outbox.push({
        msisdn, state, body: message, reason, ref_id: refId, status,
        provider: simulate ? null : 'africastalking',
        provider_message_id: providerId ?? null, error: error ?? null,
        sent_at: status === 'sent' ? nowIso : null,
      });
    }
  }

  // ── A. Official / outbreak posts → full-text SMS (deduped per post+msisdn) ──
  const sinceIso = new Date(Date.now() - POST_WINDOW_DAYS * 86400_000).toISOString();
  const { data: postsRaw } = await admin
    .from('health_posts')
    .select('id, title, body, source, state, category')
    .eq('status', 'published')
    .in('category', ['official_update', 'outbreak_news'])
    .gte('published_at', sinceIso)
    .order('published_at', { ascending: false });
  const posts = (postsRaw ?? []) as Array<Record<string, string>>;

  // Which (post, msisdn) pairs already went out?
  const already = new Set<string>();
  if (posts.length) {
    const { data: sent } = await admin
      .from('sms_outbox')
      .select('ref_id, msisdn')
      .eq('reason', 'health_post')
      .in('ref_id', posts.map((p) => p.id));
    for (const s of (sent ?? []) as Array<Record<string, string>>) {
      already.add(`${s.ref_id}|${s.msisdn}`);
    }
  }

  for (const p of posts) {
    const targetState = (p.state || '').trim().toLowerCase();
    const recipients = subs.filter((s) =>
      (!targetState || (s.state || '').trim().toLowerCase() === targetState) &&
      !already.has(`${p.id}|${s.msisdn}`));
    if (recipients.length === 0) continue;
    await sendBatch(recipients.map((s) => s.msisdn),
      postMsg(String(p.source || 'NCDC'), String(p.title), String(p.body || '')),
      'health_post', p.id, p.state || null);
  }

  // ── B. Weekly prevention-tips digest ──────────────────────────────────────
  const digestCutoff = new Date(Date.now() - TIP_DIGEST_DAYS * 86400_000).toISOString();
  const dueForDigest = subs.filter((s) => !s.last_tip_digest_at || s.last_tip_digest_at < digestCutoff);
  if (dueForDigest.length > 0) {
    const { data: tipsRaw } = await admin
      .from('health_posts')
      .select('title, summary')
      .eq('status', 'published').eq('category', 'prevention_tip')
      .order('published_at', { ascending: false }).limit(3);
    const tips = (tipsRaw ?? []) as Array<Record<string, string>>;
    if (tips.length > 0) {
      const digest = 'MedGuard health tips: ' +
        tips.map((t, i) => `${i + 1}) ${t.title}`).join('. ') +
        '. Dial the MedGuard code for more. Reply STOP to opt out.';
      await sendBatch(dueForDigest.map((s) => s.msisdn), smsClamp(digest, 440),
        'tip_digest', `digest:${nowIso.slice(0, 10)}`, null);
      await admin.from('ussd_subscribers')
        .update({ last_tip_digest_at: nowIso })
        .in('id', dueForDigest.map((s) => s.id));
    }
  }

  if (outbox.length > 0) await admin.from('sms_outbox').insert(outbox);

  console.log(JSON.stringify({
    event: 'dispatch_health_posts_done', posts: posts.length, queued, delivered, simulate,
  }));
  return json({ posts: posts.length, queued, delivered, mode: simulate ? 'simulated' : 'sent' });
});
