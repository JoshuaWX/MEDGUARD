/**
 * MedGuard Risk Engine
 * Deterministic, rules-based disease risk assessment
 * 
 * DISCLAIMER: For awareness only; follow official guidance and consult a clinician for symptoms.
 */

// ============================================================================
// TYPES
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface WeatherData {
  temp: number;           // °C
  humidity: number;       // %
  precipitation: number;  // mm (current or last hour)
  windSpeed?: number;     // m/s
  weatherCode?: number;   // WMO code
}

export interface ForecastData {
  dates: string[];
  maxTemps: number[];
  minTemps: number[];
  precipitation: number[];  // mm per day
  humidity?: number[];
}

export interface AQIData {
  aqi: number;            // 1-5 scale (OpenWeather)
  pm2_5?: number;         // μg/m³
  pm10?: number;          // μg/m³
  o3?: number;            // μg/m³
  no2?: number;           // μg/m³
  so2?: number;           // μg/m³
  co?: number;            // μg/m³
}

export interface SeasonInfo {
  label: 'harmattan' | 'dry' | 'rainy' | 'unknown';
  description: string;
  confidence: number;
}

export interface DiseaseRisk {
  disease: string;
  diseaseKey: string;      // i18n key
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  reasons: string[];       // Plain-language explanations
  actions: string[];       // Prevention guidance (non-medical)
  sources: string[];
  isActive: boolean;
  priority: number;        // For sorting (1 = highest)
}

export interface RiskAssessment {
  assessedAt: string;
  location: {
    state: string;
    region: 'north' | 'south' | 'middle-belt';
  };
  season: SeasonInfo;
  diseases: DiseaseRisk[];
  overallRiskLevel: RiskLevel;
  disclaimer: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Nigerian regions for disease risk stratification
export const NIGERIA_REGIONS: Record<string, 'north' | 'south' | 'middle-belt'> = {
  // Northern states
  borno: 'north', yobe: 'north', adamawa: 'north', gombe: 'north', bauchi: 'north',
  jigawa: 'north', kano: 'north', katsina: 'north', kebbi: 'north', sokoto: 'north',
  zamfara: 'north', kaduna: 'north',
  // Middle belt
  niger: 'middle-belt', plateau: 'middle-belt', nasarawa: 'middle-belt', taraba: 'middle-belt',
  benue: 'middle-belt', kogi: 'middle-belt', kwara: 'middle-belt', fct: 'middle-belt', abuja: 'middle-belt',
  // Southern states
  lagos: 'south', ogun: 'south', oyo: 'south', osun: 'south', ondo: 'south', ekiti: 'south',
  edo: 'south', delta: 'south', rivers: 'south', bayelsa: 'south', 'cross river': 'south',
  'akwa ibom': 'south', abia: 'south', anambra: 'south', enugu: 'south', ebonyi: 'south', imo: 'south',
};

// Meningitis belt states (elevated risk during dry season)
export const MENINGITIS_BELT_STATES = [
  'borno', 'yobe', 'adamawa', 'gombe', 'bauchi', 'jigawa', 'kano', 'katsina',
  'kebbi', 'sokoto', 'zamfara', 'kaduna', 'niger'
];

// Lassa fever endemic states
export const LASSA_ENDEMIC_STATES = [
  'ondo', 'edo', 'ebonyi', 'bauchi', 'plateau', 'taraba', 'nasarawa',
  'benue', 'kogi', 'ogun', 'oyo', 'osun', 'ekiti', 'kwara'
];

// Disease-specific thresholds
export const RISK_THRESHOLDS = {
  malaria: {
    // High humidity + warm temps + precipitation = mosquito breeding
    humidityHigh: 70,
    tempOptimalMin: 20,
    tempOptimalMax: 35,
    precipitationModerate: 5,   // mm
    precipitationHigh: 15,      // mm
  },
  cholera: {
    // Heavy rainfall / flooding + contamination risk
    precipitationModerate: 20,  // mm (daily)
    precipitationHigh: 50,      // mm (daily) - flood-like
    humidityHigh: 75,
    tempHigh: 30,
  },
  typhoid: {
    // Similar to cholera - waterborne
    precipitationModerate: 15,
    precipitationHigh: 40,
    humidityHigh: 70,
  },
  meningitis: {
    // Dry, dusty, low humidity (harmattan) - northern states
    humidityLow: 30,
    tempHigh: 35,
    precipitationLow: 2,
  },
  lassa: {
    // Dry season + rodent activity
    humidityLow: 40,
    tempRange: { min: 25, max: 38 },
  },
} as const;

// ============================================================================
// AQI CALCULATION - HEALTH-FIRST APPROACH
// ============================================================================
// 
// CRITICAL: AQI must be calculated from actual pollutant concentrations, NOT
// from a single pollutant like NO₂. The "worst pollutant" approach is used:
// the pollutant with the highest sub-index determines the overall AQI.
//
// PRIORITY ORDER (by health impact):
//   1. PM2.5 (Fine particulate matter - highest priority)
//   2. PM10  (Coarse particulate matter)
//   3. CO    (Carbon monoxide)
//   4. NO₂   (Nitrogen dioxide - lowest priority)
//
// WHY PM2.5 IS PRIORITIZED:
// - PM2.5 particles penetrate deep into lungs and bloodstream
// - Strong link to cardiovascular and respiratory diseases
// - Major health concern in Nigerian urban areas (traffic, generators, cooking)
// - WHO classifies PM2.5 as the most health-relevant air pollutant
//
// WHY NO₂-ONLY IS UNSAFE:
// - NO₂ alone does not capture particulate pollution which causes most harm
// - Areas with high generator/traffic PM2.5 can show "Good" AQI if only NO₂ is used
// - This can lead users to believe air is safe when it's actually hazardous
//
// ============================================================================

// PM2.5 Thresholds (μg/m³) - EPA/WHO-aligned for public health
export const PM25_THRESHOLDS = {
  good: { max: 12, aqiRange: [0, 50] },           // 0–12 μg/m³ = Good (AQI 0-50)
  moderate: { max: 35, aqiRange: [51, 100] },     // 12–35 μg/m³ = Moderate (AQI 51-100)
  unhealthySensitive: { max: 55, aqiRange: [101, 150] }, // 35–55 μg/m³ = Unhealthy for Sensitive Groups
  unhealthy: { max: 150, aqiRange: [151, 200] }, // 55–150 μg/m³ = Unhealthy
  hazardous: { max: Infinity, aqiRange: [201, 300] }, // >150 μg/m³ = Hazardous
} as const;

// PM10 Thresholds (μg/m³)
export const PM10_THRESHOLDS = {
  good: { max: 54, aqiRange: [0, 50] },
  moderate: { max: 154, aqiRange: [51, 100] },
  unhealthySensitive: { max: 254, aqiRange: [101, 150] },
  unhealthy: { max: 354, aqiRange: [151, 200] },
  hazardous: { max: Infinity, aqiRange: [201, 300] },
} as const;

// CO Thresholds (μg/m³) - converted from ppm
export const CO_THRESHOLDS = {
  good: { max: 4400, aqiRange: [0, 50] },           // ~4.4 mg/m³
  moderate: { max: 9400, aqiRange: [51, 100] },     // ~9.4 mg/m³
  unhealthySensitive: { max: 12400, aqiRange: [101, 150] },
  unhealthy: { max: 15400, aqiRange: [151, 200] },
  hazardous: { max: Infinity, aqiRange: [201, 300] },
} as const;

// NO₂ Thresholds (μg/m³) - LOWEST PRIORITY
export const NO2_THRESHOLDS = {
  good: { max: 40, aqiRange: [0, 50] },
  moderate: { max: 80, aqiRange: [51, 100] },
  unhealthySensitive: { max: 180, aqiRange: [101, 150] },
  unhealthy: { max: 280, aqiRange: [151, 200] },
  hazardous: { max: Infinity, aqiRange: [201, 300] },
} as const;

// Legacy AQI levels for backward compatibility with OpenWeather 1-5 scale
export const AQI_LEVELS = {
  good: 1,
  fair: 2,
  moderate: 3,
  poor: 4,
  veryPoor: 5,
} as const;

// Standard disclaimer
export const HEALTH_DISCLAIMER = 
  'For awareness only; follow official guidance and consult a clinician for symptoms.';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRegion(state: string): 'north' | 'south' | 'middle-belt' {
  return NIGERIA_REGIONS[state.toLowerCase()] || 'south';
}

export function isInMeningitisBelt(state: string): boolean {
  return MENINGITIS_BELT_STATES.includes(state.toLowerCase());
}

export function isLassaEndemic(state: string): boolean {
  return LASSA_ENDEMIC_STATES.includes(state.toLowerCase());
}

export function getNigeriaSeason(month: number, state: string): SeasonInfo {
  const region = getRegion(state);
  
  // Harmattan: Nov-Feb (peaks Dec-Jan)
  if (month === 11 || month === 0 || month === 1) {
    return {
      label: 'harmattan',
      description: 'Dry, dusty Harmattan winds from the Sahara',
      confidence: 0.85,
    };
  }
  
  // Late dry season: Feb-Mar
  if (month === 1 || month === 2) {
    return {
      label: 'dry',
      description: 'Late dry season, transitioning to rains',
      confidence: 0.7,
    };
  }
  
  // Rainy season varies by region
  if (month >= 3 && month <= 9) {
    // Northern region has shorter rainy season
    if (region === 'north' && (month <= 4 || month >= 9)) {
      return {
        label: 'dry',
        description: 'Northern Nigeria dry period',
        confidence: 0.65,
      };
    }
    return {
      label: 'rainy',
      description: 'Rainy season - increased waterborne and vector-borne disease risk',
      confidence: 0.8,
    };
  }
  
  // Oct-Nov transition
  if (month === 9 || month === 10) {
    return {
      label: 'dry',
      description: 'Transition from rainy to dry season',
      confidence: 0.6,
    };
  }
  
  return { label: 'unknown', description: 'Season data unavailable', confidence: 0 };
}

// ============================================================================
// DISEASE RISK CALCULATORS
// ============================================================================

export function calculateMalariaRisk(
  weather: WeatherData,
  forecast: ForecastData | null,
  season: SeasonInfo
): DiseaseRisk {
  const { humidityHigh, tempOptimalMin, tempOptimalMax, precipitationModerate, precipitationHigh } = RISK_THRESHOLDS.malaria;
  
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  // Temperature in optimal range for mosquitoes
  if (weather.temp >= tempOptimalMin && weather.temp <= tempOptimalMax) {
    riskScore += 2;
    reasons.push(`Current temperature (${weather.temp}°C) favors mosquito activity`);
  }
  
  // High humidity
  if (weather.humidity >= humidityHigh) {
    riskScore += 2;
    reasons.push(`High humidity (${weather.humidity}%) increases mosquito breeding`);
  }
  
  // Current or recent precipitation
  if (weather.precipitation >= precipitationHigh) {
    riskScore += 3;
    reasons.push('Heavy rainfall creates stagnant water for mosquito breeding');
  } else if (weather.precipitation >= precipitationModerate) {
    riskScore += 2;
    reasons.push('Recent rainfall may increase mosquito breeding sites');
  }
  
  // Check forecast for sustained conditions
  if (forecast) {
    const avgPrecip = forecast.precipitation.reduce((a, b) => a + b, 0) / forecast.precipitation.length;
    if (avgPrecip >= precipitationModerate) {
      riskScore += 1;
      reasons.push('Rainfall expected to continue in coming days');
    }
  }
  
  // Seasonal adjustment
  if (season.label === 'rainy') {
    riskScore += 2;
    reasons.push('Rainy season typically sees elevated malaria transmission');
  }
  
  // Prevention actions (non-medical)
  actions.push('Use insecticide-treated mosquito nets while sleeping');
  actions.push('Apply insect repellent when outdoors, especially at dawn and dusk');
  actions.push('Remove stagnant water around your home');
  actions.push('Wear long sleeves and trousers during peak mosquito hours');
  
  const riskLevel: RiskLevel = riskScore >= 6 ? 'high' : riskScore >= 3 ? 'medium' : 'low';
  
  return {
    disease: 'Malaria',
    diseaseKey: 'disease_malaria',
    riskLevel,
    confidence: reasons.length >= 2 ? 'high' : 'medium',
    reasons: reasons.length > 0 ? reasons : ['Current conditions show low malaria transmission risk'],
    actions,
    sources: ['NCDC Nigeria', 'OpenWeather'],
    isActive: riskScore >= 3,
    priority: riskLevel === 'high' ? 1 : riskLevel === 'medium' ? 2 : 5,
  };
}

export function calculateCholeraRisk(
  weather: WeatherData,
  forecast: ForecastData | null,
  season: SeasonInfo
): DiseaseRisk {
  const { precipitationModerate, precipitationHigh, humidityHigh, tempHigh } = RISK_THRESHOLDS.cholera;
  
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  // Heavy rainfall / flooding conditions
  if (weather.precipitation >= precipitationHigh) {
    riskScore += 4;
    reasons.push('Heavy rainfall may cause flooding and water contamination');
  } else if (weather.precipitation >= precipitationModerate) {
    riskScore += 2;
    reasons.push('Significant rainfall increases water contamination risk');
  }
  
  // Check forecast for continued heavy rain
  if (forecast) {
    const totalPrecip = forecast.precipitation.reduce((a, b) => a + b, 0);
    if (totalPrecip >= precipitationHigh * 2) {
      riskScore += 2;
      reasons.push('Sustained heavy rainfall forecast may worsen flooding');
    }
  }
  
  // High humidity + high temp
  if (weather.humidity >= humidityHigh && weather.temp >= tempHigh) {
    riskScore += 1;
    reasons.push('Warm, humid conditions can accelerate bacterial growth in water');
  }
  
  // Rainy season
  if (season.label === 'rainy') {
    riskScore += 1;
    reasons.push('Rainy season increases waterborne disease transmission');
  }
  
  // Prevention actions
  actions.push('Drink only boiled or treated water');
  actions.push('Wash hands thoroughly with soap before eating and after using the toilet');
  actions.push('Avoid raw or undercooked food, especially seafood');
  actions.push('Ensure food is properly covered and stored');
  actions.push('Avoid contact with floodwater if possible');
  
  const riskLevel: RiskLevel = riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low';
  
  return {
    disease: 'Cholera',
    diseaseKey: 'disease_cholera',
    riskLevel,
    confidence: reasons.length >= 2 ? 'high' : 'medium',
    reasons: reasons.length > 0 ? reasons : ['Current conditions show low cholera transmission risk'],
    actions,
    sources: ['NCDC Nigeria', 'OpenWeather'],
    isActive: riskScore >= 3,
    priority: riskLevel === 'high' ? 1 : riskLevel === 'medium' ? 3 : 6,
  };
}

export function calculateTyphoidRisk(
  weather: WeatherData,
  _forecast: ForecastData | null,
  season: SeasonInfo
): DiseaseRisk {
  const { precipitationModerate, precipitationHigh, humidityHigh } = RISK_THRESHOLDS.typhoid;
  
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  // Rainfall and contamination
  if (weather.precipitation >= precipitationHigh) {
    riskScore += 3;
    reasons.push('Heavy rainfall increases risk of water contamination');
  } else if (weather.precipitation >= precipitationModerate) {
    riskScore += 2;
    reasons.push('Recent rainfall may affect water quality');
  }
  
  // Humidity
  if (weather.humidity >= humidityHigh) {
    riskScore += 1;
    reasons.push('High humidity can promote bacterial survival');
  }
  
  // Rainy season
  if (season.label === 'rainy') {
    riskScore += 2;
    reasons.push('Typhoid cases often increase during rainy season');
  }
  
  // Prevention actions
  actions.push('Drink only boiled, bottled, or properly treated water');
  actions.push('Eat freshly cooked, hot foods');
  actions.push('Avoid ice from unknown sources');
  actions.push('Wash fruits and vegetables with clean water before eating');
  actions.push('Maintain good hand hygiene');
  
  const riskLevel: RiskLevel = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
  
  return {
    disease: 'Typhoid',
    diseaseKey: 'disease_typhoid',
    riskLevel,
    confidence: reasons.length >= 2 ? 'medium' : 'low',
    reasons: reasons.length > 0 ? reasons : ['Current conditions show low typhoid risk'],
    actions,
    sources: ['NCDC Nigeria', 'OpenWeather'],
    isActive: riskScore >= 2,
    priority: riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 4 : 7,
  };
}

export function calculateMeningitisRisk(
  weather: WeatherData,
  season: SeasonInfo,
  state: string
): DiseaseRisk {
  const { humidityLow, tempHigh, precipitationLow } = RISK_THRESHOLDS.meningitis;
  const inBelt = isInMeningitisBelt(state);
  
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  if (!inBelt) {
    return {
      disease: 'Meningitis',
      diseaseKey: 'disease_meningitis',
      riskLevel: 'low',
      confidence: 'high',
      reasons: ['Your state is outside the meningitis belt; risk is typically lower'],
      actions: ['Stay informed about health advisories in your area'],
      sources: ['NCDC Nigeria'],
      isActive: false,
      priority: 10,
    };
  }
  
  // Dry, dusty conditions
  if (weather.humidity <= humidityLow) {
    riskScore += 3;
    reasons.push(`Low humidity (${weather.humidity}%) and dry air can irritate respiratory passages`);
  }
  
  if (weather.temp >= tempHigh) {
    riskScore += 2;
    reasons.push(`High temperatures (${weather.temp}°C) during dry season increase risk`);
  }
  
  if (weather.precipitation <= precipitationLow) {
    riskScore += 1;
    reasons.push('Very dry conditions typical of meningitis season');
  }
  
  // Harmattan/dry season in meningitis belt
  if ((season.label === 'harmattan' || season.label === 'dry') && inBelt) {
    riskScore += 3;
    reasons.push('Meningitis season (Dec-May) is active in the meningitis belt');
  }
  
  // Prevention actions
  actions.push('Consider meningitis vaccination if available');
  actions.push('Avoid overcrowded and poorly ventilated spaces');
  actions.push('Cover nose and mouth during dusty conditions');
  actions.push('Seek medical care immediately for severe headache with stiff neck or high fever');
  
  const riskLevel: RiskLevel = riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low';
  
  return {
    disease: 'Meningitis',
    diseaseKey: 'disease_meningitis',
    riskLevel,
    confidence: inBelt && (season.label === 'harmattan' || season.label === 'dry') ? 'high' : 'medium',
    reasons: reasons.length > 0 ? reasons : ['Current conditions show moderate awareness needed'],
    actions,
    sources: ['NCDC Nigeria', 'OpenWeather'],
    isActive: riskScore >= 3,
    priority: riskLevel === 'high' ? 1 : riskLevel === 'medium' ? 3 : 8,
  };
}

export function calculateLassaRisk(
  weather: WeatherData,
  season: SeasonInfo,
  state: string
): DiseaseRisk {
  const { humidityLow, tempRange } = RISK_THRESHOLDS.lassa;
  const endemic = isLassaEndemic(state);
  
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  if (!endemic) {
    return {
      disease: 'Lassa Fever',
      diseaseKey: 'disease_lassa',
      riskLevel: 'low',
      confidence: 'high',
      reasons: ['Your state has historically lower Lassa fever incidence'],
      actions: ['Maintain general hygiene and food storage practices'],
      sources: ['NCDC Nigeria'],
      isActive: false,
      priority: 10,
    };
  }
  
  // Dry season in endemic area
  if ((season.label === 'harmattan' || season.label === 'dry') && endemic) {
    riskScore += 3;
    reasons.push('Lassa fever season (Nov-Mar) peaks during dry season in endemic states');
  }
  
  // Dry conditions
  if (weather.humidity <= humidityLow) {
    riskScore += 2;
    reasons.push('Dry conditions may increase rodent-human contact as rodents seek food/shelter');
  }
  
  // Temperature range
  if (weather.temp >= tempRange.min && weather.temp <= tempRange.max) {
    riskScore += 1;
    reasons.push('Current temperatures favorable for rodent activity');
  }
  
  // Prevention actions
  actions.push('Store food in rodent-proof containers');
  actions.push('Keep your home clean and free of food scraps');
  actions.push('Block holes and gaps where rodents can enter');
  actions.push('Avoid contact with rats and their droppings');
  actions.push('Seek medical care for unexplained fever, especially with bleeding');
  
  const riskLevel: RiskLevel = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
  
  return {
    disease: 'Lassa Fever',
    diseaseKey: 'disease_lassa',
    riskLevel,
    confidence: endemic && season.label !== 'rainy' ? 'high' : 'medium',
    reasons: reasons.length > 0 ? reasons : ['Maintain vigilance in endemic area'],
    actions,
    sources: ['NCDC Nigeria', 'OpenWeather'],
    isActive: riskScore >= 2,
    priority: riskLevel === 'high' ? 1 : riskLevel === 'medium' ? 2 : 9,
  };
}

// ============================================================================
// AQI HEALTH INSIGHTS
// ============================================================================

export interface AQIInsight {
  level: 'good' | 'fair' | 'moderate' | 'poor' | 'very_poor';
  levelKey: string;
  description: string;
  healthImplications: string;
  recommendations: string[];
  sensitiveGroups: string[];
  pollutants?: {
    pm2_5?: { value: number; status: string };
    pm10?: { value: number; status: string };
    o3?: { value: number; status: string };
    no2?: { value: number; status: string };
    co?: { value: number; status: string };
  };
  dominantPollutant?: string;  // Which pollutant drove the AQI
}

/**
 * Calculate sub-AQI for a single pollutant based on concentration breakpoints.
 * Returns a value from 0-300+ where higher = worse air quality.
 */
function calculateSubAQI(
  concentration: number,
  thresholds: { max: number; aqiRange: [number, number] }[]
): number {
  let prevMax = 0;
  for (const { max, aqiRange } of thresholds) {
    if (concentration <= max) {
      // Linear interpolation within this bracket
      const range = max - prevMax;
      const aqiSpan = aqiRange[1] - aqiRange[0];
      const ratio = range > 0 ? (concentration - prevMax) / range : 0;
      return aqiRange[0] + ratio * aqiSpan;
    }
    prevMax = max;
  }
  // Beyond all thresholds = hazardous
  return 300;
}

/**
 * Convert sub-AQI (0-300) to OpenWeather-compatible 1-5 scale for backward compatibility
 */
function subAQIToScale5(subAQI: number): number {
  if (subAQI <= 50) return 1;   // Good
  if (subAQI <= 100) return 2;  // Fair
  if (subAQI <= 150) return 3;  // Moderate
  if (subAQI <= 200) return 4;  // Poor
  return 5;                      // Very Poor
}

/**
 * Get pollutant status label from sub-AQI
 */
function getStatusFromSubAQI(subAQI: number): string {
  if (subAQI <= 50) return 'Good';
  if (subAQI <= 100) return 'Fair';
  if (subAQI <= 150) return 'Moderate';
  if (subAQI <= 200) return 'Poor';
  return 'Hazardous';
}

/**
 * HEALTH-FIRST AQI CALCULATION
 * 
 * This function computes AQI using the "worst pollutant" approach with
 * proper health-based prioritization:
 * 
 *   1. PM2.5 (PRIMARY) - Most health-critical, deep lung penetration
 *   2. PM10 (SECONDARY) - Coarse particles, respiratory irritant
 *   3. CO (SECONDARY) - Cardiovascular stress
 *   4. NO₂ (LOWEST) - Respiratory irritant, but less critical alone
 * 
 * The pollutant with the HIGHEST sub-index determines the overall AQI.
 * This ensures we never underreport risk from particulate pollution.
 */
export function getAQIInsight(aqi: AQIData): AQIInsight {
  // Calculate sub-AQI for each available pollutant
  const pollutantScores: { name: string; subAQI: number; value: number; priority: number }[] = [];
  
  // Priority 1: PM2.5 (MOST CRITICAL for health)
  if (aqi.pm2_5 !== undefined && aqi.pm2_5 >= 0) {
    const subAQI = calculateSubAQI(aqi.pm2_5, [
      { max: 12, aqiRange: [0, 50] },
      { max: 35, aqiRange: [51, 100] },
      { max: 55, aqiRange: [101, 150] },
      { max: 150, aqiRange: [151, 200] },
      { max: 250, aqiRange: [201, 300] },
    ]);
    pollutantScores.push({ name: 'PM2.5', subAQI, value: aqi.pm2_5, priority: 1 });
  }
  
  // Priority 2: PM10
  if (aqi.pm10 !== undefined && aqi.pm10 >= 0) {
    const subAQI = calculateSubAQI(aqi.pm10, [
      { max: 54, aqiRange: [0, 50] },
      { max: 154, aqiRange: [51, 100] },
      { max: 254, aqiRange: [101, 150] },
      { max: 354, aqiRange: [151, 200] },
      { max: 424, aqiRange: [201, 300] },
    ]);
    pollutantScores.push({ name: 'PM10', subAQI, value: aqi.pm10, priority: 2 });
  }
  
  // Priority 3: CO (μg/m³)
  if (aqi.co !== undefined && aqi.co >= 0) {
    const subAQI = calculateSubAQI(aqi.co, [
      { max: 4400, aqiRange: [0, 50] },
      { max: 9400, aqiRange: [51, 100] },
      { max: 12400, aqiRange: [101, 150] },
      { max: 15400, aqiRange: [151, 200] },
      { max: 30400, aqiRange: [201, 300] },
    ]);
    pollutantScores.push({ name: 'CO', subAQI, value: aqi.co, priority: 3 });
  }
  
  // Priority 4: NO₂ (LOWEST priority - should not drive AQI alone)
  if (aqi.no2 !== undefined && aqi.no2 >= 0) {
    const subAQI = calculateSubAQI(aqi.no2, [
      { max: 40, aqiRange: [0, 50] },
      { max: 80, aqiRange: [51, 100] },
      { max: 180, aqiRange: [101, 150] },
      { max: 280, aqiRange: [151, 200] },
      { max: 400, aqiRange: [201, 300] },
    ]);
    pollutantScores.push({ name: 'NO₂', subAQI, value: aqi.no2, priority: 4 });
  }
  
  // Determine overall AQI from WORST pollutant (highest sub-AQI)
  // If tied, prefer higher priority pollutant (lower priority number)
  let dominantPollutant = 'PM2.5';
  let worstSubAQI = 0;
  
  if (pollutantScores.length > 0) {
    pollutantScores.sort((a, b) => {
      if (b.subAQI !== a.subAQI) return b.subAQI - a.subAQI; // Highest subAQI first
      return a.priority - b.priority; // If tied, higher priority (lower number) wins
    });
    worstSubAQI = pollutantScores[0].subAQI;
    dominantPollutant = pollutantScores[0].name;
  } else {
    // Fallback to OpenWeather AQI if no pollutant data available
    // (This should rarely happen but provides backward compatibility)
    worstSubAQI = (aqi.aqi - 1) * 50; // Convert 1-5 to approximate 0-200
  }
  
  // Convert to level
  const calculatedAQI = subAQIToScale5(worstSubAQI);
  const levelMap: Record<number, AQIInsight['level']> = {
    1: 'good',
    2: 'fair',
    3: 'moderate',
    4: 'poor',
    5: 'very_poor',
  };
  const level = levelMap[calculatedAQI] || 'moderate';
  
  // Health insights based on calculated level
  const insights: Record<AQIInsight['level'], Omit<AQIInsight, 'level' | 'levelKey' | 'pollutants' | 'dominantPollutant'>> = {
    good: {
      description: 'Air quality is satisfactory',
      healthImplications: 'Air quality poses little or no risk',
      recommendations: ['Enjoy outdoor activities normally'],
      sensitiveGroups: [],
    },
    fair: {
      description: 'Air quality is acceptable',
      healthImplications: 'Some pollutants may be of concern for unusually sensitive individuals',
      recommendations: [
        'Outdoor activities are generally safe',
        'Sensitive individuals should monitor symptoms',
      ],
      sensitiveGroups: ['People with severe respiratory conditions'],
    },
    moderate: {
      description: 'Air quality is moderately polluted',
      healthImplications: 'Sensitive groups may experience mild effects',
      recommendations: [
        'Consider reducing prolonged outdoor exertion',
        'Keep windows closed during peak pollution hours',
        'People with asthma should have reliever medication available',
      ],
      sensitiveGroups: ['Children', 'Elderly', 'People with asthma or respiratory conditions'],
    },
    poor: {
      description: 'Air quality is unhealthy',
      healthImplications: 'Everyone may begin to experience health effects; sensitive groups at higher risk',
      recommendations: [
        'Limit outdoor physical activities',
        'Keep windows and doors closed',
        'Use air purifiers if available',
        'Wear a mask outdoors if necessary',
        `Primary concern: ${dominantPollutant} levels are elevated`,
      ],
      sensitiveGroups: ['Children', 'Elderly', 'People with heart or lung disease', 'Pregnant women'],
    },
    very_poor: {
      description: 'Air quality is hazardous',
      healthImplications: 'Health alert: everyone may experience serious health effects',
      recommendations: [
        'Avoid all outdoor physical activities',
        'Stay indoors with windows closed',
        'Use air purifiers',
        'Seek medical attention if experiencing symptoms',
        'Wear N95 masks if going outdoors is unavoidable',
        `⚠️ Primary pollutant: ${dominantPollutant}`,
      ],
      sensitiveGroups: ['Everyone, especially vulnerable populations'],
    },
  };
  
  const insight = insights[level];
  
  // Build pollutant breakdown with calculated status
  const pollutants: AQIInsight['pollutants'] = {};
  
  for (const p of pollutantScores) {
    const status = getStatusFromSubAQI(p.subAQI);
    if (p.name === 'PM2.5') {
      pollutants.pm2_5 = { value: p.value, status };
    } else if (p.name === 'PM10') {
      pollutants.pm10 = { value: p.value, status };
    } else if (p.name === 'NO₂') {
      pollutants.no2 = { value: p.value, status };
    } else if (p.name === 'CO') {
      pollutants.co = { value: p.value, status };
    }
  }
  
  // Add O3 if available (informational only, not used in primary calculation)
  if (aqi.o3 !== undefined) {
    const o3SubAQI = calculateSubAQI(aqi.o3, [
      { max: 60, aqiRange: [0, 50] },
      { max: 120, aqiRange: [51, 100] },
      { max: 180, aqiRange: [101, 150] },
      { max: 240, aqiRange: [151, 200] },
    ]);
    pollutants.o3 = { value: aqi.o3, status: getStatusFromSubAQI(o3SubAQI) };
  }
  
  return {
    level,
    levelKey: `aqi_${level}`,
    ...insight,
    pollutants: Object.keys(pollutants).length > 0 ? pollutants : undefined,
    dominantPollutant,
  };
}

// ============================================================================
// MAIN ASSESSMENT FUNCTION
// ============================================================================

export function assessDiseaseRisks(
  weather: WeatherData,
  forecast: ForecastData | null,
  state: string
): RiskAssessment {
  const now = new Date();
  const month = now.getMonth();
  const season = getNigeriaSeason(month, state);
  const region = getRegion(state);
  
  // Calculate risk for each disease
  const diseases: DiseaseRisk[] = [
    calculateMalariaRisk(weather, forecast, season),
    calculateCholeraRisk(weather, forecast, season),
    calculateTyphoidRisk(weather, forecast, season),
    calculateMeningitisRisk(weather, season, state),
    calculateLassaRisk(weather, season, state),
  ];
  
  // Sort by priority (active high-risk first)
  diseases.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.priority - b.priority;
  });
  
  // Determine overall risk level
  const activeHighRisks = diseases.filter(d => d.isActive && d.riskLevel === 'high').length;
  const activeMediumRisks = diseases.filter(d => d.isActive && d.riskLevel === 'medium').length;
  
  let overallRiskLevel: RiskLevel = 'low';
  if (activeHighRisks >= 1) {
    overallRiskLevel = 'high';
  } else if (activeMediumRisks >= 2) {
    overallRiskLevel = 'medium';
  } else if (activeMediumRisks >= 1) {
    overallRiskLevel = 'medium';
  }
  
  return {
    assessedAt: now.toISOString(),
    location: {
      state,
      region,
    },
    season,
    diseases,
    overallRiskLevel,
    disclaimer: HEALTH_DISCLAIMER,
  };
}
