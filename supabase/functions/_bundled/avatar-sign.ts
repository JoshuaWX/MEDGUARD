// STANDALONE BUNDLED VERSION - for Supabase Dashboard deployment
// @deno-types="https://deno.land/std@0.224.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

// ============ Inlined from _shared/cors.ts ============
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============ Inlined from _shared/env.ts ============
function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

// ============ Inlined from _shared/supabase.ts ============
function createUserClient(req: Request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

function createAdminClient() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ============ Main function code ============
interface SignRequest {
  path?: string;
  expiresIn?: number;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  try {
    const body: SignRequest = await req.json().catch(() => ({}));
    const path = typeof body?.path === 'string' ? body.path.trim() : '';
    const expiresIn = clampInt(body?.expiresIn, 60, 60 * 60 * 24, 3600);

    if (!path) return jsonResponse({ error: 'path is required' }, { status: 400 });

    const userClient = createUserClient(req);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userData.user.id;
    if (!path.startsWith(`${userId}/`)) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage.from('avatars').createSignedUrl(path, expiresIn);
    if (error) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }

    return jsonResponse({ url: data?.signedUrl || null, expiresIn });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Unexpected error' }, { status: 500 });
  }
});
