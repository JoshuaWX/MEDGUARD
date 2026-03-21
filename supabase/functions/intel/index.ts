import { serve } from 'std/http/server';
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
import { enforceRateLimit } from '../_shared/rate-limit.ts';

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
        type OpenWeatherCurrent = { main?: { temp?: number; humidity?: number; temp_max?: number; temp_min?: number }; rain?: { '1h'?: number }; snow?: { '1h'?: number }; weather?: Array<{ main?: string; id?: number }>; wind?: { speed?: number } };
        const currentData = await currentRes.json() as OpenWeatherCurrent;
        
        // Parse forecast data (5-day / 3-hour intervals, we take 5 days)
        let forecast: ForecastData | null = null;
        if (forecastRes.ok) {
          type OpenWeatherForecast = { list?: Array<{ dt_txt: string; main: { temp_max: number; temp_min: number }; rain?: { '3h'?: number }; snow?: { '3h'?: number } }> };
          const forecastData = await forecastRes.json() as OpenWeatherForecast;
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
    type OpenMeteoResponse = { current?: { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number; weather_code?: number }; daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] } };
    const data = await res.json() as OpenMeteoResponse;
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
    
    type AQIResponse = { list?: Array<{ main?: { aqi?: number }; components?: { pm2_5?: number; pm10?: number; o3?: number; no2?: number; so2?: number; co?: number } }> };
    const data = await res.json() as AQIResponse;
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

    type OutbreakInfo = { disease: string; region: string; severity: string; cases?: number; active?: number; todayCases?: number; updated?: string; summary?: string; source: string };
    const outbreaks: OutbreakInfo[] = [];

    if (nigeriaRes.ok) {
      type NigeriaCovidResponse = { cases?: number; active?: number; todayCases?: number; updated?: number };
      const ng = await nigeriaRes.json() as NigeriaCovidResponse;
      if ((ng.todayCases ?? 0) > 100 || (ng.active ?? 0) > 5000) {
        outbreaks.push({
          disease: 'COVID-19',
          region: 'Nigeria',
          severity: (ng.todayCases ?? 0) > 500 ? 'high' : 'moderate',
          cases: ng.cases,
          active: ng.active,
          todayCases: ng.todayCases,
          updated: ng.updated ? new Date(ng.updated).toISOString() : new Date().toISOString(),
          source: 'Disease.sh / Johns Hopkins CSSE',
        });
      }
    }

    if (globalRes.ok) {
      type GlobalCovidResponse = { todayCases?: number };
      const gl = await globalRes.json() as GlobalCovidResponse;
      if ((gl.todayCases ?? 0) > 100000) {
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
    type WHOAlert = { title: string; url: string; source: string };
    const alerts: WHOAlert[] = [];

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

const _INTEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INTEL_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 30,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let state = '';
    let lat: number | null = null;
    let lon: number | null = null;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as { state?: string; lat?: number; lon?: number; latitude?: number; longitude?: number };
      state = typeof body?.state === 'string' ? body.state : '';
      // Accept both lat/lon and latitude/longitude
      lat = typeof body?.lat === 'number' ? body.lat : (typeof body?.latitude === 'number' ? body.latitude : null);
      lon = typeof body?.lon === 'number' ? body.lon : (typeof body?.longitude === 'number' ? body.longitude : null);
    } else {
      const params = new URL(req.url).searchParams;
      state = params.get('state') || '';
      const latParam = params.get('lat') || params.get('latitude');
      const lonParam = params.get('lon') || params.get('longitude');
      if (latParam) lat = parseFloat(latParam);
      if (lonParam) lon = parseFloat(lonParam);
    }

    state = state.trim();

    // If no state provided but user is authenticated, try to read from profile
    let authUserId: string | null = null;
    if (!state && req.headers.get('Authorization')) {
      const userClient = createUserClient(req);
      const { data: userData } = await userClient.auth.getUser();
      const userId = userData?.user?.id;
      authUserId = userId || null;
      if (userId) {
        const { data: profile } = await userClient
          .from('profiles')
          .select('state')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.state) state = profile.state;
      }
    } else if (req.headers.get('Authorization')) {
      const userClient = createUserClient(req);
      const { data: userData } = await userClient.auth.getUser();
      authUserId = userData?.user?.id || null;
    }

    const rate = await enforceRateLimit(req, {
      bucket: 'intel',
      windowSeconds: INTEL_RATE_LIMIT.windowSeconds,
      maxRequests: INTEL_RATE_LIMIT.maxRequests,
      userId: authUserId,
    });
    if (rate && !rate.allowed) {
      return jsonResponse(
        {
          error: 'Too many intel requests. Please wait and try again.',
          retryAfterSeconds: rate.retryAfterSeconds,
          resetAt: rate.resetAt,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    const stateNormalized = state.toLowerCase().trim();
    if (!stateNormalized) {
      return jsonResponse({
        error: 'Missing state parameter. Provide state or authenticate with a profile that has state set.',
      }, { status: 400 });
    }

    // Check DB cache first (intel_cache). If service role is not configured, skip cache.
    const admin = tryCreateAdminClient();
    
    // Use precise coordinates if provided, otherwise fall back to state center
    const usePreciseCoords = lat !== null && lon !== null && 
      Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    
    const coords = usePreciseCoords 
      ? { lat: lat!, lon: lon! }
      : (NIGERIA_STATE_COORDS[stateNormalized] || { lat: 9.082, lon: 8.6753 });
    
    // Cache key includes coordinates for precision (rounded to 2 decimal places for reasonable cache hits)
    const cacheKey = usePreciseCoords 
      ? `${stateNormalized}_${coords.lat.toFixed(2)}_${coords.lon.toFixed(2)}`
      : stateNormalized;
    
    if (admin) {
      const { data: cached } = await admin
        .from('intel_cache')
        .select('payload, expires_at')
        .eq('region_key', cacheKey)
        .eq('scope', 'v2')  // Use new scope for v2 response format
        .maybeSingle();

      if (cached?.payload && cached?.expires_at) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          return jsonResponse(cached.payload);
        }
      }
    }
    
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

    // Get AQI insights if available (health-first calculation happens inside getAQIInsight)
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
        preciseLocation: usePreciseCoords,  // true if using user's GPS, false if using state center
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
      
      // NEW: Air Quality data with health-first AQI calculation
      // AQI is computed from pollutant concentrations using "worst pollutant" approach
      // Priority: PM2.5 > PM10 > CO > NO₂ (see risk-engine.ts for details)
      airQuality: aqiResult ? {
        aqi: aqiResult.aqi,
        insight: aqiInsight,
        // Keep a lightweight pollutant object for UI convenience.
        // PM2.5/PM10 include status so the app can show health-oriented badges.
        pollutants: {
          pm2_5: aqiInsight?.pollutants?.pm2_5,
          pm10: aqiInsight?.pollutants?.pm10,
          o3: aqiResult.o3,
          no2: aqiResult.no2,
          co: aqiResult.co,
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

    // Upsert cache (best-effort) with 15 minute TTL
    if (admin) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await admin
        .from('intel_cache')
        .upsert({
          region_key: cacheKey,
          scope: 'v2',
          payload: response,
          expires_at: expiresAt,
        });
    }

    return jsonResponse(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Intel fetch failed' }, { status: 500 });
  }
});
