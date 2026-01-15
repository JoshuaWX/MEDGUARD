import { createClient } from 'npm:@supabase/supabase-js@2.48.1';
import { optionalEnv, requiredEnv } from './env.ts';

export function createUserClient(req: Request) {
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

export function createAdminClient() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export function tryCreateAdminClient() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
