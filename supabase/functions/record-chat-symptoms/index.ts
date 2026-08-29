import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const ALLOWED = new Set([
  'fever', 'cough', 'headache', 'sore_throat', 'fatigue', 'body_pain', 'nausea',
  'vomiting', 'diarrhea', 'constipation', 'rash', 'itching', 'dizziness', 'chills',
  'breathing', 'chest_pain', 'bleeding', 'weakness', 'runny_nose', 'loss_of_appetite',
  'abdominal_pain', 'back_pain',
]);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  try {
    const body = await request.json() as { conversation_id?: unknown; symptom_keys?: unknown; idempotency_key?: unknown };
    const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : '';
    const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
    const keys = Array.isArray(body.symptom_keys)
      ? [...new Set(body.symptom_keys.filter((key): key is string => typeof key === 'string' && ALLOWED.has(key)))].slice(0, 6)
      : [];
    if (!conversationId || !idempotencyKey || keys.length === 0) return response({ error: 'Select one or more suggested symptoms.' }, 400);

    const supabase = createUserClient(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (authError || !userId) return response({ error: 'Authentication required.' }, 401);
    const rate = await enforceRateLimit(request, { bucket: 'chat_symptom_confirmation', windowSeconds: 60, maxRequests: 6, userId });
    if (rate && !rate.allowed) return response({ error: 'Please wait before trying again.' }, 429);

    const { data: conversation } = await supabase.from('chat_conversations').select('id').eq('id', conversationId).eq('user_id', userId).maybeSingle();
    if (!conversation) return response({ error: 'Chat not found.' }, 404);
    const { error: confirmationError } = await supabase.from('chat_symptom_confirmations').insert({ user_id: userId, conversation_id: conversationId, idempotency_key: idempotencyKey, symptom_keys: keys });
    if (confirmationError) {
      if (confirmationError.code === '23505') return response({ recorded: true, duplicate: true });
      throw confirmationError;
    }
    const { data: profile } = await supabase.from('profiles').select('state').eq('id', userId).maybeSingle();
    const { error: writeError } = await supabase.from('symptom_logs').insert(keys.map((symptom_key) => ({ user_id: userId, symptom_key, source: 'chat_confirmed', state: profile?.state ?? null, occurred_at: new Date().toISOString() })));
    if (writeError) throw writeError;
    console.log(JSON.stringify({ event: 'chat_symptoms_confirmed', count: keys.length }));
    return response({ recorded: true });
  } catch (error) {
    console.warn(JSON.stringify({ event: 'chat_symptom_confirmation_failed', category: error instanceof Error ? error.name : 'unknown' }));
    return response({ error: 'Could not save the selected symptoms. Try again.' }, 500);
  }
});
