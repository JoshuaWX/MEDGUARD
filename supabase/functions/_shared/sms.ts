/**
 * Shared Africa's Talking SMS sender + config, reused by dispatch-sms-alerts and
 * dispatch-health-posts. If no AT_API_KEY is set the caller runs in SIMULATE mode
 * (log to sms_outbox, don't send) so the whole flow stays demoable.
 */

export interface AtConfig {
  apiKey: string;
  username: string;
  sender: string | null;
  env: string;
  simulate: boolean;
}

export function readAtConfig(): AtConfig {
  const apiKey = Deno.env.get('AT_API_KEY') ?? '';
  return {
    apiKey,
    username: Deno.env.get('AT_USERNAME') ?? 'sandbox',
    sender: Deno.env.get('AT_SENDER') || null,
    env: Deno.env.get('AT_ENV') ?? 'sandbox',
    simulate: !apiKey, // no creds → log-only
  };
}

/** Trim a body to a sane multi-segment SMS length (cost control) without cutting mid-word. */
export function smsClamp(text: string, maxLen = 450): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export async function sendViaAfricasTalking(
  cfg: AtConfig, to: string[], message: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const base = cfg.env === 'production'
    ? 'https://api.africastalking.com'
    : 'https://api.sandbox.africastalking.com';
  const form = new URLSearchParams({ username: cfg.username, to: to.join(','), message });
  if (cfg.sender) form.set('from', cfg.sender);
  try {
    const res = await fetch(`${base}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey: cfg.apiKey,
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
