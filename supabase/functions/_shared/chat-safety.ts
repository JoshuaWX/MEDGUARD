/** Pure, deterministic medical-chat safety rules. No provider can override these. */
const SYMPTOM_KEYS = [
  'fever', 'cough', 'headache', 'sore_throat', 'fatigue', 'body_pain',
  'nausea', 'vomiting', 'diarrhea', 'constipation', 'rash', 'itching',
  'dizziness', 'chills', 'breathing', 'chest_pain', 'bleeding', 'weakness',
  'runny_nose', 'loss_of_appetite', 'abdominal_pain', 'back_pain',
] as const;

const SYMPTOM_MATCHES: Array<[string, RegExp]> = [
  ['sore_throat', /sore throat/], ['body_pain', /body (pain|ache)/], ['chest_pain', /chest pain/],
  ['abdominal_pain', /(stomach|abdominal|belly) pain/], ['loss_of_appetite', /loss of appetite/],
  ['runny_nose', /runny nose/], ['fever', /\bfever\b/], ['cough', /\bcough/], ['headache', /headache/],
  ['fatigue', /fatigue|tired/], ['nausea', /nausea/], ['vomiting', /vomit/], ['diarrhea', /diarrh/],
  ['constipation', /constipat/], ['rash', /\brash/], ['itching', /itch/], ['dizziness', /dizz/],
  ['chills', /\bchills?/], ['breathing', /shortness of breath|trouble breathing/], ['bleeding', /\bbleeding/],
  ['weakness', /\bweak(ness)?/], ['back_pain', /back pain/],
];

const CLEAR_EMERGENCY_PATTERNS = [
  /\b(unconscious|unresponsive|passed out)\b/i,
  /\b(seizure|convulsion)\b/i,
  /\b(severe|heavy) bleeding\b/i,
  /\b(chest pain).{0,60}\b(shortness of breath|trouble breathing|cannot breathe)\b/i,
  /\b(suicid(al|e)|kill myself|self[- ]harm)\b/i,
];

export const EMERGENCY_RESPONSE = "This may need emergency care. Call Nigeria's emergency number 112 now or go to the nearest emergency facility. If you can, ask someone nearby to stay with you. MedGuard cannot assess this safely by chat.";

export function isClearEmergency(message: string): boolean {
  return CLEAR_EMERGENCY_PATTERNS.some((pattern) => pattern.test(message));
}

export function suggestSymptomsFromMessage(message: string): string[] {
  const normalized = message.toLowerCase();
  if (!/\b(i\s+(have|am|feel|experienced|am having)|my)\b/.test(normalized) || /\b(no|not|without|never)\b/.test(normalized)) return [];
  return SYMPTOM_MATCHES
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([key]) => key)
    .filter((key) => (SYMPTOM_KEYS as readonly string[]).includes(key))
    .slice(0, 6);
}
