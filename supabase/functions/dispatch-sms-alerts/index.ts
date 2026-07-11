/**
 * dispatch-sms-alerts — pushes SMS outbreak alerts to USSD subscribers.
 *
 * Triggers (per state):
 *   • an OFFICIAL verified_reports entry (NCDC/WHO) — attributed, highest priority
 *   • a risk_forecast projection at 'elevated' or 'high' — framed as a projection
 *
 * For each affected state it messages active ussd_subscribers there (24h cooldown)
 * via Africa's Talking. If AT credentials are absent it runs in SIMULATE mode:
 * every message is still written to sms_outbox (status 'simulated') so the flow is
 * fully demoable — and the outbox doubles as the audit trail.
 *
 * Meant to run on a schedule (pg_cron) with the service role; guard with
 * NOTIFY_CRON_SECRET so only the scheduler can trigger a real send.
 */

import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';

const COOLDOWN_HOURS = 24;
const MAX_PER_RUN = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Alert {
  state: string;
  reason: 'verified_report' | 'forecast';
  refId: string;
  body: string;
}

/** Build the per-state alert message (attributed, projection-framed, with opt-out). */
function officialMsg(state: string, summary: string): string {
  return `MedGuard OFFICIAL alert (NCDC/WHO), ${state}: ${summary.slice(0, 110)} ` +
    `Take precautions. Reply STOP to opt out.`;
}
function forecastMsg(state: string, parts: string[]): string {
  return `MedGuard alert: ${state} — ${parts.join(', ')} (risk projection, not a confirmed outbreak). ` +
    `Stay alert & seek care if unwell. Reply STOP to opt out.`;
}

async function sendViaAfricasTalking(
  apiKey: string, username: string, sender: string | null, env: string,
  to: string[], message: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const base = env === 'production'
    ? 'https://api.africastalking.com'
    : 'https://api.sandbox.africastalking.com';
  const form = new URLSearchParams({ username, to: to.join(','), message });
  if (sender) form.set('from', sender);
  try {
    const res = await fetch(`${base}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `AT ${res.status}` };
    const id = data?.SMSMessageData?.Recipients?.[0]?.messageId;
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Only the scheduler (or an authorised caller) may trigger a real dispatch.
  const cronSecret = Deno.env.get('NOTIFY_CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = tryCreateAdminClient();
  if (!admin) return json({ error: 'service role not configured' }, 500);

  const apiKey = Deno.env.get('AT_API_KEY') ?? '';
  const username = Deno.env.get('AT_USERNAME') ?? 'sandbox';
  const sender = Deno.env.get('AT_SENDER') || null;
  const atEnv = Deno.env.get('AT_ENV') ?? 'sandbox';
  const simulate = !apiKey; // no creds → log-only

  const nowIso = new Date().toISOString();
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();

  // 1. Build the set of state-level alerts (official first, then projections).
  const alertsByState = new Map<string, Alert>();

  const { data: official } = await admin
    .from('verified_reports')
    .select('id, state, summary')
    .eq('verification_status', 'verified')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);
  for (const r of (official ?? []) as Array<Record<string, string>>) {
    const state = String(r.state || '').trim();
    if (!state) continue;
    alertsByState.set(state.toLowerCase(), {
      state, reason: 'verified_report', refId: String(r.id),
      body: officialMsg(state, String(r.summary || 'Official health report issued for your area.')),
    });
  }

  const { data: forecasts } = await admin
    .from('risk_forecast')
    .select('id, state, disease, projected_risk_level')
    .in('projected_risk_level', ['elevated', 'high'])
    .gt('valid_until', nowIso);
  const byStateDiseases = new Map<string, { id: string; name: string; parts: string[] }>();
  for (const f of (forecasts ?? []) as Array<Record<string, string>>) {
    const name = String(f.state || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (alertsByState.has(key)) continue; // official already covers this state
    const entry = byStateDiseases.get(key) ?? { id: String(f.id), name, parts: [] };
    entry.parts.push(`${f.disease} ${f.projected_risk_level}`);
    byStateDiseases.set(key, entry);
  }
  for (const [key, { id, name, parts }] of byStateDiseases) {
    alertsByState.set(key, {
      state: name, reason: 'forecast', refId: id, body: forecastMsg(name, parts),
    });
  }

  if (alertsByState.size === 0) return json({ sent: 0, reason: 'no_active_alerts' });

  // 2. For each alerted state, message active subscribers (respecting cooldown).
  let queued = 0, delivered = 0;
  const outboxRows: Array<Record<string, unknown>> = [];
  const alertedIds: string[] = [];

  for (const alert of alertsByState.values()) {
    const { data: subs } = await admin
      .from('ussd_subscribers')
      .select('id, msisdn, last_alerted_at')
      .eq('active', true)
      .ilike('state', alert.state)
      .limit(MAX_PER_RUN);

    const recipients = (subs ?? []).filter((s: Record<string, unknown>) =>
      !s.last_alerted_at || String(s.last_alerted_at) < cooldownCutoff);
    if (recipients.length === 0) continue;

    const numbers = recipients.map((s: Record<string, unknown>) => String(s.msisdn));

    let status: 'sent' | 'simulated' | 'failed' = 'simulated';
    let providerId: string | undefined;
    let error: string | undefined;

    if (!simulate) {
      const r = await sendViaAfricasTalking(apiKey, username, sender, atEnv, numbers, alert.body);
      status = r.ok ? 'sent' : 'failed';
      providerId = r.id;
      error = r.error;
      if (r.ok) delivered += numbers.length;
    }

    for (const s of recipients as Array<Record<string, unknown>>) {
      queued += 1;
      outboxRows.push({
        msisdn: String(s.msisdn), state: alert.state, body: alert.body,
        reason: alert.reason, ref_id: alert.refId, status,
        provider: simulate ? null : 'africastalking',
        provider_message_id: providerId ?? null, error: error ?? null,
        sent_at: status === 'sent' ? nowIso : null,
      });
      alertedIds.push(String(s.id));
    }
  }

  if (outboxRows.length > 0) await admin.from('sms_outbox').insert(outboxRows);
  if (alertedIds.length > 0) {
    await admin.from('ussd_subscribers').update({ last_alerted_at: nowIso }).in('id', alertedIds);
  }

  console.log(JSON.stringify({
    event: 'dispatch_sms_done', states: alertsByState.size, queued, delivered, simulate,
  }));
  return json({ states: alertsByState.size, queued, delivered, mode: simulate ? 'simulated' : 'sent' });
});
