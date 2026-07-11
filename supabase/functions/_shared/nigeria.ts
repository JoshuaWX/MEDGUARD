/**
 * Nigeria state helpers for the USSD flow.
 *
 * USSD users type free text ("ondo", "akwa ibom", "fct", "abuja"), so we
 * normalise to a canonical state name that matches how the ml/ job writes
 * `risk_forecast.state`. Returns null for unrecognised input.
 */

export const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'FCT',
] as const;

// A few common aliases users type.
const ALIASES: Record<string, string> = {
  'abuja': 'FCT',
  'fct abuja': 'FCT',
  'federal capital territory': 'FCT',
  'akwaibom': 'Akwa Ibom',
  'cross rivers': 'Cross River',
  'nassarawa': 'Nasarawa',
};

const canonicalByLower = new Map<string, string>(
  NIGERIA_STATES.map((s) => [s.toLowerCase(), s]),
);

/** Resolve free-text input to a canonical state name, or null. */
export function normalizeState(input: string): string | null {
  const key = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  if (canonicalByLower.has(key)) return canonicalByLower.get(key)!;
  if (ALIASES[key]) return ALIASES[key];
  // tolerate a trailing " state"
  const stripped = key.replace(/\s+state$/, '');
  if (canonicalByLower.has(stripped)) return canonicalByLower.get(stripped)!;
  if (ALIASES[stripped]) return ALIASES[stripped];
  return null;
}
