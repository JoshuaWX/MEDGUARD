import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient, tryCreateAdminClient } from '../_shared/supabase.ts';
import {
  type WeatherData,
  type ForecastData,
  type AQIData,
  type RiskAssessment,
  assessDiseaseRisks,
  getAQIInsight,
  getNigeriaSeason,
  HEALTH_DISCLAIMER,
} from '../_shared/risk-engine.ts';

// OpenWeather API key from environment
const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY') || '';

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

async function fetchWeather(lat: number, lon: number): Promise<{
  current: WeatherData;
  forecast: ForecastData | null;
  source: string;
} | null> {
  // Try OpenWeather first, fallback to Open-Meteo
  if (OPENWEATHER_API_KEY) {
    try {
      // Fetch current weather, forecast, and AQI in parallel
      const [currentRes, forecastRes] = await Promise.all([
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
        ),
        fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=16&appid=${OPENWEATHER_API_KEY}`
        ),
      ]);

      if (currentRes.ok) {
        const currentData: any = await currentRes.json();
        
        // Parse forecast data (5-day / 3-hour intervals, we take 5 days)
        let forecast: ForecastData | null = null;
        if (forecastRes.ok) {
          const forecastData: any = await forecastRes.json();
          const dailyMap = new Map<string, { maxTemps: number[]; minTemps: number[]; precipitation: number[] }>();
          
          for (const item of forecastData.list || []) {
            const date = item.dt_txt.split(' ')[0];
            if (!dailyMap.has(date)) {
              dailyMap.set(date, { maxTemps: [], minTemps: [], precipitation: [] });
            }
            const day = dailyMap.get(date)!;
            day.maxTemps.push(item.main.temp_max);
            day.minTemps.push(item.main.temp_min);
            day.precipitation.push((item.rain?.['3h'] || 0) + (item.snow?.['3h'] || 0));
          }
          
          const dates: string[] = [];
          const maxTemps: number[] = [];
          const minTemps: number[] = [];
          const precipitation: number[] = [];
          
          for (const [date, data] of dailyMap.entries()) {
            dates.push(date);
            maxTemps.push(Math.max(...data.maxTemps));
            minTemps.push(Math.min(...data.minTemps));
            precipitation.push(data.precipitation.reduce((a, b) => a + b, 0));
          }
          
          forecast = { dates, maxTemps, minTemps, precipitation };
        }

        return {
          current: {
            temp: currentData.main?.temp ?? 0,
            humidity: currentData.main?.humidity ?? 0,
            precipitation: (currentData.rain?.['1h'] || 0) + (currentData.snow?.['1h'] || 0),
            windSpeed: currentData.wind?.speed,
            weatherCode: currentData.weather?.[0]?.id,
          },
          forecast,
          source: 'OpenWeather',
        };
      }
    } catch (err) {
      console.error('OpenWeather fetch error:', err);
    }
  }

  // Fallback to Open-Meteo (no API key required)
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FLagos&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      current: {
        temp: data.current?.temperature_2m ?? 0,
        humidity: data.current?.relative_humidity_2m ?? 0,
        precipitation: data.current?.precipitation ?? 0,
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

// Fetch Air Quality Index from OpenWeather
async function fetchAQI(lat: number, lon: number): Promise<AQIData | null> {
  if (!OPENWEATHER_API_KEY) return null;
  
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
    );
    
    if (!res.ok) return null;
    
    const data: any = await res.json();
    const list = data.list?.[0];
    
    if (!list) return null;
    
    return {
      aqi: list.main?.aqi ?? 1,
      pm2_5: list.components?.pm2_5,
      pm10: list.components?.pm10,
      o3: list.components?.o3,
      no2: list.components?.no2,
      so2: list.components?.so2,
      co: list.components?.co,
    };
  } catch (err) {
    console.error('AQI fetch error:', err);
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
        .eq('scope', 'v2')  // Use new scope for v2 response format
        .maybeSingle();

      if (cached?.payload && cached?.expires_at) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          return jsonResponse(cached.payload);
        }
      }
    }

    const coords = NIGERIA_STATE_COORDS[stateNormalized] || { lat: 9.082, lon: 8.6753 };
    
    // Fetch all data in parallel: weather, AQI, outbreaks, WHO alerts
    const [weatherResult, aqiResult, outbreaks, whoAlerts] = await Promise.all([
      fetchWeather(coords.lat, coords.lon),
      fetchAQI(coords.lat, coords.lon),
      fetchOutbreakData(),
      fetchWHOAlerts(),
    ]);

    // Prepare weather data for risk engine
    const weatherData: WeatherData | null = weatherResult?.current ?? null;
    const forecastData: ForecastData | null = weatherResult?.forecast ?? null;

    // Calculate disease risks using the risk engine
    let riskAssessment: RiskAssessment | null = null;
    if (weatherData) {
      riskAssessment = assessDiseaseRisks(weatherData, forecastData, stateNormalized);
    }

    // Get AQI insights if available
    const aqiInsight = aqiResult ? getAQIInsight(aqiResult) : null;

    // Get season info
    const now = new Date();
    const season = getNigeriaSeason(now.getMonth(), stateNormalized);

    // Build comprehensive response
    const response = {
      generatedAt: now.toISOString(),
      version: 'v2',
      
      location: {
        state,
        stateNormalized,
        isKnownState: NIGERIA_STATES.includes(stateNormalized),
        coordinates: coords,
        region: riskAssessment?.location.region ?? null,
      },
      
      season,
      
      weather: weatherResult ? {
        current: {
          temp: weatherData?.temp,
          humidity: weatherData?.humidity,
          precipitation: weatherData?.precipitation,
          windSpeed: weatherData?.windSpeed,
        },
        forecast: forecastData,
        source: weatherResult.source,
      } : null,
      
      // NEW: Air Quality data
      airQuality: aqiResult ? {
        aqi: aqiResult.aqi,
        insight: aqiInsight,
        pollutants: {
          pm2_5: aqiResult.pm2_5,
          pm10: aqiResult.pm10,
          o3: aqiResult.o3,
          no2: aqiResult.no2,
        },
        source: 'OpenWeather',
      } : null,
      
      // NEW: Disease risk assessment
      riskAssessment: riskAssessment ? {
        overallRiskLevel: riskAssessment.overallRiskLevel,
        diseases: riskAssessment.diseases,
        disclaimer: riskAssessment.disclaimer,
      } : null,
      
      // Legacy advisories format (for backward compatibility)
      advisories: riskAssessment?.diseases
        .filter(d => d.isActive)
        .map(d => ({
          disease: d.disease,
          severity: d.riskLevel,
          summary: d.reasons[0] || 'Elevated risk conditions detected',
          recommendation: d.actions[0] || 'Take standard precautions',
          source: d.sources.join(', '),
          riskLevel: d.riskLevel,
          confidence: d.confidence,
        })) ?? [],
      
      outbreaks,
      whoAlerts,
      
      sources: [
        { name: 'NCDC Nigeria', url: 'https://ncdc.gov.ng/' },
        { name: 'WHO Africa', url: 'https://www.afro.who.int/' },
        { name: weatherResult?.source ?? 'OpenWeather', url: weatherResult?.source === 'OpenWeather' ? 'https://openweathermap.org/' : 'https://open-meteo.com/' },
        { name: 'Disease.sh', url: 'https://disease.sh/' },
      ],
      
      meta: {
        version: 'edge-v2',
        note: 'Enhanced intel with OpenWeather, AQI, and disease risk assessment',
        disclaimer: HEALTH_DISCLAIMER,
        dataFreshness: {
          weather: weatherResult ? 'live' : 'unavailable',
          aqi: aqiResult ? 'live' : 'unavailable',
          outbreaks: outbreaks.length > 0 ? 'live' : 'none_active',
          whoAlerts: whoAlerts.length > 0 ? 'live' : 'none_relevant',
          riskAssessment: riskAssessment ? 'computed' : 'unavailable',
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
          scope: 'v2',
        });
    }

    return jsonResponse(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Intel fetch failed' }, { status: 500 });
  }
});
