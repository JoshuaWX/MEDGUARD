import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';
import { optionalEnv, requiredEnv } from '../_shared/env.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';
import { loadPersonalHealthSnapshot, type PersonalHealthSnapshot } from '../_shared/personalHealth.ts';

// ============================================================================
// PERFORMANCE: Request timeout to prevent hanging connections
// ============================================================================
const REQUEST_TIMEOUT_MS = 52000; // Keep buffer under the Supabase Edge Function limit.
const MAX_MESSAGE_CHARS = 1200;
const CHAT_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 12,
};
const GUEST_CHAT_RATE_LIMIT = {
  windowSeconds: 24 * 60 * 60,
  maxRequests: 10,
};

type ChatRequest = {
  conversation_id?: string;
  message: string;
  k?: number;
  guest_session_id?: string;
};

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

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// ============================================================================
// SYSTEM PROMPT - matches Flask app src/prompt.py
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are MedGuard, a friendly and professional AI health assistant. \
Use the following pieces of retrieved context to answer the question. \
If you don't know the answer, say that you don't know. \
Keep your responses concise, warm, and helpful. \
Speak naturally like a caring healthcare professional.

EMOJI GUIDELINES:
- Use emojis minimally (0-2 per response) - they are optional, not required
- Only use actual emoji characters (like 😊 🩺 ⚠️), NEVER describe them in words (don't write "smile" or ":smile:")
- Match the mood: reassuring emoji for comfort, warning emoji for caution, medical emoji for health tips
- Never start responses with emojis
- If the user asks you to use more or fewer emojis, respect their preference for the rest of the conversation`;

// Intent-specific system prompts for better responses
const INTENT_PROMPTS: Record<string, string> = {
  symptom_analysis: `You are analyzing symptoms. Ask clarifying questions if needed:
- When did symptoms start?
- Severity on a scale of 1-10?
- Any triggers or patterns?
- Other accompanying symptoms?
Provide possible explanations but always recommend professional consultation for diagnosis.`,

  medication_info: `You are providing medication information. Include:
- General uses and how it works
- Common side effects
- Important interactions or warnings
- ALWAYS recommend consulting a doctor or pharmacist before starting/stopping medications.
You may use ⚠️ for important warnings if appropriate.`,

  condition_info: `You are explaining a medical condition. Cover:
- What the condition is
- Common causes and risk factors
- Typical symptoms
- General treatment approaches
- When to seek medical care`,

  emergency_guidance: `You are helping assess urgency. Provide clear guidance on:
- Signs that require immediate emergency care
- When to see a doctor soon vs. wait
- What to do while waiting for care
- Local emergency numbers (remind them of 911 in US, 112 in Nigeria)
Use ⚠️ or 🚨 only for genuinely urgent warnings.`,

  lifestyle_guidance: `You are providing health and lifestyle advice. Include:
- Evidence-based recommendations
- Practical, actionable tips
- Gradual changes over drastic measures
- Importance of consistency`,

  greeting: `The user is greeting you. Respond warmly and invite them to share their health concerns. Keep it natural, emoji optional.`,

  gratitude: `The user is expressing thanks. Acknowledge it briefly and offer further assistance. Emoji optional.`,

  followup: `The user wants more information on a previous topic. Reference the conversation history to provide relevant follow-up information.`,

  general: `You are a helpful medical assistant. Answer the question accurately and concisely.`,
};

// ============================================================================
// INTENT RECOGNITION - matches Flask app
// ============================================================================

const INTENT_PATTERNS: Record<string, { keywords: string[]; patterns: RegExp[]; template: string }> = {
  symptom_report: {
    keywords: [
      'symptom', 'symptoms', 'feeling', 'feel', 'pain', 'ache', 'hurt',
      'sore', 'fever', 'cough', 'headache', 'nausea', 'dizzy', 'tired',
      'fatigue', 'swelling', 'rash', 'itching', 'burning', 'numbness',
      'vomiting', 'diarrhea', 'constipation', 'bleeding', 'weak',
    ],
    patterns: [
      /i have (a |an )?/i,
      /i('m| am) (feeling|having|experiencing)/i,
      /my .+ (hurt|ache|pain|sore)/i,
      /(started|been) (feeling|having)/i,
    ],
    template: 'symptom_analysis',
  },
  medication_inquiry: {
    keywords: [
      'medication', 'medicine', 'drug', 'pill', 'tablet', 'dose', 'dosage',
      'prescription', 'otc', 'over the counter', 'antibiotic', 'painkiller',
      'side effect', 'interaction', 'take', 'taking',
    ],
    patterns: [
      /what (medication|medicine|drug)/i,
      /can i take/i,
      /should i take/i,
      /(is|are) .+ safe/i,
      /side effects? of/i,
    ],
    template: 'medication_info',
  },
  condition_inquiry: {
    keywords: [
      'disease', 'condition', 'disorder', 'syndrome', 'diagnosis', 'diagnose',
      'what is', 'what are', 'explain', 'tell me about', 'cause', 'causes',
      'treatment', 'cure', 'chronic', 'acute',
    ],
    patterns: [
      /what (is|are|causes)/i,
      /tell me (about|more)/i,
      /how (is|are) .+ (treated|diagnosed)/i,
      /can .+ be cured/i,
    ],
    template: 'condition_info',
  },
  emergency_check: {
    keywords: [
      'emergency', 'urgent', 'hospital', '911', 'ambulance', 'er',
      'emergency room', 'serious', 'severe', 'dangerous', 'life threatening',
    ],
    patterns: [
      /should i (go to|call|visit)/i,
      /is (this|it) (serious|an emergency|dangerous)/i,
      /when (should|do) i (see|call|go)/i,
    ],
    template: 'emergency_guidance',
  },
  lifestyle_advice: {
    keywords: [
      'diet', 'exercise', 'sleep', 'stress', 'weight', 'nutrition',
      'healthy', 'lifestyle', 'prevent', 'prevention', 'avoid', 'reduce',
      'improve', 'better', 'tips', 'advice', 'recommend',
    ],
    patterns: [
      /how (can|do) i (prevent|improve|reduce)/i,
      /what (should|can) i (eat|do|avoid)/i,
      /(tips|advice) (for|on|about)/i,
    ],
    template: 'lifestyle_guidance',
  },
  greeting: {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'],
    patterns: [/^(hi|hello|hey|howdy)[\s!.,?]*$/i],
    template: 'greeting',
  },
  gratitude: {
    keywords: ['thank', 'thanks', 'appreciate', 'helpful', 'great'],
    patterns: [/^(thank|thanks)/i, /(that|this) (was|is) helpful/i],
    template: 'gratitude',
  },
  followup: {
    keywords: ['more', 'else', 'also', 'another', 'what about', 'how about', 'and', 'additionally', 'furthermore'],
    patterns: [/^(what|how) about/i, /^and (what|how|if)/i, /anything else/i, /tell me more/i],
    template: 'followup',
  },
};

function classifyIntent(query: string, hasHistory: boolean): { intent: string; confidence: number } {
  const queryLower = query.toLowerCase().trim();
  const scores: Record<string, number> = {};

  for (const [intentName, intentData] of Object.entries(INTENT_PATTERNS)) {
    const { keywords, patterns } = intentData;

    // Keyword matching (60% weight)
    const keywordMatches = keywords.filter((kw) => queryLower.includes(kw)).length;
    const keywordScore = keywords.length > 0 ? keywordMatches / keywords.length : 0;
    scores[intentName] = (scores[intentName] || 0) + keywordScore * 0.6;

    // Pattern matching (40% weight)
    const patternMatches = patterns.filter((p) => p.test(queryLower)).length;
    const patternScore = patterns.length > 0 ? Math.min(patternMatches / patterns.length, 1.0) : 0;
    scores[intentName] = (scores[intentName] || 0) + patternScore * 0.4;
  }

  // Boost followup intent if history exists and query is short
  if (hasHistory && queryLower.split(/\s+/).length < 5) {
    scores['followup'] = (scores['followup'] || 0) + 0.2;
  }

  const entries = Object.entries(scores).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return { intent: 'general', confidence: 0 };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [bestIntent, bestScore] = entries[0];
  const confidence = Math.min(bestScore, 1.0);

  if (confidence < 0.15) {
    return { intent: 'general', confidence };
  }

  return { intent: INTENT_PATTERNS[bestIntent]?.template || 'general', confidence };
}

function shouldUseRag(intent: string, message: string): boolean {
  if (intent === 'greeting' || intent === 'gratitude') return false;
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 3 && !/[?]/.test(message)) return false;
  return true;
}

function sanitizeGuestSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(cleaned) ? cleaned : null;
}

// ============================================================================
// EMBEDDINGS - Use HuggingFace Inference API (same model as Flask app)
// Model: sentence-transformers/all-MiniLM-L6-v2 → 384 dimensions
// Works without token (rate-limited) or with optional HF_API_KEY for higher limits
// ============================================================================

function _sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(str: string, max = 400) {
  const s = str ?? '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const OPENROUTER_CANONICAL_BASE = 'https://openrouter.ai/api/v1';

function isLikelyGatewayRouteError(status: number, bodyText: string): boolean {
  if (status !== 404) return false;
  const s = (bodyText || '').toLowerCase();
  return (
    s.includes('no matching route found') ||
    s.includes('not configured in the gateway') ||
    s.includes('configured in the gateway')
  );
}

async function openRouterFetch(path: string, init: RequestInit): Promise<Response> {
  const baseFromEnv = optionalEnv('OPENROUTER_BASE_URL') || OPENROUTER_CANONICAL_BASE;
  const primaryBase = baseFromEnv.replace(/\/$/, '');
  const canonicalBase = OPENROUTER_CANONICAL_BASE;

  const r1 = await fetch(`${primaryBase}${path}`, init);
  if (r1.ok) return r1;

  const body1Raw = await r1.text();
  const shouldFallback =
    primaryBase !== canonicalBase && isLikelyGatewayRouteError(r1.status, body1Raw);

  if (!shouldFallback) {
    throw new Error(`OpenRouter ${r1.status}: ${truncate(body1Raw)}`);
  }

  const r2 = await fetch(`${canonicalBase}${path}`, init);
  if (r2.ok) return r2;

  const body2Raw = await r2.text();
  throw new Error(
    `OpenRouter gateway ${r1.status}: ${truncate(body1Raw)} | direct ${r2.status}: ${truncate(body2Raw)}`,
  );
}

function _normalizeEmbedding(raw: unknown): number[] | null {
  // HF feature-extraction can return:
  // - 1D: number[]
  // - 2D: number[][] (token embeddings) => we mean-pool to 1D
  if (!Array.isArray(raw) || raw.length === 0) return null;

  if (typeof raw[0] === 'number') {
    const v = raw as number[];
    return v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? v : null;
  }

  if (Array.isArray(raw[0])) {
    const rows = raw as unknown[];
    const firstRow = rows.find((r) => Array.isArray(r) && r.length > 0) as unknown[] | undefined;
    if (!firstRow) return null;

    const dims = firstRow.length;
    const sums = new Array<number>(dims).fill(0);
    let count = 0;

    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== dims) continue;
      let ok = true;
      for (let i = 0; i < dims; i++) {
        const n = (row as unknown[])[i];
        if (typeof n !== 'number' || !Number.isFinite(n)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      for (let i = 0; i < dims; i++) {
        sums[i] += (row as number[])[i];
      }
      count++;
    }

    if (count === 0) return null;
    return sums.map((s) => s / count);
  }

  return null;
}

// ============================================================================
// EMBEDDINGS - query with the same MiniLM vector space used for ingestion.
// ============================================================================
async function getEmbedding(text: string): Promise<number[]> {
  const hfToken = optionalEnv('HUGGINGFACE_API_KEY') || optionalEnv('HF_API_KEY');
  const hfModel = optionalEnv('HF_EMBEDDINGS_MODEL') || optionalEnv('EMBEDDINGS_MODEL') || 'sentence-transformers/all-MiniLM-L6-v2';

  if (!hfToken) {
    throw new Error('HF_API_KEY is required for MiniLM RAG query embeddings.');
  }

  const endpoint = `https://api-inference.huggingface.co/pipeline/feature-extraction/${hfModel}`;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hfToken}`,
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: false } }),
  });
  if (!r.ok) throw new Error(`HF ${r.status}`);
  const raw = await r.json();
  const emb = _normalizeEmbedding(raw);
  if (!emb || emb.length !== 384) throw new Error(`HF invalid embedding shape: ${emb?.length || 0}`);
  return emb;
}

// ============================================================================
// PINECONE QUERY
// ============================================================================

async function queryPinecone(vector: number[], topK: number): Promise<string[]> {
  const apiKey = requiredEnv('PINECONE_API_KEY');
  const host = requiredEnv('PINECONE_HOST');

  const r = await fetch(`https://${host}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
    },
    body: JSON.stringify({ vector, topK, includeMetadata: true }),
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }

  type PineconeMatch = { metadata?: { text?: string; pageContent?: string; content?: string } };
  const j = await r.json() as { matches?: PineconeMatch[] };
  const matches: PineconeMatch[] = Array.isArray(j?.matches) ? j.matches : [];

  return matches
    .map((m) => {
      const md = m?.metadata || {};
      const text = md.text || md.pageContent || md.content || '';
      return typeof text === 'string' ? text : '';
    })
    .filter((t) => t.trim().length > 0);
}

// ============================================================================
// LLM CHAT COMPLETION — Multi-provider with direct API fallbacks
// ============================================================================
// Provider priority:
//   1. OpenRouter free models (5 models, sequential fallback)
//   2. Google Gemini API (free tier: 15 RPM, 1M tokens/day)
//   3. Groq API (free tier: 30 RPM, very fast inference)
// Set GOOGLE_GEMINI_KEY and/or GROQ_API_KEY as Supabase secrets.
// ============================================================================

const FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

// ---------- Google Gemini (direct) ----------
async function geminiCompletion(params: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const key = optionalEnv('GOOGLE_GEMINI_KEY');
  if (!key) throw new Error('GOOGLE_GEMINI_KEY not set');

  const model = optionalEnv('GEMINI_MODEL') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const contents = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: params.system }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Gemini ${r.status}: ${truncate(errText)}`);
  }

  type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const j = (await r.json()) as GeminiResponse;
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Gemini: empty response');
  }
  return text;
}

// ---------- Groq (direct) ----------
async function groqCompletion(params: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const key = optionalEnv('GROQ_API_KEY');
  if (!key) throw new Error('GROQ_API_KEY not set');

  const model = optionalEnv('GROQ_MODEL') || 'llama-3.1-8b-instant';

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 500,
      messages: [{ role: 'system', content: params.system }, ...params.messages],
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Groq ${r.status}: ${truncate(errText)}`);
  }

  const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Groq: empty response');
  }
  return content;
}

// ---------- Main chatCompletion with multi-provider fallback ----------
async function chatCompletion(params: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const openrouterKey = optionalEnv('OPENROUTER_API_KEY');
  const envModel = optionalEnv('OPENROUTER_MODEL');
  const errors: string[] = [];

  // --- OpenRouter path ---
  if (openrouterKey) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openrouterKey}`,
    };
    const referer = optionalEnv('OPENROUTER_HTTP_REFERER');
    const title = optionalEnv('OPENROUTER_APP_TITLE') || 'MEDGUARD';
    if (referer) headers['HTTP-Referer'] = referer;
    if (title) headers['X-Title'] = title;

    const makeRequest = async (modelId: string): Promise<string> => {
      const r = await openRouterFetch('/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          temperature: 0.7,
          max_tokens: 500,
          messages: [{ role: 'system', content: params.system }, ...params.messages],
          route: 'fallback',
          provider: {
            allow_fallbacks: true,
            order: ['DeepInfra', 'Together', 'Fireworks', 'Lepton'],
          },
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        const err = new Error(`${modelId}: ${r.status} ${truncate(errText)}`) as Error & { status: number };
        err.status = r.status;
        throw err;
      }

      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = j?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error(`${modelId}: empty response`);
      }
      return content;
    };

    // If user set a specific model via env, just use that (with one retry on 429)
    if (envModel) {
      try {
        return await makeRequest(envModel);
      } catch (e: unknown) {
        if ((e as { status?: number })?.status === 429) {
          await _sleep(2000);
          return await makeRequest(envModel);
        }
        throw e;
      }
    }

    // Cycle through free models
    for (const modelId of FREE_MODELS) {
      try {
        return await makeRequest(modelId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        const status = (e as { status?: number })?.status;
        if (status === 429) await _sleep(500);
        continue;
      }
    }
  }

  // --- Google Gemini fallback ---
  try {
    const result = await geminiCompletion(params);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('not set')) errors.push(msg);
  }

  // --- Groq fallback ---
  try {
    const result = await groqCompletion(params);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('not set')) errors.push(msg);
  }

  throw new Error(`All providers failed: ${errors.join(' | ')}`);
}

// ============================================================================
// CONTEXT BUILDING - matches Flask app
// ============================================================================

interface UserProfile {
  full_name?: string;
  name?: string;
  state?: string;
  age?: number;
  gender?: string;
  conditions?: string[] | string;
  allergies?: string[] | string;
  medications?: string[] | string;
}

/** Normalize a profile list field (text[] or comma string) to clean entries. */
function normalizeList(value: string[] | string | undefined | null): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const out: string[] = [];
  for (const item of raw) {
    const cleaned = String(item).trim();
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
    if (out.length >= 12) break;
  }
  return out;
}

function buildUserContext(
  profile: UserProfile | null,
  snapshot?: PersonalHealthSnapshot | null,
): string {
  const parts: string[] = [];

  if (profile) {
    const name = (profile.full_name || profile.name || '').trim();
    if (name) parts.push(`User name: ${name}.`);

    const state = (profile.state || '').trim();
    if (state) parts.push(`User location/state: ${state}.`);

    const age = profile.age;
    if (age) parts.push(`User age: ${age}.`);

    const gender = (profile.gender || '').trim();
    if (gender) parts.push(`User gender: ${gender}.`);

    // Known medical history — use to give safer, more relevant guidance
    // (e.g. respect allergies). Do NOT treat these as the current complaint.
    const conditions = normalizeList(profile.conditions);
    if (conditions.length) parts.push(`Known conditions: ${conditions.join(', ')}.`);
    const allergies = normalizeList(profile.allergies);
    if (allergies.length) parts.push(`Known allergies: ${allergies.join(', ')}.`);
    const medications = normalizeList(profile.medications);
    if (medications.length) parts.push(`Current medications: ${medications.join(', ')}.`);
  }

  // MedGuard Brain awareness: the user's own current health picture. Use this
  // to personalize, NOT to diagnose or to confirm any condition/outbreak.
  if (snapshot) {
    const health: string[] = [];
    health.push(`Current personal health-risk level: ${snapshot.riskLevel} (confidence: ${snapshot.confidence}).`);
    // Always state check-in status so the assistant can answer "have I checked
    // in today?" accurately.
    if (snapshot.hasCheckedInToday) {
      health.push(`Daily check-in today: done${snapshot.todayCheckinRisk ? ` (risk ${snapshot.todayCheckinRisk})` : ''}.`);
    } else {
      health.push(`Daily check-in today: not done yet.`);
    }
    if (snapshot.streak > 0) {
      health.push(`Check-in streak: ${snapshot.streak} day(s).`);
    }
    if (snapshot.topSignalSummaries.length > 0) {
      health.push(`Recent health signals: ${snapshot.topSignalSummaries.join('; ')}.`);
    }
    if (snapshot.recentSymptoms.length > 0) {
      health.push(`Recently logged symptoms: ${snapshot.recentSymptoms.join(', ')}.`);
    }
    if (health.length > 0) {
      parts.push(
        `MedGuard health snapshot (personalize with this; never diagnose or confirm an outbreak):\n${health.join('\n')}`,
      );
    }
  }

  return parts.join('\n');
}

function formatHistoryForLLM(history: Array<{ role: string; content: string }>): string {
  if (!history || history.length === 0) return '';

  return history
    .map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${m.content}`;
    })
    .join('\n');
}

// ============================================================================
// SYMPTOM EXTRACTION (write-back loop to the Brain)
// ----------------------------------------------------------------------------
// Pulls symptoms the user reports experiencing THEMSELVES out of their message,
// constrained to a fixed vocabulary, and stores them in `symptom_logs` so the
// MedGuard Brain's personal scope reacts to them next time. Strictly awareness:
// we record a reported symptom, we never infer or store a diagnosis.
// ============================================================================

/** Canonical symptom keys we are willing to store. Anything else is ignored. */
const SYMPTOM_KEYS = [
  'fever', 'cough', 'headache', 'sore_throat', 'fatigue', 'body_pain',
  'nausea', 'vomiting', 'diarrhea', 'constipation', 'rash', 'itching',
  'dizziness', 'chills', 'breathing', 'chest_pain', 'bleeding', 'weakness',
  'runny_nose', 'loss_of_appetite', 'abdominal_pain', 'back_pain',
] as const;

const SYMPTOM_EXTRACTION_SYSTEM = `You extract symptoms a user reports CURRENTLY EXPERIENCING THEMSELVES from their message.
Only use keys from this exact list: ${SYMPTOM_KEYS.join(', ')}.
Rules:
- Include a key ONLY if the user says they (or "I") currently have/feel it.
- Do NOT include symptoms they ask about in general, ask definitions of, or deny having.
- Do NOT diagnose or add conditions. Symptoms only.
- Respond with ONLY a compact JSON array of keys, e.g. ["fever","cough"]. If none, respond [].`;

function parseSymptomKeys(raw: string): string[] {
  if (!raw) return [];
  // Strip code fences / stray prose; grab the first JSON array.
  const match = raw.match(/\[[^\]]*\]/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const allow = new Set<string>(SYMPTOM_KEYS as readonly string[]);
  const out: string[] = [];
  for (const item of parsed) {
    const key = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (allow.has(key) && !out.includes(key)) out.push(key);
    if (out.length >= 6) break;
  }
  return out;
}

/** Best-effort symptom extraction. Returns [] on any failure (never throws). */
async function extractSymptomsFromMessage(message: string): Promise<string[]> {
  try {
    const raw = await chatCompletion({
      system: SYMPTOM_EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: message }],
    });
    return parseSymptomKeys(raw);
  } catch {
    return [];
  }
}

// ============================================================================
// MAIN HANDLER - OPTIMIZED FOR PERFORMANCE & CONCURRENCY
// ============================================================================

// Timeout wrapper for async operations
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  const requestStart = Date.now();

  try {
    const body: ChatRequest = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const topK = clampInt(body?.k, 1, 5, 3);

    if (!message) return jsonResponse({ error: 'message is required' }, { status: 400 });
    if (message.length > MAX_MESSAGE_CHARS) {
      return jsonResponse({ error: `Message is too long. Please keep it under ${MAX_MESSAGE_CHARS} characters.` }, { status: 400 });
    }

    const supabase = createUserClient(req);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userErr ? null : userData?.user?.id || null;
    const isGuest = !userId;
    const guestSessionId = isGuest ? sanitizeGuestSessionId(body?.guest_session_id) : null;

    if (isGuest && !guestSessionId) {
      return jsonResponse({ error: 'Guest session is required.' }, { status: 400 });
    }

    const rate = await enforceRateLimit(req, {
      bucket: isGuest ? 'chat_guest' : 'chat',
      windowSeconds: isGuest ? GUEST_CHAT_RATE_LIMIT.windowSeconds : CHAT_RATE_LIMIT.windowSeconds,
      maxRequests: isGuest ? GUEST_CHAT_RATE_LIMIT.maxRequests : CHAT_RATE_LIMIT.maxRequests,
      userId,
      subjectId: isGuest ? `guest:${guestSessionId}` : null,
    });
    if (rate && !rate.allowed) {
      return jsonResponse(
        {
          error: 'Too many chat requests. Please wait before sending another message.',
          guest: isGuest,
          guest_remaining: isGuest ? 0 : undefined,
          retryAfterSeconds: rate.retryAfterSeconds,
          resetAt: rate.resetAt,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    type HistoryMessage = { role?: string; content?: string };
    let profile: UserProfile | null = null;
    let conversationId = body?.conversation_id || null;
    let previousMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let healthSnapshot: PersonalHealthSnapshot | null = null;

    if (!isGuest && userId) {
      const conversationPromise = (async () => {
      if (conversationId) {
        const { data: conv, error: convErr } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .maybeSingle();

        if (convErr) throw convErr;
        if (!conv?.id) throw new Error('Conversation not found');
        return conversationId;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('chat_conversations')
          .insert({ user_id: userId, title: '' })
          .select('id')
          .single();
        if (createErr) throw createErr;
        return created.id;
      }
      })();

      const [resolvedConversationId, profileResult] = await Promise.all([
        conversationPromise,
        supabase
          .from('profiles')
          .select('full_name, state, age, gender, conditions, allergies, medications')
          .eq('id', userId)
          .maybeSingle(),
      ]);
      conversationId = resolvedConversationId;
      profile = (profileResult.data as UserProfile | null) || null;

      // Load history and the shared MedGuard personal health snapshot in
      // parallel. The snapshot makes chat health-aware; failure must never
      // break chat, so it is swallowed to null.
      const area = (profile?.state || '').trim();
      const [historyResult, snapshot] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(20),
        loadPersonalHealthSnapshot(supabase, area).catch(() => null),
      ]);
      healthSnapshot = snapshot;

      if (historyResult.error) throw historyResult.error;
      previousMessages = ((historyResult.data as HistoryMessage[] || [])
        .filter((m: HistoryMessage) => m?.role === 'user' || m?.role === 'assistant')
        .map((m: HistoryMessage) => ({ role: m.role as 'user' | 'assistant', content: String(m.content || '') }))
        .filter((m: { role: 'user' | 'assistant'; content: string }) => m.content.trim().length > 0))
        .reverse();
    }

    const historyMessages = [...previousMessages, { role: 'user' as const, content: message }];

    // ========================================================================
    // PERFORMANCE: Check remaining time before expensive operations
    // ========================================================================

    const elapsed = Date.now() - requestStart;
    const remainingTime = REQUEST_TIMEOUT_MS - elapsed;
    if (remainingTime < 10000) {
      return jsonResponse({ 
        error: 'Request timeout - please try again',
        conversation_id: conversationId 
      }, { status: 504 });
    }

    // Classify intent (fast, synchronous operation)
    const { intent } = classifyIntent(message, previousMessages.length > 0);
    const intentPrompt = INTENT_PROMPTS[intent] || INTENT_PROMPTS['general'];

    let contextChunks: string[] = [];
    let ragStatus: 'skipped' | 'ok' | 'degraded' = 'skipped';
    if (shouldUseRag(intent, message)) {
      try {
        const embedding = await withTimeout(getEmbedding(message), 10000, 'Embedding generation');
        contextChunks = await withTimeout(queryPinecone(embedding, topK), 8000, 'Vector search');
        ragStatus = 'ok';
      } catch (ragError: unknown) {
        ragStatus = 'degraded';
        console.warn(JSON.stringify({
          event: 'chat_rag_degraded',
          reason: ragError instanceof Error ? ragError.message : String(ragError),
          intent,
          isGuest,
        }));
      }
    }
    const retrievedContext = contextChunks.join('\n\n---\n\n');

    // Build context (fast operations)
    const userContext = buildUserContext(profile, healthSnapshot);
    const historyText = formatHistoryForLLM(previousMessages);

    const contextParts: string[] = [];
    if (userContext) contextParts.push(`User context:\n${userContext}`);
    if (historyText) contextParts.push(`Conversation history:\n${historyText}`);
    if (retrievedContext) contextParts.push(`Retrieved medical knowledge:\n${retrievedContext}`);

    const fullContext = contextParts.join('\n\n---\n\n');

    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${fullContext}

Additional guidance for this query:
${intentPrompt}`;

    // ========================================================================
    // PERFORMANCE: LLM call with dynamic timeout based on remaining time
    // ========================================================================
    const llmRemainingTime = REQUEST_TIMEOUT_MS - (Date.now() - requestStart);
    if (llmRemainingTime < 5000) {
      return jsonResponse({
        error: 'Request timeout - please try again',
        conversation_id: isGuest ? null : conversationId,
      }, { status: 504 });
    }
    const llmTimeout = Math.min(llmRemainingTime - 1500, 24000);

    // Generate the answer and (for authenticated symptom messages) extract any
    // self-reported symptoms in parallel — both only need the user message, so
    // there is no added latency. Extraction never throws.
    const shouldExtractSymptoms = !isGuest && !!userId && intent === 'symptom_analysis';
    const [answer, extractedSymptoms] = await Promise.all([
      withTimeout(
        chatCompletion({ system: systemPrompt, messages: historyMessages }),
        llmTimeout,
        'AI response generation'
      ),
      shouldExtractSymptoms ? extractSymptomsFromMessage(message) : Promise.resolve([] as string[]),
    ]);

    if (!isGuest && conversationId) {
      const { error: persistErr } = await supabase
        .from('chat_messages')
        .insert([
          { conversation_id: conversationId, role: 'user', content: message },
          { conversation_id: conversationId, role: 'assistant', content: answer || '' },
        ]);

      if (persistErr) {
        console.warn(JSON.stringify({
          event: 'chat_persist_failed',
          conversation_id: conversationId,
          reason: persistErr.message,
        }));
      }
    }

    // Write-back loop: store chat-derived symptoms so the Brain reacts to them.
    if (!isGuest && userId && extractedSymptoms.length > 0) {
      const stateVal = (profile?.state || '').trim() || null;
      const occurredAt = new Date().toISOString();
      const rows = extractedSymptoms.map((key) => ({
        user_id: userId,
        symptom_key: key,
        source: 'chat',
        state: stateVal,
        occurred_at: occurredAt,
      }));
      const { error: symErr } = await supabase.from('symptom_logs').insert(rows);
      if (symErr) {
        console.warn(JSON.stringify({
          event: 'chat_symptom_log_failed',
          reason: symErr.message,
        }));
      }
    }

    console.log(JSON.stringify({
      event: 'chat_completed',
      ms: Date.now() - requestStart,
      intent,
      ragStatus,
      isGuest,
      symptomsLogged: extractedSymptoms.length,
    }));

    return jsonResponse({
      conversation_id: isGuest ? null : conversationId,
      answer,
      guest: isGuest || undefined,
      guest_remaining: isGuest && rate ? rate.remaining : undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    
    // ========================================================================
    // ERROR HANDLING: User-friendly error messages
    // ========================================================================
    let userMessage = 'Something went wrong. Please try again.';
    let status = 500;

    if (msg.includes('timed out')) {
      userMessage = 'The request took too long. Please try again with a shorter message.';
      status = 504;
    } else if (msg.includes('rate limit') || msg.includes('429')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
      status = 429;
    } else if (msg.includes('Unauthorized') || msg.includes('401')) {
      userMessage = 'Please sign in to continue.';
      status = 401;
    } else if (msg.includes('Conversation not found')) {
      userMessage = 'Chat not found. Starting a new conversation.';
      status = 404;
    }

    return jsonResponse({ error: userMessage }, { status });
  }
});
