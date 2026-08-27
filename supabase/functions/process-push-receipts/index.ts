import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { getExpoReceipts } from '../_shared/push.ts';
import { requireCronSecret } from '../_shared/request-auth.ts';

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = requireCronSecret(req); if (!auth.ok) return json({ error: auth.error }, auth.status);
  const admin = tryCreateAdminClient(); if (!admin) return json({ error: 'service_role_not_configured' }, 500);
  const { data: logs, error } = await admin.from('notification_log').select('id, expo_ticket_id, push_device_id')
    .eq('status', 'accepted').not('expo_ticket_id', 'is', null).order('created_at', { ascending: true }).limit(300);
  if (error) return json({ error: 'load_failed' }, 500);
  const rows = (logs ?? []) as Array<{ id: string; expo_ticket_id: string; push_device_id: string | null }>;
  const receipts = await getExpoReceipts(rows.map((row) => row.expo_ticket_id));
  let processed = 0;
  for (const row of rows) {
    const receipt = receipts.get(row.expo_ticket_id); if (!receipt) continue;
    await admin.from('notification_log').update({ status: receipt.status, error_message: receipt.error ?? null, receipt_checked_at: new Date().toISOString() }).eq('id', row.id);
    if (receipt.status === 'invalid_device' && row.push_device_id) {
      await admin.from('push_devices').update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.push_device_id);
    }
    processed += 1;
  }
  return json({ processed });
});
