import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

type Platform = 'android' | 'ios';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const platform: Platform = body?.platform === 'ios' ? 'ios' : 'android';

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('app_version_policy')
      .select('platform,min_supported_build,latest_build,force_update,update_url,message')
      .eq('platform', platform)
      .single();

    if (error || !data) {
      console.error('[app-version] policy read failed', error?.message);
      return json({
        platform,
        min_supported_build: 1,
        latest_build: 1,
        force_update: false,
        update_url: '',
        message: 'MedGuard is ready.',
      });
    }

    return json(data);
  } catch (error) {
    console.error('[app-version] unexpected error', error);
    return json({
      error: 'Unable to check app version',
    }, 500);
  }
});
