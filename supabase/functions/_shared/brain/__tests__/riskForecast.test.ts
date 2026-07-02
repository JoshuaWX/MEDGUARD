// MedGuard Brain — risk forecast analyzer + safety tests
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { analyzeRiskForecast } from '../analyzeRiskForecast.ts';
import { validateSummary } from '../safetyGuardrails.ts';
import { buildBrain } from '../buildBrain.ts';
import type { BrainRiskForecastInput } from '../types.ts';

function forecast(p: Partial<BrainRiskForecastInput> = {}): BrainRiskForecastInput {
  return {
    disease: 'lassa',
    projectedRiskLevel: 'elevated',
    riskScore: 42,
    confidence: 0.6,
    driverFactors: ['seasonal pattern', 'temperature'],
    summary:
      'National Lassa fever risk is projected to be elevated over the next 4 weeks; Ondo ' +
      'historically accounts for ~27% of reported Lassa cases. This is a risk projection, ' +
      'not a diagnosis or a confirmed outbreak.',
    modelVersion: 'lassa_v1',
    horizonDays: 28,
    validUntil: '2999-01-01T00:00:00Z',
    ...p,
  };
}

Deno.test('forecast: empty/nullish input yields no signals', () => {
  assertEquals(analyzeRiskForecast(null).length, 0);
  assertEquals(analyzeRiskForecast([]).length, 0);
});

Deno.test('forecast: emits one projection signal with correct type + severity', () => {
  const sig = analyzeRiskForecast([forecast()]);
  assertEquals(sig.length, 1);
  assertEquals(sig[0].type, 'risk_forecast');
  assertEquals(sig[0].severity, 'high'); // elevated -> high
  assert(sig[0].summary.includes('Lassa'));
  assert(sig[0].summary.includes('projected'));
});

Deno.test('forecast: severity + weight scale with level', () => {
  assertEquals(analyzeRiskForecast([forecast({ projectedRiskLevel: 'low' })])[0].severity, 'low');
  assertEquals(analyzeRiskForecast([forecast({ projectedRiskLevel: 'moderate' })])[0].severity, 'medium');
  const low = analyzeRiskForecast([forecast({ projectedRiskLevel: 'low' })])[0].weight ?? 1;
  const high = analyzeRiskForecast([forecast({ projectedRiskLevel: 'high' })])[0].weight ?? 0;
  assert(high > low);
});

Deno.test('forecast: short summary is safe (passes validateSummary)', () => {
  const sig = analyzeRiskForecast([forecast()]);
  assert(validateSummary(sig[0].summary).ok, 'signal summary must pass safety guardrails');
});

Deno.test('forecast: feeds Brain without violating the safety contract', () => {
  const brain = buildBrain({
    area: 'Ondo',
    scope: 'area',
    riskForecast: [forecast()],
  });
  assertEquals(brain.diagnosis, false);
  assertEquals(brain.outbreakConfirmed, false);
  assert(validateSummary(brain.summary).ok, 'brain summary must be safe with a forecast present');
  assert(brain.signals.some((s) => s.type === 'risk_forecast'));
});
