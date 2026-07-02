/**
 * Risk map color system.
 *
 * Each disease gets its own HUE; the risk TIER sets the shade (low -> high).
 * States with no active forecast render grey. Colors express a *risk
 * projection*, never a confirmed outbreak.
 */

export type RiskDisease = 'lassa' | 'malaria' | 'cholera' | 'meningitis';
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

export const RISK_DISEASES: { key: RiskDisease; label: string }[] = [
  { key: 'lassa', label: 'Lassa fever' },
  { key: 'malaria', label: 'Malaria' },
  { key: 'cholera', label: 'Cholera' },
  { key: 'meningitis', label: 'Meningitis' },
];

const RAMPS: Record<RiskDisease, Record<RiskLevel, string>> = {
  lassa: { low: '#fee2e2', moderate: '#fca5a5', elevated: '#ef4444', high: '#b91c1c' },
  malaria: { low: '#dcfce7', moderate: '#86efac', elevated: '#22c55e', high: '#15803d' },
  cholera: { low: '#dbeafe', moderate: '#93c5fd', elevated: '#3b82f6', high: '#1d4ed8' },
  meningitis: { low: '#f3e8ff', moderate: '#d8b4fe', elevated: '#a855f7', high: '#7e22ce' },
};

/** Grey for states without an active forecast for the selected disease. */
export const NO_DATA_FILL = '#9ca3af';

export const RISK_LEVELS: RiskLevel[] = ['low', 'moderate', 'elevated', 'high'];

/** Solid hue for a disease + tier (used for strokes, dots, legend). */
export function riskColor(disease: RiskDisease, level: RiskLevel | null | undefined): string {
  if (!level) return NO_DATA_FILL;
  return RAMPS[disease]?.[level] ?? NO_DATA_FILL;
}

/** Semi-transparent polygon fill (hue + alpha). '#RRGGBBAA' works in react-native-maps. */
export function riskFill(disease: RiskDisease, level: RiskLevel | null | undefined): string {
  return `${riskColor(disease, level)}AA`;
}
