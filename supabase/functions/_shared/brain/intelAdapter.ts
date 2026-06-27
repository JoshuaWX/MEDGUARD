/**
 * MedGuard Brain v1 — Intel adapter (Phase 3)
 *
 * Maps the values the intel function has ALREADY computed (weather, forecast,
 * season, AQI insight, disease risks, outbreak/WHO feeds) into the Brain
 * input shape. PURE: no fetching here.
 *
 * This keeps intel/index.ts decoupled from Brain internals and avoids moving
 * any fetch logic (Phase 2 wrap-first rule still holds).
 */

import type {
  BrainBuildInput,
  BrainScope,
  BrainWeatherInput,
  BrainForecastInput,
  BrainSeasonInput,
  BrainAqiInput,
  BrainDiseaseRiskInput,
  BrainOutbreakInput,
  BrainWhoAlertInput,
  BrainCheckinInput,
  BrainSymptomLogInput,
  BrainCommunityTrendInput,
  BrainTrendBaselineInput,
  BrainVerifiedReportInput,
} from './types.ts';

// Loose shapes mirroring the intel-computed objects (avoid importing the whole
// risk-engine type surface).
interface RawWeather { temp?: number; humidity?: number; precipitation?: number; windSpeed?: number }
interface RawForecast { dates?: string[]; maxTemps?: number[]; minTemps?: number[]; precipitation?: number[] }
interface RawSeason { label?: string; description?: string; confidence?: number }
interface RawAqiInsight { level?: string; dominantPollutant?: string; healthImplications?: string }
interface RawDisease { disease?: string; riskLevel?: string; isActive?: boolean; reasons?: string[]; sources?: string[] }
interface RawOutbreak { disease?: string; region?: string; severity?: string; summary?: string; source?: string; updated?: string }
interface RawWhoAlert { title?: string; url?: string; source?: string }

export interface IntelAdapterInput {
  area: string;
  scope: BrainScope;
  weather?: RawWeather | null;
  forecast?: RawForecast | null;
  season?: RawSeason | null;
  aqiInsight?: RawAqiInsight | null;
  diseases?: RawDisease[] | null;
  outbreaks?: RawOutbreak[] | null;
  whoAlerts?: RawWhoAlert[] | null;
  checkins?: BrainCheckinInput[] | null;
  symptomLogs?: BrainSymptomLogInput[] | null;
  communityTrends?: BrainCommunityTrendInput[] | null;
  trendBaseline?: BrainTrendBaselineInput[] | null;
  verifiedReports?: BrainVerifiedReportInput[] | null;
  now?: Date;
}

const VALID_SEASONS = ['harmattan', 'dry', 'rainy', 'unknown'] as const;
const VALID_AQI = ['good', 'fair', 'moderate', 'poor', 'very_poor'] as const;

export function toBrainInput(input: IntelAdapterInput): BrainBuildInput {
  const weather: BrainWeatherInput | null = input.weather
    ? {
        temp: num(input.weather.temp),
        humidity: num(input.weather.humidity),
        precipitation: num(input.weather.precipitation),
        windSpeed: input.weather.windSpeed,
      }
    : null;

  const forecast: BrainForecastInput | null = input.forecast
    ? {
        dates: input.forecast.dates ?? [],
        maxTemps: input.forecast.maxTemps ?? [],
        minTemps: input.forecast.minTemps ?? [],
        precipitation: input.forecast.precipitation ?? [],
      }
    : null;

  const season: BrainSeasonInput | null = input.season
    ? {
        label: (VALID_SEASONS as readonly string[]).includes(input.season.label ?? '')
          ? (input.season.label as BrainSeasonInput['label'])
          : 'unknown',
        description: input.season.description ?? '',
        confidence: num(input.season.confidence),
      }
    : null;

  const aqi: BrainAqiInput | null = input.aqiInsight && input.aqiInsight.level
    ? {
        level: (VALID_AQI as readonly string[]).includes(input.aqiInsight.level)
          ? (input.aqiInsight.level as BrainAqiInput['level'])
          : 'good',
        dominantPollutant: input.aqiInsight.dominantPollutant,
        healthImplications: input.aqiInsight.healthImplications,
      }
    : null;

  const diseases: BrainDiseaseRiskInput[] = (input.diseases ?? []).map((d) => ({
    disease: d.disease ?? 'Unknown',
    riskLevel: normalizeRisk(d.riskLevel),
    isActive: Boolean(d.isActive),
    reasons: d.reasons ?? [],
    sources: d.sources ?? [],
  }));

  const outbreaks: BrainOutbreakInput[] = (input.outbreaks ?? []).map((o) => ({
    disease: o.disease ?? 'Unknown',
    region: o.region ?? '',
    severity: o.severity ?? 'low',
    summary: o.summary,
    source: o.source ?? 'feed',
    updated: o.updated,
  }));

  const whoAlerts: BrainWhoAlertInput[] = (input.whoAlerts ?? []).map((w) => ({
    title: w.title ?? '',
    url: w.url ?? '',
    source: w.source ?? 'WHO',
  }));

  return {
    area: input.area,
    scope: input.scope,
    weather,
    forecast,
    season,
    aqi,
    diseases,
    outbreaks,
    whoAlerts,
    checkins: input.scope === 'personal' ? input.checkins ?? null : null,
    symptomLogs: input.scope === 'personal' ? input.symptomLogs ?? null : null,
    communityTrends: input.communityTrends ?? null,
    trendBaseline: input.trendBaseline ?? null,
    verifiedReports: input.verifiedReports ?? null,
    now: input.now,
  };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function normalizeRisk(v: unknown): 'low' | 'medium' | 'high' {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
}
