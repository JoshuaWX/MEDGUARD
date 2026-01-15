import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient, tryCreateAdminClient } from '../_shared/supabase.ts';

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

// State coordinates for weather lookup (approximate centers)
const NIGERIA_STATE_COORDS: Record<string, { lat: number; lon: number }> = {
  lagos: { lat: 6.5244, lon: 3.3792 },
  kano: { lat: 12.0022, lon: 8.592 },
  abuja: { lat: 9.0579, lon: 7.4951 },
  fct: { lat: 9.0579, lon: 7.4951 },
  rivers: { lat: 4.8156, lon: 7.0498 },
  oyo: { lat: 7.85, lon: 3.9333 },
  kaduna: { lat: 10.5222, lon: 7.4383 },
  ogun: { lat: 6.9098, lon: 3.2584 },
  enugu: { lat: 6.4584, lon: 7.5464 },
  delta: { lat: 5.704, lon: 5.9339 },
  anambra: { lat: 6.2209, lon: 6.937 },
  imo: { lat: 5.572, lon: 7.0588 },
  benue: { lat: 7.3369, lon: 8.7404 },
  borno: { lat: 11.8333, lon: 13.151 },
  plateau: { lat: 9.2182, lon: 9.5175 },
  osun: { lat: 7.5629, lon: 4.52 },
  ondo: { lat: 7.1, lon: 4.8417 },
  ekiti: { lat: 7.719, lon: 5.311 },
  kwara: { lat: 8.9669, lon: 4.3874 },
  edo: { lat: 6.6342, lon: 5.9304 },
  kogi: { lat: 7.7337, lon: 6.6906 },
  niger: { lat: 9.9309, lon: 5.5983 },
  sokoto: { lat: 13.0622, lon: 5.2339 },
  kebbi: { lat: 12.4539, lon: 4.1975 },
  zamfara: { lat: 12.1704, lon: 6.2536 },
  katsina: { lat: 13.0078, lon: 7.6006 },
  jigawa: { lat: 12.228, lon: 9.5616 },
  bauchi: { lat: 10.3158, lon: 9.8442 },
  gombe: { lat: 10.2897, lon: 11.1673 },
  adamawa: { lat: 9.3265, lon: 12.3984 },
  yobe: { lat: 12.2939, lon: 11.439 },
  taraba: { lat: 8.8904, lon: 11.3596 },
  nasarawa: { lat: 8.5388, lon: 8.3228 },
  'cross river': { lat: 5.9631, lon: 8.33 },
  'akwa ibom': { lat: 5.051, lon: 7.9335 },
  abia: { lat: 5.532, lon: 7.486 },
  ebonyi: { lat: 6.2649, lon: 8.0137 },
  bayelsa: { lat: 4.7719, lon: 6.0699 },
};

const NIGERIA_STATES = [
  'abia','adamawa','akwa ibom','anambra','bauchi','bayelsa','benue','borno',
  'cross river','delta','ebonyi','edo','ekiti','enugu','gombe','imo','jigawa',
  'kaduna','kano','katsina','kebbi','kogi','kwara','lagos','nasarawa','niger',
  'ogun','ondo','osun','oyo','plateau','rivers','sokoto','taraba','yobe','zamfara',
  'fct','abuja'
];

async function fetchWeather(lat: number, lon: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FLagos&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      current: {
        temp: data.current?.temperature_2m,
        humidity: data.current?.relative_humidity_2m,
        precipitation: data.current?.precipitation,
        weatherCode: data.current?.weather_code,
      },
      forecast: data.daily ? {
        dates: data.daily.time,
        maxTemps: data.daily.temperature_2m_max,
        minTemps: data.daily.temperature_2m_min,
        precipitation: data.daily.precipitation_sum,
      } : null,
      source: 'Open-Meteo',
    };
  } catch {
    return null;
  }
}

async function fetchOutbreakData() {
  try {
    const [nigeriaRes, globalRes] = await Promise.all([
      fetch('https://disease.sh/v3/covid-19/countries/nigeria'),
      fetch('https://disease.sh/v3/covid-19/all'),
    ]);

    const outbreaks: any[] = [];

    if (nigeriaRes.ok) {
      const ng: any = await nigeriaRes.json();
      if (ng.todayCases > 100 || ng.active > 5000) {
        outbreaks.push({
          disease: 'COVID-19',
          region: 'Nigeria',
          severity: ng.todayCases > 500 ? 'high' : 'moderate',
          cases: ng.cases,
          active: ng.active,
          todayCases: ng.todayCases,
          updated: new Date(ng.updated).toISOString(),
          source: 'Disease.sh / Johns Hopkins CSSE',
        });
      }
    }

    if (globalRes.ok) {
      const gl: any = await globalRes.json();
      if (gl.todayCases > 100000) {
        outbreaks.push({
          disease: 'COVID-19',
          region: 'Global',
          severity: 'moderate',
          summary: `Global surge: ${Number(gl.todayCases).toLocaleString()} new cases today`,
          source: 'Disease.sh',
        });
      }
    }

    return outbreaks;
  } catch {
    return [];
  }
}

async function fetchWHOAlerts() {
  try {
    const res = await fetch('https://www.who.int/feeds/entity/csr/don/en/rss.xml', {
      headers: { 'User-Agent': 'MedGuard/1.0' },
    });
    if (!res.ok) return [];

    const text = await res.text();
    const alerts: any[] = [];

    const titleMatches = text.match(/<title>([^<]+)<\/title>/g) || [];
    const linkMatches = text.match(/<link>([^<]+)<\/link>/g) || [];

    for (let i = 1; i < Math.min(4, titleMatches.length); i++) {
      const title = titleMatches[i]?.replace(/<\/?title>/g, '') || '';
      const link = linkMatches[i]?.replace(/<\/?link>/g, '') || '';
      const lower = title.toLowerCase();
      if (title && (lower.includes('nigeria') || lower.includes('africa'))) {
        alerts.push({
          title: title.trim(),
          url: link.trim(),
          source: 'WHO Disease Outbreak News',
        });
      }
    }

    return alerts.slice(0, 2);
  } catch {
    return [];
  }
}

function getWeatherHealthRisks(weather: any) {
  const risks: any[] = [];
  if (!weather?.current) return risks;

  const { temp, humidity, precipitation } = weather.current;

  if (humidity > 70 && temp > 25) {
    risks.push({
      type: 'environmental',
      factor: 'High humidity and warm temperatures',
      impact: 'Increased mosquito breeding - higher malaria/dengue risk',
      severity: 'moderate',
    });
  }

  if (precipitation > 10) {
    risks.push({
      type: 'environmental',
      factor: 'Heavy rainfall detected',
      impact: 'Flooding risk - potential water contamination and cholera',
      severity: 'high',
    });
  }

  if (temp > 38) {
    risks.push({
      type: 'environmental',
      factor: 'Extreme heat',
      impact: 'Heat stroke risk - stay hydrated, avoid midday sun',
      severity: 'high',
    });
  }

  if (humidity < 30) {
    risks.push({
      type: 'environmental',
      factor: 'Very dry conditions (Harmattan)',
      impact: 'Respiratory irritation, meningitis risk in northern states',
      severity: 'moderate',
    });
  }

  return risks;
}

function getNigeriaSeason(month: number, state: string) {
  const northernStates = [
    'borno','yobe','adamawa','gombe','bauchi','jigawa','kano','katsina','kebbi','sokoto','zamfara','kaduna','niger','plateau','nasarawa','taraba','benue','kogi','kwara','fct','abuja'
  ];
  const isNorth = northernStates.includes((state || '').toLowerCase());

  if (month >= 11 || month <= 1) {
    return { label: 'harmattan', description: 'Dry, dusty Harmattan winds from the Sahara', confidence: 0.8 };
  } else if (month >= 2 && month <= 3) {
    return { label: 'dry', description: 'Late dry season, transitioning to rains', confidence: 0.7 };
  } else if (month >= 4 && month <= 10) {
    if (isNorth && (month <= 5 || month >= 9)) {
      return { label: 'dry', description: 'Northern Nigeria dry period', confidence: 0.6 };
    }
    return { label: 'rainy', description: 'Rainy season - increased malaria and waterborne disease risk', confidence: 0.8 };
  }
  return { label: 'unknown', description: 'Season data unavailable', confidence: 0 };
}

function getSeasonalDiseaseIntel(season: any, state: string) {
  const intel: any[] = [];
  const stateLower = (state || '').toLowerCase();

  if (season.label === 'rainy') {
    intel.push({
      disease: 'Malaria',
      severity: 'high',
      summary: 'Malaria cases typically peak during rainy season due to increased mosquito breeding.',
      recommendation: 'Use insecticide-treated nets, clear stagnant water around homes.',
      source: 'NCDC Seasonal Advisory',
    });

    intel.push({
      disease: 'Cholera',
      severity: 'moderate',
      summary: 'Cholera risk increases with flooding and contaminated water sources.',
      recommendation: 'Drink only treated/boiled water, wash hands frequently.',
      source: 'NCDC Advisory',
    });
  }

  const meningitisBelt = ['borno','yobe','adamawa','gombe','bauchi','jigawa','kano','katsina','kebbi','sokoto','zamfara','kaduna','niger'];
  if ((season.label === 'dry' || season.label === 'harmattan') && meningitisBelt.includes(stateLower)) {
    intel.push({
      disease: 'Meningitis',
      severity: 'high',
      summary: 'Cerebrospinal meningitis season in the meningitis belt (Dec-May).',
      recommendation: 'Get vaccinated if available, avoid overcrowded spaces, seek care for severe headache + stiff neck.',
      source: 'NCDC Meningitis Advisory',
    });
  }

  const lassaEndemicStates = ['ondo','edo','ebonyi','bauchi','plateau','taraba','nasarawa','benue','kogi','ogun','oyo','osun','ekiti','kwara'];
  if ((season.label === 'dry' || season.label === 'harmattan') && lassaEndemicStates.includes(stateLower)) {
    intel.push({
      disease: 'Lassa Fever',
      severity: 'moderate',
      summary: 'Lassa fever season peaks Nov-Mar in endemic states.',
      recommendation: 'Store food in rodent-proof containers, maintain hygiene, avoid contact with rodents.',
      source: 'NCDC Lassa Fever Advisory',
    });
  }

  return intel;
}

const INTEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let state = '';

    if (req.method === 'POST') {
      const body: any = await req.json().catch(() => ({}));
      state = typeof body?.state === 'string' ? body.state : '';
    } else {
      state = new URL(req.url).searchParams.get('state') || '';
    }

    state = state.trim();

    // If no state provided but user is authenticated, try to read from profile
    if (!state && req.headers.get('Authorization')) {
      const userClient = createUserClient(req);
      const { data: userData } = await userClient.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        const { data: profile } = await userClient
          .from('profiles')
          .select('state')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.state) state = profile.state;
      }
    }

    const stateNormalized = state.toLowerCase().trim();
    if (!stateNormalized) {
      return jsonResponse({
        error: 'Missing state parameter. Provide state or authenticate with a profile that has state set.',
      }, { status: 400 });
    }

    // Check DB cache first (intel_cache). If service role is not configured, skip cache.
    const admin = tryCreateAdminClient();
    if (admin) {
      const { data: cached } = await admin
        .from('intel_cache')
        .select('payload, expires_at')
        .eq('region_key', stateNormalized)
        .eq('scope', 'general')
        .maybeSingle();

      if (cached?.payload && cached?.expires_at) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          return jsonResponse(cached.payload);
        }
      }
    }

    const now = new Date();
    const month = now.getMonth();
    const season = getNigeriaSeason(month, stateNormalized);
    const diseaseIntel = getSeasonalDiseaseIntel(season, stateNormalized);

    const coords = NIGERIA_STATE_COORDS[stateNormalized] || { lat: 9.082, lon: 8.6753 };
    const [weather, outbreaks, whoAlerts] = await Promise.all([
      fetchWeather(coords.lat, coords.lon),
      fetchOutbreakData(),
      fetchWHOAlerts(),
    ]);

    const weatherRisks = getWeatherHealthRisks(weather);
    const enhancedAdvisories = [...diseaseIntel];
    for (const risk of weatherRisks) {
      enhancedAdvisories.push({
        disease: risk.factor,
        severity: risk.severity,
        summary: risk.impact,
        recommendation: risk.type === 'environmental' ? 'Monitor conditions and take precautions.' : '',
        source: 'Real-time Weather Analysis',
        isWeatherBased: true,
      });
    }

    const response: any = {
      generatedAt: now.toISOString(),
      location: {
        state,
        stateNormalized,
        isKnownState: NIGERIA_STATES.includes(stateNormalized),
        coordinates: coords,
      },
      season,
      weather: weather ? {
        current: weather.current,
        forecast: weather.forecast,
        source: weather.source,
      } : null,
      advisories: enhancedAdvisories,
      outbreaks,
      whoAlerts,
      sources: [
        { name: 'NCDC Nigeria', url: 'https://ncdc.gov.ng/' },
        { name: 'WHO Africa', url: 'https://www.afro.who.int/' },
        { name: 'Open-Meteo Weather', url: 'https://open-meteo.com/' },
        { name: 'Disease.sh', url: 'https://disease.sh/' },
      ],
      meta: {
        version: 'edge-v1',
        note: 'Edge function: intel aggregation + DB cache.',
        dataFreshness: {
          weather: weather ? 'live' : 'unavailable',
          outbreaks: outbreaks.length > 0 ? 'live' : 'none_active',
          whoAlerts: whoAlerts.length > 0 ? 'live' : 'none_relevant',
        },
      },
    };

    // Upsert cache (best-effort)
    if (admin) {
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + INTEL_CACHE_TTL_MS).toISOString();

      await admin
        .from('intel_cache')
        .upsert({
          region_key: stateNormalized,
          scope: 'general',
          payload: response,
          fetched_at: nowIso,
          expires_at: expiresAt,
        });
    }

    return jsonResponse(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Intel fetch failed' }, { status: 500 });
  }
});
