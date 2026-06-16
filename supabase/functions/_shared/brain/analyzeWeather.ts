/**
 * MedGuard Brain v1 — Weather signal analysis (PURE)
 *
 * Consumes already-computed weather/forecast/season values (no fetching) and
 * the existing risk-engine disease outputs, and emits normalized weather
 * signals. This wraps existing intel outputs; it does not recompute disease
 * risk from scratch.
 */

import type {
  BrainSignal,
  BrainWeatherInput,
  BrainForecastInput,
  BrainSeasonInput,
  BrainDiseaseRiskInput,
} from './types.ts';

const WEATHER_SOURCE = 'OpenWeather/Open-Meteo';

/**
 * Build weather signals from current conditions, season, and the active
 * disease-risk entries already computed by the risk-engine.
 */
export function analyzeWeather(
  weather: BrainWeatherInput | null | undefined,
  forecast: BrainForecastInput | null | undefined,
  season: BrainSeasonInput | null | undefined,
  diseases: BrainDiseaseRiskInput[] | null | undefined,
): BrainSignal[] {
  const signals: BrainSignal[] = [];
  if (!weather) return signals;

  const heavyRainNow = weather.precipitation >= 15;
  const moderateRainNow = weather.precipitation >= 5 && weather.precipitation < 15;
  const forecastRain = (forecast?.precipitation ?? []).reduce((a, b) => a + b, 0);
  const sustainedRain = forecastRain >= 30;

  // Weather-supports-spread signal, anchored to active weather-driven diseases.
  const weatherDriven = (diseases ?? []).filter(
    (d) => d.isActive && ['Malaria', 'Cholera', 'Typhoid'].includes(d.disease),
  );

  if (heavyRainNow || sustainedRain) {
    const diseaseList = weatherDriven.map((d) => d.disease).join(', ');
    signals.push({
      type: 'weather',
      severity: heavyRainNow && sustainedRain ? 'high' : 'medium',
      summary: 'Heavy or sustained rainfall may increase exposure risks',
      evidence:
        `Current rainfall ${weather.precipitation.toFixed(1)}mm` +
        (forecastRain > 0 ? `, ~${forecastRain.toFixed(0)}mm expected over coming days` : '') +
        (diseaseList ? `; conditions relevant to ${diseaseList}` : ''),
      source: WEATHER_SOURCE,
      weight: heavyRainNow && sustainedRain ? 0.6 : 0.4,
      freshness: 'live',
    });
  } else if (moderateRainNow) {
    signals.push({
      type: 'weather',
      severity: 'low',
      summary: 'Recent rainfall may slightly increase exposure risks',
      evidence: `Current rainfall ${weather.precipitation.toFixed(1)}mm`,
      source: WEATHER_SOURCE,
      weight: 0.2,
      freshness: 'live',
    });
  }

  // High humidity + warmth (mosquito-supportive) when malaria is active.
  const malariaActive = (diseases ?? []).some((d) => d.disease === 'Malaria' && d.isActive);
  if (malariaActive && weather.humidity >= 70 && weather.temp >= 20 && weather.temp <= 35) {
    signals.push({
      type: 'weather',
      severity: 'medium',
      summary: 'Warm, humid conditions can support mosquito breeding',
      evidence: `Humidity ${Math.round(weather.humidity)}% at ${Math.round(weather.temp)}°C`,
      source: WEATHER_SOURCE,
      weight: 0.35,
      freshness: 'live',
    });
  }

  // Seasonal context (low-weight, supportive only).
  if (season && (season.label === 'rainy' || season.label === 'harmattan')) {
    signals.push({
      type: 'weather',
      severity: 'low',
      summary: `Seasonal context: ${season.label} season`,
      evidence: season.description,
      source: 'MedGuard season model',
      weight: 0.15,
      freshness: 'recent',
    });
  }

  return signals;
}
