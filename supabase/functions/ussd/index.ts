/**
 * ussd — MedGuard feature-phone gateway (Africa's Talking USSD callback).
 *
 * Lets ANY phone (no app, no data) dial a short code and:
 *   1) Check projected disease risk for their state
 *   2) Subscribe to free SMS outbreak alerts for their state
 *   3) Read the latest OFFICIAL (NCDC/WHO) alert
 *
 * This is MedGuard's last-mile reach: the people most exposed to Lassa/cholera
 * outbreaks are rural and on feature phones, so app-only alerting misses them.
 *
 * Protocol (Africa's Talking): the gateway POSTs form-urlencoded
 * { sessionId, serviceCode, phoneNumber, text } where `text` is the user's
 * accumulated input joined by '*'. We reply with plain text prefixed:
 *   "CON " → keep the session open (expecting more input)
 *   "END " → terminate and show a final message
 *
 * Content safety (unchanged app stance): model output is framed as a PROJECTION,
 * never an outbreak confirmation or diagnosis; only verified_reports drive
 * "official" wording, always attributed. Written server-side (service role).
 */

import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { normalizeState } from '../_shared/nigeria.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';
import { requireUssdCallbackSecret } from '../_shared/request-auth.ts';

// USSD gateways expect a text/plain body. CORS is included so the local
// demo simulator (a static HTML page) can call this too.
function ussd(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

const RISK_EMOJI: Record<string, string> = {
  low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High',
};

type UssdInput = { sessionId: string; phone: string; text: string };

const MAX_USSD_BODY_BYTES = 4096;
const MAX_USSD_TEXT_LENGTH = 240;
const NIGERIAN_MSISDN = /^\+234[789]\d{9}$/;
const USSD_SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

async function parseInput(req: Request): Promise<UssdInput | null> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (!Number.isFinite(contentLength) || contentLength > MAX_USSD_BODY_BYTES) return null;

  const raw = await req.text();
  if (raw.length > MAX_USSD_BODY_BYTES) return null;
  const form = new URLSearchParams(raw);

  const sessionId = String(form.get('sessionId') ?? '').trim();
  const phone = String(form.get('phoneNumber') ?? '').trim();
  const text = String(form.get('text') ?? '');
  if (!USSD_SESSION_ID.test(sessionId) || !NIGERIAN_MSISDN.test(phone)) return null;
  if (text.length > MAX_USSD_TEXT_LENGTH || /[\u0000-\u001F]/.test(text)) return null;

  return {
    sessionId,
    phone,
    text,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return ussd('END Invalid request.', 405);

  const auth = requireUssdCallbackSecret(req);
  if (!auth.ok) {
    return ussd('END Service temporarily unavailable. Please try again later.', auth.status);
  }

  const admin = tryCreateAdminClient();
  if (!admin) return ussd('END Service temporarily unavailable. Please try again later.');

  const input = await parseInput(req);
  if (!input) return ussd('END Invalid request. Please dial again.', 400);

  const [sessionLimit, phoneLimit] = await Promise.all([
    enforceRateLimit(req, {
      bucket: 'ussd-session', windowSeconds: 90, maxRequests: 12, subjectId: input.sessionId,
    }),
    enforceRateLimit(req, {
      bucket: 'ussd-phone', windowSeconds: 600, maxRequests: 30, subjectId: input.phone,
    }),
  ]);
  // The rate limiter is an abuse-control dependency for this public callback.
  // Do not process a request if it cannot enforce either limit.
  if (!sessionLimit || !phoneLimit) {
    return ussd('END Service temporarily unavailable. Please try again later.', 503);
  }
  if (!sessionLimit.allowed || !phoneLimit.allowed) {
    return ussd('END Too many requests. Please try again shortly.', 429);
  }

  const { phone, text } = input;
  const parts = text === '' ? [] : text.split('*');
  const nowIso = new Date().toISOString();

  try {
    // ── Root menu ─────────────────────────────────────────────────────────
    if (parts.length === 0) {
      return ussd(
        'CON MedGuard — health alerts\n' +
        '1. Disease risk near me\n' +
        '2. Subscribe to free alerts\n' +
        '3. Latest official alert\n' +
        '4. Report health emergency\n' +
        '5. Health updates & tips',
      );
    }

    const choice = parts[0];

    // ── 1. Disease risk near me ────────────────────────────────────────────
    if (choice === '1') {
      if (parts.length === 1) return ussd('CON Enter your state (e.g. Ondo):');
      const state = normalizeState(parts[1]);
      if (!state) return ussd('END State not recognised. Dial again and enter e.g. Ondo, Lagos, Kano.');

      // Latest active projection per disease for the state.
      const { data: rows } = await admin
        .from('risk_forecast')
        .select('disease, projected_risk_level, generated_at')
        .ilike('state', state)
        .gt('valid_until', nowIso)
        .order('generated_at', { ascending: false });

      const seen = new Set<string>();
      const lines: string[] = [];
      for (const r of (rows ?? []) as Array<Record<string, string>>) {
        const d = r.disease;
        if (seen.has(d)) continue;
        seen.add(d);
        const label = RISK_EMOJI[r.projected_risk_level] ?? r.projected_risk_level;
        lines.push(`${d[0].toUpperCase()}${d.slice(1)}: ${label}`);
      }

      // Official reports override tone with an attributed warning.
      const { data: official } = await admin
        .from('verified_reports')
        .select('summary')
        .eq('verification_status', 'verified')
        .ilike('state', state)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .limit(1);

      let msg = `END ${state} risk projection:\n`;
      msg += lines.length ? lines.join('\n') : 'No active projection yet.';
      if (official && official.length) {
        msg += `\n! OFFICIAL: ${String(official[0].summary).slice(0, 80)}`;
      }
      msg += '\n(Projection, not a diagnosis. Src: NCDC/model)';
      return ussd(msg);
    }

    // ── 2. Subscribe to free alerts ────────────────────────────────────────
    if (choice === '2') {
      if (parts.length === 1) return ussd('CON Enter your state for free SMS alerts:');
      const state = normalizeState(parts[1]);
      if (!state) return ussd('END State not recognised. Dial again and enter e.g. Ondo, Lagos, Kano.');
      if (!phone) return ussd('END Could not read your number. Please try again.');

      const { error } = await admin
        .from('ussd_subscribers')
        .upsert({ msisdn: phone, state, active: true, news_opt_in: true }, { onConflict: 'msisdn' });
      if (error) return ussd('END Could not subscribe right now. Please try again later.');

      return ussd(
        `END Subscribed. You'll get FREE SMS alerts when ${state} disease risk rises, ` +
        'plus official health updates. Reply STOP to any alert to opt out.',
      );
    }

    // ── 3. Latest official alert ───────────────────────────────────────────
    if (choice === '3') {
      const { data: official } = await admin
        .from('verified_reports')
        .select('state, summary, occurred_at')
        .eq('verification_status', 'verified')
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .order('occurred_at', { ascending: false })
        .limit(1);

      if (!official || !official.length) {
        return ussd('END No active official outbreak alerts right now. Stay safe.');
      }
      const o = official[0] as Record<string, string>;
      return ussd(`END OFFICIAL (NCDC/WHO) — ${o.state}:\n${String(o.summary).slice(0, 140)}`);
    }

    // ── 4. Report a health emergency ───────────────────────────────────────
    // Citizen early-warning signal. NOT an ambulance dispatch, NOT a diagnosis:
    // we collect state → town/LGA → nature, store it for partner outreach, and
    // always tell the reporter to call 112 for immediate danger.
    if (choice === '4') {
      // Step 1: state
      if (parts.length === 1) return ussd('CON Report a health emergency.\nEnter your State:');
      const state = normalizeState(parts[1]);
      if (!state) return ussd('END State not recognised. Dial again and enter e.g. Ondo, Lagos, Kano.');

      // Step 2: town / LGA (free text)
      if (parts.length === 2) return ussd('CON Enter your Town/LGA:');
      const lga = parts[2].trim().slice(0, 60);

      // Step 3: nature of emergency
      if (parts.length === 3) {
        return ussd(
          'CON What is happening?\n' +
          '1. Many people sick\n' +
          '2. Death(s)\n' +
          '3. Unsafe water\n' +
          '4. Other',
        );
      }

      const CATEGORY: Record<string, string> = {
        '1': 'mass_illness', '2': 'death', '3': 'unsafe_water', '4': 'other',
      };
      const category = CATEGORY[parts[3]] ?? 'other';
      if (!phone) return ussd('END Could not read your number. Please try again.');

      const { error } = await admin.from('emergency_reports').insert({
        msisdn: phone, state, lga: lga || null, category, raw_text: text, status: 'new',
      });
      if (error) return ussd('END Could not save your report right now. If in danger, call 112 now.');

      return ussd(
        `END Report received for ${lga || state}. Health authorities are alerted to check the area. ` +
        'If life is in danger NOW, call 112. (This is not an ambulance service.)',
      );
    }

    // ── 5. Health updates & tips ───────────────────────────────────────────
    // Reads the auto-ingested health_posts feed (official updates + tips).
    if (choice === '5') {
      if (parts.length === 1) {
        return ussd('CON Health updates & tips\n1. Latest health update\n2. A prevention tip');
      }
      if (parts[1] === '1') {
        const { data } = await admin
          .from('health_posts')
          .select('title, summary, source')
          .eq('status', 'published')
          .in('category', ['official_update', 'outbreak_news'])
          .order('published_at', { ascending: false })
          .limit(1);
        if (!data || !data.length) return ussd('END No health updates right now. Stay safe.');
        const p = data[0] as Record<string, string>;
        return ussd(`END ${p.source || 'NCDC'}: ${String(p.title).slice(0, 100)}\n` +
          `${String(p.summary || '').slice(0, 130)}`);
      }
      if (parts[1] === '2') {
        const { data } = await admin
          .from('health_posts')
          .select('title, body')
          .eq('status', 'published').eq('category', 'prevention_tip')
          .order('published_at', { ascending: false }).limit(20);
        const tips = (data ?? []) as Array<Record<string, string>>;
        if (!tips.length) return ussd('END No tips available right now.');
        // rotate by day so repeat dials show variety
        const t = tips[Math.floor(Date.now() / 86_400_000) % tips.length];
        return ussd(`END Tip — ${String(t.title)}\n${String(t.body).slice(0, 150)}`);
      }
      return ussd('END Invalid choice. Please dial again.');
    }

    return ussd('END Invalid choice. Please dial again.');
  } catch (_e) {
    return ussd('END Something went wrong. Please try again later.');
  }
});
