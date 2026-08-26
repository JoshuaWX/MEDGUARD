/**
 * dispatch-risk-changes — personal push when a user's STATE risk tier RISES.
 *
 * The weekly forecast (ml/ job → risk_forecast) keeps a row per state+disease
 * per period. We compare each state+disease's two most recent periods; when the
 * projected tier RISES into an actionable band (elevated/high), we push the
 * opted-in users in that state — once per state per forecast period.
 *
 * HONESTY (locked): this is a PROJECTION, never an outbreak confirmation or a
 * diagnosis. Only Lassa is a validated model (AUC ~0.96); malaria/cholera are
 * climate RISK INDICATORS — the copy reflects that via the model-kind label.
 *
 * Delivery uses the Expo Push API. Push tokens are only captured once the Expo
 * project has a real EAS projectId + FCM, so until then this finds no tokens and
 * sends nothing (safe no-op). Meant to run on a schedule (weekly, after the
 * forecast) with the service role; guard with NOTIFY_CRON_SECRET.
 */

import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { ExpoMessage, isExpoToken, sendExpoPush } from '../_shared/push.ts';
import { requireCronSecret } from '../_shared/request-auth.ts';

const MAX_PER_STATE = 500;
const LOOKBACK_DAYS = 45; // consider forecasts generated within this window
const LEVELS = ['low', 'moderate', 'elevated', 'high'] as const;
const LEVEL_IDX: Record<string, number> = { low: 0, moderate: 1, elevated: 2, high: 3 };
// Prefer the validated model when several diseases rise in the same state.
const DISEASE_PRIORITY: Record<string, number> = { lassa: 3, cholera: 2, malaria: 1 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Human-honest label for the estimate kind, from model_version (mirrors the app). */
function forecastKind(modelVersion: string): string {
  const v = (modelVersion || '').toLowerCase();
  if (v.includes('seasonal')) return 'seasonal risk';
  if (v.includes('baseline') || v.includes('map_')) return 'baseline risk';
  if (v) return 'projection';
  return 'risk estimate';
}

type Row = {
  state: string; disease: string; projected_risk_level: string;
  forecast_period_start: string; model_version: string; summary: string | null;
};
type Rise = {
  state: string; disease: string; level: string; levelIdx: number;
  period: string; modelVersion: string; summary: string | null;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = requireCronSecret(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const admin = tryCreateAdminClient();
  if (!admin) return json({ error: 'service role not configured' }, 500);
  const db = admin;

  const nowIso = new Date().toISOString();
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();

  // Recent forecast rows, newest first, so [0] is current and [1] is previous
  // per (state, disease).
  const { data: rowsRaw, error: rowsErr } = await db
    .from('risk_forecast')
    .select('state, disease, projected_risk_level, forecast_period_start, model_version, summary, generated_at')
    .gte('generated_at', sinceIso)
    .order('forecast_period_start', { ascending: false });
  if (rowsErr) return json({ error: rowsErr.message }, 500);

  // Group by state|disease, keep the two most recent distinct periods.
  const groups = new Map<string, Row[]>();
  for (const r of (rowsRaw ?? []) as Array<Record<string, unknown>>) {
    const row: Row = {
      state: String(r.state ?? '').trim(),
      disease: String(r.disease ?? '').trim().toLowerCase(),
      projected_risk_level: String(r.projected_risk_level ?? '').toLowerCase(),
      forecast_period_start: String(r.forecast_period_start ?? ''),
      model_version: String(r.model_version ?? ''),
      summary: r.summary ? String(r.summary) : null,
    };
    if (!row.state || !row.disease) continue;
    const key = `${row.state.toLowerCase()}|${row.disease}`;
    const arr = groups.get(key) ?? [];
    // Only add if it's a new period (rows already sorted desc by period).
    if (!arr.some((x) => x.forecast_period_start === row.forecast_period_start)) arr.push(row);
    if (arr.length <= 2) groups.set(key, arr);
  }

  // Detect rises into elevated/high.
  const rises: Rise[] = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue; // need a prior period to call it a rise
    const cur = arr[0], prev = arr[1];
    const curIdx = LEVEL_IDX[cur.projected_risk_level];
    const prevIdx = LEVEL_IDX[prev.projected_risk_level];
    if (curIdx === undefined || prevIdx === undefined) continue;
    if (curIdx > prevIdx && curIdx >= LEVEL_IDX.elevated) {
      rises.push({
        state: cur.state, disease: cur.disease, level: cur.projected_risk_level,
        levelIdx: curIdx, period: cur.forecast_period_start,
        modelVersion: cur.model_version, summary: cur.summary,
      });
    }
  }
  if (rises.length === 0) return json({ sent: 0, reason: 'no_rises' });

  // One push per state — the most severe rise (ties → validated model first).
  const topByState = new Map<string, Rise>();
  for (const rise of rises) {
    const k = rise.state.toLowerCase();
    const cur = topByState.get(k);
    const better = !cur ||
      rise.levelIdx > cur.levelIdx ||
      (rise.levelIdx === cur.levelIdx &&
        (DISEASE_PRIORITY[rise.disease] ?? 0) > (DISEASE_PRIORITY[cur.disease] ?? 0));
    if (better) topByState.set(k, rise);
  }

  const messages: ExpoMessage[] = [];
  const logRows: Array<Record<string, unknown>> = [];

  for (const rise of topByState.values()) {
    const refId = `risk:${rise.state.toLowerCase()}:${rise.period}`;

    // Opted-in recipients in this state with a valid push token.
    const { data: recips, error: recErr } = await db
      .from('notification_preferences')
      .select('user_id, push_token, profiles!inner(state)')
      .eq('community_alerts_enabled', true)
      .eq('notifications_paused', false)
      .not('push_token', 'is', null)
      .ilike('profiles.state', rise.state)
      .limit(MAX_PER_STATE);
    if (recErr || !Array.isArray(recips)) continue;

    const recipients = (recips as Array<Record<string, unknown>>)
      .map((r) => ({ user_id: String(r.user_id), push_token: String(r.push_token || '') }))
      .filter((r) => isExpoToken(r.push_token));
    if (recipients.length === 0) continue;

    // Dedupe: who already got this state+period risk push?
    const { data: sent } = await db
      .from('notification_log')
      .select('user_id')
      .eq('notification_type', 'risk_change')
      .eq('ref_id', refId)
      .in('user_id', recipients.map((r) => r.user_id));
    const already = new Set((sent ?? []).map((s: Record<string, unknown>) => String(s.user_id)));

    const kind = forecastKind(rise.modelVersion);
    const disease = rise.disease.charAt(0).toUpperCase() + rise.disease.slice(1);
    const title = `Risk update — ${rise.state}`;
    const body = `${disease} ${kind} for your area has risen to ${rise.level}. This is a projection, not a confirmed outbreak — tap to see what it means.`;

    for (const r of recipients) {
      if (already.has(r.user_id)) continue;
      messages.push({ to: r.push_token, title, body, sound: 'default', channelId: 'health-reminders', data: { type: 'risk_change', state: rise.state, disease: rise.disease } });
      logRows.push({
        user_id: r.user_id, notification_type: 'risk_change', ref_id: refId,
        title, body, status: 'sent', scheduled_for: nowIso, sent_at: nowIso,
      });
    }
  }

  if (messages.length === 0) return json({ sent: 0, reason: 'no_recipients' });

  const delivered = await sendExpoPush(messages);
  if (logRows.length > 0) await db.from('notification_log').insert(logRows);

  console.log(JSON.stringify({ event: 'dispatch_risk_changes_done', rises: rises.length, states: topByState.size, queued: messages.length, delivered }));
  return json({ sent: delivered, queued: messages.length, states: topByState.size });
});
