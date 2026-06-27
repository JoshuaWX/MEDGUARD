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
import { buildBrainAsync } from '../_shared/brain/buildBrain.ts';
import { toBrainInput } from '../_shared/brain/intelAdapter.ts';
import { loadTrendBaseline } from '../_shared/brain/trendBaseline.ts';
import { loadVerifiedReports } from '../_shared/brain/verifiedReportsLoader.ts';
import { loadPersonalHealthSnapshot } from '../_shared/personalHealth.ts';

// OpenWeather API key from environment
const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY') || '';
// Server-side Google Maps Platform key for the Weather + Air Quality APIs.
// SET AS A SUPABASE SECRET (not EXPO_PUBLIC). For MVP this may reuse the same key
// value as the mobile Maps key, but note: a single key cannot be BOTH
// Android-application-restricted (for the in-app map) AND used server-side here.
// Production should use a separate server key restricted by API + caller IP.
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
const BRAIN_LLM_SUMMARY = (Deno.env.get('BRAIN_LLM_SUMMARY') || '').toLowerCase() === 'true';

// ============================================================================
// PHASE 1: LIGHTWEIGHT STRUCTURED LOGGING
// ----------------------------------------------------------------------------
// Emits single-line JSON logs for observability of the intel function.
// SAFETY: Never log JWTs, API keys, service-role keys, user emails, raw
// personal health records, or raw user/LLM prompts. Only non-sensitive
// operational metadata (event name, source, status, durations, coarse flags)
// is logged here. Coordinates are intentionally NOT logged to avoid leaking
// precise user location; only a coarse "preciseLocation" boolean is recorded.
// This logging does not alter any response behavior.
// ============================================================================
type IntelLogFields = Record<string, string | number | boolean | null | undefined>;

function logIntel(event: string, fields: IntelLogFields = {}): void {
  try {
    const entry: Record<string, unknown> = {
      fn: 'intel',
      event,
      at: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) entry[key] = value;
    }
    console.log(JSON.stringify(entry));
  } catch {
    // Logging must never throw or affect the request lifecycle.
  }
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
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

// Map a weather/AQI provider name to a public docs/source URL for the report page.
function sourceUrl(name: string): string {
  switch (name) {
    case 'Google Weather': return 'https://developers.google.com/maps/documentation/weather';
    case 'Google Air Quality': return 'https://developers.google.com/maps/documentation/air-quality';
    case 'OpenWeather': return 'https://openweathermap.org/';
    case 'Open-Meteo': return 'https://open-meteo.com/';
    case 'Open-Meteo Air Quality': return 'https://open-meteo.com/en/docs/air-quality-api';
    default: return '';
  }
}

// Convert a gas pollutant concentration to µg/m³ (the unit risk-engine thresholds use).
// PM2.5/PM10 already arrive in µg/m³; gases may arrive in ppb.
const GAS_MOLAR_MASS: Record<string, number> = { o3: 48, no2: 46, so2: 64, co: 28 };
function gasToUgm3(code: string, value: number, units: string): number {
  if (units === 'PARTS_PER_BILLION' && GAS_MOLAR_MASS[code]) {
    return value * (GAS_MOLAR_MASS[code] / 24.45);
  }
  return value; // MICROGRAMS_PER_CUBIC_METER or unknown → pass through
}

// Google Weather API (Maps Platform). Returns current + up to 5-day forecast.
async function fetchWeatherGoogle(lat: number, lon: number): Promise<{
  current: WeatherData;
  forecast: ForecastData | null;
  source: string;
} | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  const t0 = performance.now();
  try {
    const base = 'https://weather.googleapis.com/v1';
    const common = `key=${GOOGLE_MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lon}&unitsSystem=METRIC`;
    const [curRes, fcRes] = await Promise.all([
      fetch(`${base}/currentConditions:lookup?${common}`),
      fetch(`${base}/forecast/days:lookup?${common}&days=5`),
    ]);
    if (!curRes.ok) {
      logIntel('fetch_weather_unavailable', { source: 'Google Weather', status: curRes.status, durationMs: elapsedMs(t0) });
      return null;
    }
    type GCurrent = { temperature?: { degrees?: number }; relativeHumidity?: number; precipitation?: { qpf?: { quantity?: number } }; wind?: { speed?: { value?: number } } };
    const cur = await curRes.json() as GCurrent;

    let forecast: ForecastData | null = null;
    if (fcRes.ok) {
      type GForecast = { forecastDays?: Array<{ displayDate?: { year?: number; month?: number; day?: number }; maxTemperature?: { degrees?: number }; minTemperature?: { degrees?: number }; daytimeForecast?: { precipitation?: { qpf?: { quantity?: number } } }; nighttimeForecast?: { precipitation?: { qpf?: { quantity?: number } } } }> };
      const fc = await fcRes.json() as GForecast;
      const dates: string[] = []; const maxTemps: number[] = []; const minTemps: number[] = []; const precipitation: number[] = [];
      for (const d of fc.forecastDays ?? []) {
        const dd = d.displayDate;
        dates.push(dd?.year && dd?.month && dd?.day ? `${dd.year}-${String(dd.month).padStart(2, '0')}-${String(dd.day).padStart(2, '0')}` : '');
        maxTemps.push(d.maxTemperature?.degrees ?? 0);
        minTemps.push(d.minTemperature?.degrees ?? 0);
        precipitation.push((d.daytimeForecast?.precipitation?.qpf?.quantity ?? 0) + (d.nighttimeForecast?.precipitation?.qpf?.quantity ?? 0));
      }
      if (dates.length) forecast = { dates, maxTemps, minTemps, precipitation };
    }

    logIntel('fetch_weather_ok', { source: 'Google Weather', hasForecast: forecast !== null, durationMs: elapsedMs(t0) });
    return {
      current: {
        temp: cur.temperature?.degrees ?? 0,
        humidity: cur.relativeHumidity ?? 0,
        precipitation: cur.precipitation?.qpf?.quantity ?? 0,
        windSpeed: cur.wind?.speed?.value,
      },
      forecast,
      source: 'Google Weather',
    };
  } catch (err) {
    logIntel('fetch_weather_error', { source: 'Google Weather', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// Google Air Quality API. Returns pollutant concentrations (µg/m³) for the
// health-first AQI calculation in risk-engine.ts.
async function fetchAqiGoogle(lat: number, lon: number): Promise<{ data: AQIData; source: string } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  const t0 = performance.now();
  try {
    const res = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_MAPS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lon },
        extraComputations: ['POLLUTANT_CONCENTRATION', 'LOCAL_AQI'],
        languageCode: 'en',
      }),
    });
    if (!res.ok) {
      logIntel('fetch_aqi_unavailable', { source: 'Google Air Quality', status: res.status, durationMs: elapsedMs(t0) });
      return null;
    }
    type GAqi = { indexes?: Array<{ code?: string; aqi?: number }>; pollutants?: Array<{ code?: string; concentration?: { value?: number; units?: string } }> };
    const j = await res.json() as GAqi;
    const conc: Partial<AQIData> = {};
    for (const p of j.pollutants ?? []) {
      const code = (p.code ?? '').toLowerCase();
      const value = p.concentration?.value;
      const units = p.concentration?.units ?? '';
      if (typeof value !== 'number') continue;
      if (code === 'pm25') conc.pm2_5 = value;
      else if (code === 'pm10') conc.pm10 = value;
      else if (code === 'o3') conc.o3 = gasToUgm3('o3', value, units);
      else if (code === 'no2') conc.no2 = gasToUgm3('no2', value, units);
      else if (code === 'so2') conc.so2 = gasToUgm3('so2', value, units);
      else if (code === 'co') conc.co = gasToUgm3('co', value, units);
    }
    // Universal AQI (uaqi) is 0-100 where HIGHER is better. Map to the legacy
    // 1-5 scale (higher = worse) for backward compatibility; the real health
    // level is derived from pollutant concentrations in getAQIInsight().
    const uaqi = (j.indexes ?? []).find((i) => i.code === 'uaqi')?.aqi;
    const aqi5 = typeof uaqi === 'number'
      ? (uaqi >= 80 ? 1 : uaqi >= 60 ? 2 : uaqi >= 40 ? 3 : uaqi >= 20 ? 4 : 5)
      : 1;
    logIntel('fetch_aqi_ok', { source: 'Google Air Quality', durationMs: elapsedMs(t0) });
    return { data: { aqi: aqi5, ...conc }, source: 'Google Air Quality' };
  } catch (err) {
    logIntel('fetch_aqi_error', { source: 'Google Air Quality', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// Open-Meteo Air Quality (CAMS) — free, good global coverage incl. Nigeria where
// Google Air Quality has no data. Concentrations are already µg/m³.
async function fetchAqiOpenMeteo(lat: number, lon: number): Promise<{ data: AQIData; source: string } | null> {
  const t0 = performance.now();
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&timezone=Africa%2FLagos`;
    const res = await fetch(url);
    if (!res.ok) { logIntel('fetch_aqi_unavailable', { source: 'Open-Meteo Air Quality', status: res.status, durationMs: elapsedMs(t0) }); return null; }
    type R = { current?: { pm2_5?: number; pm10?: number; carbon_monoxide?: number; nitrogen_dioxide?: number; sulphur_dioxide?: number; ozone?: number; us_aqi?: number } };
    const j = await res.json() as R;
    const c = j.current;
    if (!c) { logIntel('fetch_aqi_empty', { source: 'Open-Meteo Air Quality', durationMs: elapsedMs(t0) }); return null; }
    const usAqi = c.us_aqi;
    const aqi5 = typeof usAqi === 'number' ? (usAqi <= 50 ? 1 : usAqi <= 100 ? 2 : usAqi <= 150 ? 3 : usAqi <= 200 ? 4 : 5) : 1;
    logIntel('fetch_aqi_ok', { source: 'Open-Meteo Air Quality', durationMs: elapsedMs(t0) });
    return {
      data: { aqi: aqi5, pm2_5: c.pm2_5, pm10: c.pm10, o3: c.ozone, no2: c.nitrogen_dioxide, so2: c.sulphur_dioxide, co: c.carbon_monoxide },
      source: 'Open-Meteo Air Quality',
    };
  } catch (err) {
    logIntel('fetch_aqi_error', { source: 'Open-Meteo Air Quality', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function fetchWeather(lat: number, lon: number): Promise<{
  current: WeatherData;
  forecast: ForecastData | null;
  source: string;
} | null> {
  const t0 = performance.now();
  // Prefer Google Weather (most accurate); fall back to OpenWeather, then Open-Meteo.
  const google = await fetchWeatherGoogle(lat, lon);
  if (google) return google;
  // Try OpenWeather, fallback to Open-Meteo
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

        logIntel('fetch_weather_ok', { source: 'OpenWeather', hasForecast: forecast !== null, durationMs: elapsedMs(t0) });
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
      logIntel('fetch_weather_error', { source: 'OpenWeather', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
      console.error('OpenWeather fetch error:', err);
    }
  }

  // Fallback to Open-Meteo (no API key required)
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FLagos&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) { logIntel('fetch_weather_unavailable', { source: 'Open-Meteo', status: res.status, durationMs: elapsedMs(t0) }); return null; }
    type OpenMeteoResponse = { current?: { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number; weather_code?: number }; daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] } };
    const data = await res.json() as OpenMeteoResponse;
    logIntel('fetch_weather_ok', { source: 'Open-Meteo', hasForecast: data.daily != null, durationMs: elapsedMs(t0) });
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
  } catch (err) {
    logIntel('fetch_weather_error', { source: 'Open-Meteo', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// Fetch Air Quality. Prefer Google Air Quality; fall back to OpenWeather.
async function fetchAQI(lat: number, lon: number): Promise<{ data: AQIData; source: string } | null> {
  const t0 = performance.now();

  // Google Air Quality first (where covered), then Open-Meteo/CAMS (covers
  // Nigeria), then OpenWeather as a last resort.
  const google = await fetchAqiGoogle(lat, lon);
  if (google) return google;

  const openMeteo = await fetchAqiOpenMeteo(lat, lon);
  if (openMeteo) return openMeteo;

  if (!OPENWEATHER_API_KEY) { logIntel('fetch_aqi_skipped', { reason: 'no_api_key' }); return null; }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
    );

    if (!res.ok) { logIntel('fetch_aqi_unavailable', { source: 'OpenWeather', status: res.status, durationMs: elapsedMs(t0) }); return null; }

    type AQIResponse = { list?: Array<{ main?: { aqi?: number }; components?: { pm2_5?: number; pm10?: number; o3?: number; no2?: number; so2?: number; co?: number } }> };
    const data = await res.json() as AQIResponse;
    const list = data.list?.[0];

    if (!list) { logIntel('fetch_aqi_empty', { source: 'OpenWeather', durationMs: elapsedMs(t0) }); return null; }

    logIntel('fetch_aqi_ok', { source: 'OpenWeather', durationMs: elapsedMs(t0) });
    return {
      data: {
        aqi: list.main?.aqi ?? 1,
        pm2_5: list.components?.pm2_5,
        pm10: list.components?.pm10,
        o3: list.components?.o3,
        no2: list.components?.no2,
        so2: list.components?.so2,
        co: list.components?.co,
      },
      source: 'OpenWeather',
    };
  } catch (err) {
    logIntel('fetch_aqi_error', { source: 'OpenWeather', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
    console.error('AQI fetch error:', err);
    return null;
  }
}

async function fetchWHOAlerts() {
  const t0 = performance.now();
  try {
    const res = await fetch('https://www.who.int/feeds/entity/csr/don/en/rss.xml', {
      headers: { 'User-Agent': 'MedGuard/1.0' },
    });
    if (!res.ok) { logIntel('fetch_who_unavailable', { source: 'WHO', status: res.status, durationMs: elapsedMs(t0) }); return []; }

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

    const out = alerts.slice(0, 2);
    logIntel('fetch_who_ok', { source: 'WHO', count: out.length, durationMs: elapsedMs(t0) });
    return out;
  } catch (err) {
    logIntel('fetch_who_error', { source: 'WHO', durationMs: elapsedMs(t0), message: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

const _INTEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INTEL_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 30,
};

// ============================================================================
// PHASE 3: PERSONAL BRAIN (JWT-GATED, NEVER CACHED)
// ----------------------------------------------------------------------------
// Reads the authenticated user's recent check-ins via the RLS-protected user
// client and returns a shallow clone of the payload with `personalBrain`
// attached. SAFETY: only called when a verified user id is present, and the
// result is attached to the RESPONSE ONLY (never written to intel_cache).
// ============================================================================
async function attachPersonalBrain(
  payload: Record<string, unknown>,
  req: Request,
  authUserId: string | null,
  area: string,
): Promise<Record<string, unknown>> {
  if (!authUserId) return payload;
  try {
    const userClient = createUserClient(req);
    const snapshot = await loadPersonalHealthSnapshot(userClient, area, { useLlm: BRAIN_LLM_SUMMARY });
    if (!snapshot) {
      logIntel('personal_brain_skipped', { reason: 'no_personal_data' });
      return payload;
    }
    const personalBrain = snapshot.personalBrain;
    logIntel('personal_brain_built', { riskLevel: personalBrain.riskLevel, confidence: personalBrain.confidence, signals: personalBrain.meta.signalsUsed });
    // Shallow clone so we never mutate the (already-cached) area payload.
    return { ...payload, personalBrain };
  } catch (err) {
    logIntel('personal_brain_error', { message: err instanceof Error ? err.message : String(err) });
    return payload;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const reqStart = performance.now();
  logIntel('request_received', { method: req.method, authenticated: req.headers.get('Authorization') ? true : false });

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
      logIntel('rate_limit_blocked', { bucket: 'intel', retryAfterSeconds: rate.retryAfterSeconds });
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
    if (rate) {
      logIntel('rate_limit_allowed', { bucket: 'intel', remaining: rate.remaining });
    }

    const stateNormalized = state.toLowerCase().trim();
    if (!stateNormalized) {
      logIntel('bad_request', { reason: 'missing_state' });
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
          logIntel('cache_hit', { scope: 'v2', preciseLocation: usePreciseCoords, durationMs: elapsedMs(reqStart) });
          const cachedPayload = cached.payload as Record<string, unknown>;
          const cachedArea = ((cachedPayload.location as Record<string, unknown> | undefined)?.state as string) || state;
          const withPersonal = await attachPersonalBrain(cachedPayload, req, authUserId, cachedArea);
          return jsonResponse(withPersonal);
        }
      }
    }
    
    logIntel('cache_miss', { scope: 'v2', cacheEnabled: admin ? true : false, preciseLocation: usePreciseCoords });

    // Fetch all data in parallel: weather, AQI, WHO official alerts
    const [weatherResult, aqiResult, whoAlerts] = await Promise.all([
      fetchWeather(coords.lat, coords.lon),
      fetchAQI(coords.lat, coords.lon),
      fetchWHOAlerts(),
    ]);

    // Outbreaks now come ONLY from official channels: admin-curated verified_reports
    // (NCDC/WHO-confirmed, loaded below) plus the WHO Disease Outbreak News feed.
    // disease.sh COVID stats were removed — they are not an official Nigerian
    // outbreak source and the app must not imply NCDC confirmation it does not have.
    const outbreaks: never[] = [];

    // Prepare weather data for risk engine
    const weatherData: WeatherData | null = weatherResult?.current ?? null;
    const forecastData: ForecastData | null = weatherResult?.forecast ?? null;

    // Calculate disease risks using the risk engine
    let riskAssessment: RiskAssessment | null = null;
    if (weatherData) {
      riskAssessment = assessDiseaseRisks(weatherData, forecastData, stateNormalized);
    }

    // Get AQI insights if available (health-first calculation happens inside getAQIInsight)
    const aqiInsight = aqiResult ? getAQIInsight(aqiResult.data) : null;

    // Get season info
    const now = new Date();
    const season = getNigeriaSeason(now.getMonth(), stateNormalized);

    // MedGuard Brain v1 (Phase 3): area/community signal fusion.
    // Computed ONLY from values already gathered above (no extra fetch).
    // The area brain is safe to share and is stored in the shared cache.
    // Phase 4 + 5: aggregated symptom-trend baseline and verified reports.
    // Both best-effort; return [] if unavailable so the Brain still builds.
    const [trendBaseline, verifiedReports] = await Promise.all([
      loadTrendBaseline(admin, stateNormalized, null),
      loadVerifiedReports(admin, stateNormalized),
    ]);
    let brain = null as Awaited<ReturnType<typeof buildBrainAsync>> | null;
    try {
      brain = await buildBrainAsync(
        toBrainInput({
          area: state,
          scope: 'area',
          weather: weatherData,
          forecast: forecastData,
          season,
          aqiInsight,
          diseases: riskAssessment?.diseases ?? null,
          outbreaks,
          whoAlerts,
          trendBaseline,
          verifiedReports,
          now,
        }),
        { useLlm: BRAIN_LLM_SUMMARY },
      );
      logIntel('brain_built', { scope: 'area', riskLevel: brain.riskLevel, confidence: brain.confidence, signals: brain.meta.signalsUsed, generatedBy: brain.meta.generatedBy });
    } catch (err) {
      logIntel('brain_error', { scope: 'area', message: err instanceof Error ? err.message : String(err) });
      brain = null;
    }

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
        aqi: aqiResult.data.aqi,
        insight: aqiInsight,
        // Keep a lightweight pollutant object for UI convenience.
        // PM2.5/PM10 include status so the app can show health-oriented badges.
        pollutants: {
          pm2_5: aqiInsight?.pollutants?.pm2_5,
          pm10: aqiInsight?.pollutants?.pm10,
          o3: aqiResult.data.o3,
          no2: aqiResult.data.no2,
          co: aqiResult.data.co,
        },
        source: aqiResult.source,
      } : null,
      
      // NEW: Disease risk assessment
      riskAssessment: riskAssessment ? {
        overallRiskLevel: riskAssessment.overallRiskLevel,
        diseases: riskAssessment.diseases,
        disclaimer: riskAssessment.disclaimer,
      } : null,

      // NEW (Brain v1): additive area/community intelligence object.
      brain,
      
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
      
      // Real, attributed data sources actually used in this response. Official
      // outbreak confirmation comes only from NCDC/WHO via verified_reports.
      sources: [
        ...(weatherResult ? [{ name: weatherResult.source, url: sourceUrl(weatherResult.source), category: 'weather' }] : []),
        ...(aqiResult ? [{ name: aqiResult.source, url: sourceUrl(aqiResult.source), category: 'air_quality' }] : []),
        { name: 'WHO Disease Outbreak News', url: 'https://www.who.int/emergencies/disease-outbreak-news', category: 'official' },
        { name: 'Nigeria CDC (NCDC)', url: 'https://ncdc.gov.ng/', category: 'official' },
        { name: 'Africa CDC', url: 'https://africacdc.org/', category: 'official' },
        { name: 'Community check-ins (anonymous)', url: '', category: 'community' },
      ],

      meta: {
        version: 'edge-v2',
        note: 'Intel with Google Weather + Air Quality, deterministic disease-risk rules, and official-source outbreak relay',
        disclaimer: HEALTH_DISCLAIMER,
        dataFreshness: {
          weather: weatherResult ? 'live' : 'unavailable',
          aqi: aqiResult ? 'live' : 'unavailable',
          outbreaks: 'official_only',
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

    logIntel('response_built', {
      ok: true,
      cached: admin ? true : false,
      weather: weatherResult ? 'live' : 'unavailable',
      aqi: aqiResult ? 'live' : 'unavailable',
      outbreaks: outbreaks.length,
      whoAlerts: whoAlerts.length,
      riskAssessment: riskAssessment ? 'computed' : 'unavailable',
      durationMs: elapsedMs(reqStart),
    });
    const responseWithPersonal = await attachPersonalBrain(
      response as unknown as Record<string, unknown>,
      req,
      authUserId,
      state,
    );
    return jsonResponse(responseWithPersonal);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logIntel('response_failed', { ok: false, message: msg });
    return jsonResponse({ error: msg || 'Intel fetch failed' }, { status: 500 });
  }
});
