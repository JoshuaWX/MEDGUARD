/**
 * MedGuard Intel Edge Function v2 - BUNDLED FOR MANUAL DEPLOYMENT
 * 
 * This file contains ALL dependencies inlined for manual Supabase Dashboard upload.
 * Copy ALL of this file's content into the Supabase Dashboard Function Editor.
 * 
 * IMPORTANT: After pasting, ensure the environment variable OPENWEATHER_API_KEY is set in
 * Supabase Dashboard → Settings → Edge Functions → Secrets
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// ============================================================================
// INLINED: _shared/cors.ts
// ============================================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============================================================================
// INLINED: _shared/supabase.ts
// ============================================================================
function createUserClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

function tryCreateAdminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ============================================================================
// INLINED: _shared/risk-engine.ts (TYPES)
// ============================================================================

type RiskLevel = 'low' | 'medium' | 'high';
type ConfidenceLevel = 'low' | 'medium' | 'high';

interface WeatherData {
  temp: number;
  humidity: number;
  precipitation: number;
  windSpeed?: number;
  weatherCode?: number;
}

interface ForecastData {
  dates: string[];
  maxTemps: number[];
  minTemps: number[];
  precipitation: number[];
  humidity?: number[];
}

interface AQIData {
  aqi: number;
  pm2_5?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  so2?: number;
  co?: number;
}

interface SeasonInfo {
  label: 'harmattan' | 'dry' | 'rainy' | 'unknown';
  description: string;
  confidence: number;
}

interface DiseaseRisk {
  disease: string;
  diseaseKey: string;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  reasons: string[];
  actions: string[];
  sources: string[];
  isActive: boolean;
  priority: number;
}

interface RiskAssessment {
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

interface AQIInsight {
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
  };
}

// ============================================================================
// INLINED: _shared/risk-engine.ts (CONFIGURATION)
// ============================================================================

const NIGERIA_REGIONS: Record<string, 'north' | 'south' | 'middle-belt'> = {
  borno: 'north', yobe: 'north', adamawa: 'north', gombe: 'north', bauchi: 'north',
  jigawa: 'north', kano: 'north', katsina: 'north', kebbi: 'north', sokoto: 'north',
  zamfara: 'north', kaduna: 'north',
  niger: 'middle-belt', plateau: 'middle-belt', nasarawa: 'middle-belt', taraba: 'middle-belt',
  benue: 'middle-belt', kogi: 'middle-belt', kwara: 'middle-belt', fct: 'middle-belt', abuja: 'middle-belt',
  lagos: 'south', ogun: 'south', oyo: 'south', osun: 'south', ondo: 'south', ekiti: 'south',
  edo: 'south', delta: 'south', rivers: 'south', bayelsa: 'south', 'cross river': 'south',
  'akwa ibom': 'south', abia: 'south', anambra: 'south', enugu: 'south', ebonyi: 'south', imo: 'south',
};

const MENINGITIS_BELT_STATES = [
  'borno', 'yobe', 'adamawa', 'gombe', 'bauchi', 'jigawa', 'kano', 'katsina',
  'kebbi', 'sokoto', 'zamfara', 'kaduna', 'niger'
];

const LASSA_ENDEMIC_STATES = [
  'ondo', 'edo', 'ebonyi', 'bauchi', 'plateau', 'taraba', 'nasarawa',
  'benue', 'kogi', 'ogun', 'oyo', 'osun', 'ekiti', 'kwara'
];

const RISK_THRESHOLDS = {
  malaria: {
    humidityHigh: 70,
    tempOptimalMin: 20,
    tempOptimalMax: 35,
    precipitationModerate: 5,
    precipitationHigh: 15,
  },
  cholera: {
    precipitationModerate: 20,
    precipitationHigh: 50,
    humidityHigh: 75,
    tempHigh: 30,
  },
  typhoid: {
    precipitationModerate: 15,
    precipitationHigh: 40,
    humidityHigh: 70,
  },
  meningitis: {
    humidityLow: 30,
    tempHigh: 35,
    precipitationLow: 2,
  },
  lassa: {
    humidityLow: 40,
    tempRange: { min: 25, max: 38 },
  },
} as const;

const HEALTH_DISCLAIMER = 
  'For awareness only; follow official guidance and consult a clinician for symptoms.';

// ============================================================================
// INLINED: _shared/risk-engine.ts (HELPER FUNCTIONS)
// ============================================================================

function getRegion(state: string): 'north' | 'south' | 'middle-belt' {
  return NIGERIA_REGIONS[state.toLowerCase()] || 'south';
}

function isInMeningitisBelt(state: string): boolean {
  return MENINGITIS_BELT_STATES.includes(state.toLowerCase());
}

function isLassaEndemic(state: string): boolean {
  return LASSA_ENDEMIC_STATES.includes(state.toLowerCase());
}

function getNigeriaSeason(month: number, state: string): SeasonInfo {
  const region = getRegion(state);
  
  if (month === 11 || month === 0 || month === 1) {
    return { label: 'harmattan', description: 'Dry, dusty Harmattan winds from the Sahara', confidence: 0.85 };
  }
  if (month === 1 || month === 2) {
    return { label: 'dry', description: 'Late dry season, transitioning to rains', confidence: 0.7 };
  }
  if (month >= 3 && month <= 9) {
    if (region === 'north' && (month <= 4 || month >= 9)) {
      return { label: 'dry', description: 'Northern Nigeria dry period', confidence: 0.65 };
    }
    return { label: 'rainy', description: 'Rainy season - increased waterborne and vector-borne disease risk', confidence: 0.8 };
  }
  if (month === 9 || month === 10) {
    return { label: 'dry', description: 'Transition from rainy to dry season', confidence: 0.6 };
  }
  return { label: 'unknown', description: 'Season data unavailable', confidence: 0 };
}

// ============================================================================
// INLINED: _shared/risk-engine.ts (DISEASE RISK CALCULATORS)
// ============================================================================

function calculateMalariaRisk(weather: WeatherData, forecast: ForecastData | null, season: SeasonInfo): DiseaseRisk {
  const { humidityHigh, tempOptimalMin, tempOptimalMax, precipitationModerate, precipitationHigh } = RISK_THRESHOLDS.malaria;
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  if (weather.temp >= tempOptimalMin && weather.temp <= tempOptimalMax) {
    riskScore += 2;
    reasons.push(`Current temperature (${weather.temp}°C) favors mosquito activity`);
  }
  if (weather.humidity >= humidityHigh) {
    riskScore += 2;
    reasons.push(`High humidity (${weather.humidity}%) increases mosquito breeding`);
  }
  if (weather.precipitation >= precipitationHigh) {
    riskScore += 3;
    reasons.push('Heavy rainfall creates stagnant water for mosquito breeding');
  } else if (weather.precipitation >= precipitationModerate) {
    riskScore += 2;
    reasons.push('Recent rainfall may increase mosquito breeding sites');
  }
  if (forecast) {
    const avgPrecip = forecast.precipitation.reduce((a, b) => a + b, 0) / forecast.precipitation.length;
    if (avgPrecip >= precipitationModerate) {
      riskScore += 1;
      reasons.push('Rainfall expected to continue in coming days');
    }
  }
  if (season.label === 'rainy') {
    riskScore += 2;
    reasons.push('Rainy season typically sees elevated malaria transmission');
  }
  
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

function calculateCholeraRisk(weather: WeatherData, forecast: ForecastData | null, season: SeasonInfo): DiseaseRisk {
  const { precipitationModerate, precipitationHigh, humidityHigh, tempHigh } = RISK_THRESHOLDS.cholera;
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  if (weather.precipitation >= precipitationHigh) {
    riskScore += 4;
    reasons.push('Heavy rainfall may cause flooding and water contamination');
  } else if (weather.precipitation >= precipitationModerate) {
    riskScore += 2;
    reasons.push('Significant rainfall increases water contamination risk');
  }
  if (forecast) {
    const totalPrecip = forecast.precipitation.reduce((a, b) => a + b, 0);
    if (totalPrecip >= precipitationHigh * 2) {
      riskScore += 2;
      reasons.push('Sustained heavy rainfall forecast may worsen flooding');
    }
  }
  if (weather.humidity >= humidityHigh && weather.temp >= tempHigh) {
    riskScore += 1;
    reasons.push('Warm, humid conditions can accelerate bacterial growth in water');
  }
  if (season.label === 'rainy') {
    riskScore += 1;
    reasons.push('Rainy season increases waterborne disease transmission');
  }
  
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

function calculateTyphoidRisk(weather: WeatherData, forecast: ForecastData | null, season: SeasonInfo): DiseaseRisk {
  const { precipitationModerate, precipitationHigh, humidityHigh } = RISK_THRESHOLDS.typhoid;
  const reasons: string[] = [];
  const actions: string[] = [];
  let riskScore = 0;
  
  if (weather.precipitation >= precipitationHigh) {
    riskScore += 3;
    reasons.push('Heavy rainfall increases risk of water contamination');
  } else if (weather.precipitation >= precipitationModerate) {
    riskScore += 2;
    reasons.push('Recent rainfall may affect water quality');
  }
  if (weather.humidity >= humidityHigh) {
    riskScore += 1;
    reasons.push('High humidity can promote bacterial survival');
  }
  if (season.label === 'rainy') {
    riskScore += 2;
    reasons.push('Typhoid cases often increase during rainy season');
  }
  
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

function calculateMeningitisRisk(weather: WeatherData, season: SeasonInfo, state: string): DiseaseRisk {
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
  if ((season.label === 'harmattan' || season.label === 'dry') && inBelt) {
    riskScore += 3;
    reasons.push('Meningitis season (Dec-May) is active in the meningitis belt');
  }
  
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

function calculateLassaRisk(weather: WeatherData, season: SeasonInfo, state: string): DiseaseRisk {
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
  
  if ((season.label === 'harmattan' || season.label === 'dry') && endemic) {
    riskScore += 3;
    reasons.push('Lassa fever season (Nov-Mar) peaks during dry season in endemic states');
  }
  if (weather.humidity <= humidityLow) {
    riskScore += 2;
    reasons.push('Dry conditions may increase rodent-human contact as rodents seek food/shelter');
  }
  if (weather.temp >= tempRange.min && weather.temp <= tempRange.max) {
    riskScore += 1;
    reasons.push('Current temperatures favorable for rodent activity');
  }
  
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
// INLINED: _shared/risk-engine.ts (AQI INSIGHTS)
// ============================================================================

function getAQIInsight(aqi: AQIData): AQIInsight {
  const levelMap: Record<number, AQIInsight['level']> = {
    1: 'good', 2: 'fair', 3: 'moderate', 4: 'poor', 5: 'very_poor',
  };
  const level = levelMap[aqi.aqi] || 'moderate';
  
  const insights: Record<AQIInsight['level'], Omit<AQIInsight, 'level' | 'levelKey' | 'pollutants'>> = {
    good: {
      description: 'Air quality is satisfactory',
      healthImplications: 'Air quality poses little or no risk',
      recommendations: ['Enjoy outdoor activities normally'],
      sensitiveGroups: [],
    },
    fair: {
      description: 'Air quality is acceptable',
      healthImplications: 'Some pollutants may be of concern for unusually sensitive individuals',
      recommendations: ['Outdoor activities are generally safe', 'Sensitive individuals should monitor symptoms'],
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
      healthImplications: 'Everyone may begin to experience health effects',
      recommendations: [
        'Limit outdoor physical activities',
        'Keep windows and doors closed',
        'Use air purifiers if available',
        'Wear a mask outdoors if necessary',
      ],
      sensitiveGroups: ['Children', 'Elderly', 'People with heart or lung disease', 'Pregnant women'],
    },
    very_poor: {
      description: 'Air quality is very unhealthy',
      healthImplications: 'Health alert: everyone may experience serious health effects',
      recommendations: [
        'Avoid all outdoor physical activities',
        'Stay indoors with windows closed',
        'Use air purifiers',
        'Seek medical attention if experiencing symptoms',
        'Wear N95 masks if going outdoors is unavoidable',
      ],
      sensitiveGroups: ['Everyone, especially vulnerable populations'],
    },
  };
  
  const insight = insights[level];
  const pollutants: AQIInsight['pollutants'] = {};
  
  if (aqi.pm2_5 !== undefined) {
    pollutants.pm2_5 = {
      value: aqi.pm2_5,
      status: aqi.pm2_5 <= 10 ? 'Good' : aqi.pm2_5 <= 25 ? 'Fair' : aqi.pm2_5 <= 50 ? 'Moderate' : 'Poor',
    };
  }
  if (aqi.pm10 !== undefined) {
    pollutants.pm10 = {
      value: aqi.pm10,
      status: aqi.pm10 <= 20 ? 'Good' : aqi.pm10 <= 50 ? 'Fair' : aqi.pm10 <= 100 ? 'Moderate' : 'Poor',
    };
  }
  
  return {
    level,
    levelKey: `aqi_${level}`,
    ...insight,
    pollutants: Object.keys(pollutants).length > 0 ? pollutants : undefined,
  };
}

// ============================================================================
// INLINED: _shared/risk-engine.ts (MAIN ASSESSMENT)
// ============================================================================

function assessDiseaseRisks(weather: WeatherData, forecast: ForecastData | null, state: string): RiskAssessment {
  const now = new Date();
  const month = now.getMonth();
  const season = getNigeriaSeason(month, state);
  const region = getRegion(state);
  
  const diseases: DiseaseRisk[] = [
    calculateMalariaRisk(weather, forecast, season),
    calculateCholeraRisk(weather, forecast, season),
    calculateTyphoidRisk(weather, forecast, season),
    calculateMeningitisRisk(weather, season, state),
    calculateLassaRisk(weather, season, state),
  ];
  
  diseases.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.priority - b.priority;
  });
  
  const activeHighRisks = diseases.filter(d => d.isActive && d.riskLevel === 'high').length;
  const activeMediumRisks = diseases.filter(d => d.isActive && d.riskLevel === 'medium').length;
  
  let overallRiskLevel: RiskLevel = 'low';
  if (activeHighRisks >= 1) {
    overallRiskLevel = 'high';
  } else if (activeMediumRisks >= 2 || activeMediumRisks >= 1) {
    overallRiskLevel = 'medium';
  }
  
  return {
    assessedAt: now.toISOString(),
    location: { state, region },
    season,
    diseases,
    overallRiskLevel,
    disclaimer: HEALTH_DISCLAIMER,
  };
}

// ============================================================================
// MAIN FUNCTION CODE
// ============================================================================

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
  if (OPENWEATHER_API_KEY) {
    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=16&appid=${OPENWEATHER_API_KEY}`),
      ]);

      if (currentRes.ok) {
        const currentData: any = await currentRes.json();
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

  // Fallback to Open-Meteo
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

async function fetchAQI(lat: number, lon: number): Promise<AQIData | null> {
  if (!OPENWEATHER_API_KEY) return null;
  
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`);
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

    // Check DB cache first
    const admin = tryCreateAdminClient();
    if (admin) {
      const { data: cached } = await admin
        .from('intel_cache')
        .select('payload, expires_at')
        .eq('region_key', stateNormalized)
        .eq('scope', 'v2')
        .maybeSingle();

      if (cached?.payload && cached?.expires_at) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          return jsonResponse(cached.payload);
        }
      }
    }

    const coords = NIGERIA_STATE_COORDS[stateNormalized] || { lat: 9.082, lon: 8.6753 };
    
    // Fetch all data in parallel
    const [weatherResult, aqiResult, outbreaks, whoAlerts] = await Promise.all([
      fetchWeather(coords.lat, coords.lon),
      fetchAQI(coords.lat, coords.lon),
      fetchOutbreakData(),
      fetchWHOAlerts(),
    ]);

    const weatherData: WeatherData | null = weatherResult?.current ?? null;
    const forecastData: ForecastData | null = weatherResult?.forecast ?? null;

    let riskAssessment: RiskAssessment | null = null;
    if (weatherData) {
      riskAssessment = assessDiseaseRisks(weatherData, forecastData, stateNormalized);
    }

    const aqiInsight = aqiResult ? getAQIInsight(aqiResult) : null;
    const now = new Date();
    const season = getNigeriaSeason(now.getMonth(), stateNormalized);

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
      
      riskAssessment: riskAssessment ? {
        overallRiskLevel: riskAssessment.overallRiskLevel,
        diseases: riskAssessment.diseases,
        disclaimer: riskAssessment.disclaimer,
      } : null,
      
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
          payload: response,
          expires_at: expiresAt,
          updated_at: nowIso,
        }, { onConflict: 'region_key,scope' });
    }

    return jsonResponse(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg || 'Intel fetch failed' }, { status: 500 });
  }
});
