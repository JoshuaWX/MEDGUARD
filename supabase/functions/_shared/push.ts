/** Expo Push API helpers. A ticket is acceptance by Expo, not delivery. */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: Record<string, unknown>;
}

export type ExpoTicket = { message: ExpoMessage; status: 'accepted' | 'failed'; ticketId?: string; error?: string };
export type ExpoReceipt = { status: 'receipt_ok' | 'failed' | 'invalid_device'; error?: string };

export function isExpoToken(token: string | null | undefined): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(String(token ?? ''));
}

export async function sendExpoPush(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const outcomes: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch),
      });
      const payload = await response.json().catch(() => null) as { data?: Array<Record<string, unknown>> } | null;
      const tickets = Array.isArray(payload?.data) ? payload!.data! : [];
      for (let offset = 0; offset < batch.length; offset += 1) {
        const ticket = tickets[offset];
        if (response.ok && ticket?.status === 'ok' && typeof ticket.id === 'string') {
          outcomes.push({ message: batch[offset], status: 'accepted', ticketId: ticket.id });
        } else {
          outcomes.push({ message: batch[offset], status: 'failed', error: typeof ticket?.message === 'string' ? ticket.message : `Expo rejected push (${response.status})` });
        }
      }
    } catch {
      outcomes.push(...batch.map((message) => ({ message, status: 'failed' as const, error: 'Expo push request failed' })));
    }
  }
  return outcomes;
}

export async function getExpoReceipts(ticketIds: string[]): Promise<Map<string, ExpoReceipt>> {
  const results = new Map<string, ExpoReceipt>();
  for (let i = 0; i < ticketIds.length; i += 300) {
    const ids = ticketIds.slice(i, i + 300);
    try {
      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ids }),
      });
      const payload = await response.json().catch(() => null) as { data?: Record<string, Record<string, unknown>> } | null;
      if (!response.ok || !payload?.data) continue;
      for (const id of ids) {
        const receipt = payload.data[id];
        if (!receipt) continue;
        if (receipt.status === 'ok') results.set(id, { status: 'receipt_ok' });
        else {
          const details = receipt.details as Record<string, unknown> | undefined;
          const deviceMissing = details?.error === 'DeviceNotRegistered';
          results.set(id, { status: deviceMissing ? 'invalid_device' : 'failed', error: typeof receipt.message === 'string' ? receipt.message : deviceMissing ? 'DeviceNotRegistered' : 'Expo receipt error' });
        }
      }
    } catch {
      // Accepted tickets remain eligible for a later receipt pass.
    }
  }
  return results;
}
