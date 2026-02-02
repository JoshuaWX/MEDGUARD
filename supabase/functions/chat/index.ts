// @deno-types="https://deno.land/std@0.224.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';
import { optionalEnv, requiredEnv } from '../_shared/env.ts';

// ============================================================================
// PERFORMANCE: Request timeout to prevent hanging connections
// ============================================================================
const REQUEST_TIMEOUT_MS = 55000; // 55 seconds (Supabase Edge Function limit is 60s)

type ChatRequest = {
  conversation_id?: string;
  message: string;
  k?: number;
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

// ============================================================================
// EMBEDDINGS - Use HuggingFace Inference API (same model as Flask app)
// Model: sentence-transformers/all-MiniLM-L6-v2 → 384 dimensions
// Works without token (rate-limited) or with optional HF_API_KEY for higher limits
// ============================================================================

function sleep(ms: number) {
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
// EMBEDDINGS - OPTIMIZED: Race providers in parallel for fastest response
// ============================================================================
async function getEmbedding(text: string): Promise<number[]> {
  const hfToken = optionalEnv('HUGGINGFACE_API_KEY') || optionalEnv('HF_API_KEY');
  const hfModel = optionalEnv('HF_EMBEDDINGS_MODEL') || optionalEnv('EMBEDDINGS_MODEL') || 'sentence-transformers/all-MiniLM-L6-v2';
  const dimensions = clampInt(optionalEnv('EMBEDDINGS_DIMENSIONS') ?? '384', 1, 4096, 384);
  const openrouterKey = optionalEnv('OPENROUTER_API_KEY');
  const openaiKey = optionalEnv('OPENAI_API_KEY');

  // Build list of embedding provider attempts
  const providers: Array<() => Promise<number[]>> = [];

  // HuggingFace provider (single attempt, no retry delays)
  if (hfToken) {
    providers.push(async () => {
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
      if (!emb || emb.length === 0) throw new Error('HF invalid shape');
      return emb;
    });
  }

  // OpenRouter embeddings provider
  if (openrouterKey) {
    const model = optionalEnv('OPENROUTER_EMBEDDINGS_MODEL') || 'openai/text-embedding-3-small';
    providers.push(async () => {
      const r = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({ model, input: text, dimensions }),
      });
      if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
      const j = await r.json() as { data?: Array<{ embedding?: number[] }> };
      const emb = j?.data?.[0]?.embedding;
      if (!Array.isArray(emb) || emb.length === 0) throw new Error('OpenRouter invalid shape');
      return emb;
    });
  }

  // OpenAI direct provider
  if (openaiKey) {
    providers.push(async () => {
      const r = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions }),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}`);
      const j = await r.json() as { data?: Array<{ embedding?: number[] }> };
      const emb = j?.data?.[0]?.embedding;
      if (!Array.isArray(emb) || emb.length === 0) throw new Error('OpenAI invalid shape');
      return emb;
    });
  }

  if (providers.length === 0) {
    throw new Error('No embedding providers configured. Set HF_API_KEY or OPENROUTER_API_KEY.');
  }

  // PERFORMANCE: Race all providers - first successful response wins
  // This eliminates sequential fallback delays
  const results = await Promise.allSettled(providers.map(p => p()));
  
  // Return first successful result
  for (const result of results) {
    if (result.status === 'fulfilled') {
      return result.value;
    }
  }

  // All failed - throw combined error
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason?.message || String(r.reason));
  throw new Error(`All embedding providers failed: ${errors.join(' | ')}`);
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
// LLM CHAT COMPLETION
// ============================================================================

// ============================================================================
// LLM CHAT COMPLETION - OPTIMIZED: Single model with OpenRouter auto-routing
// ============================================================================
// Use OpenRouter's built-in model routing instead of manual fallbacks
// This lets OpenRouter pick the fastest available provider automatically
const PRIMARY_MODEL = 'deepseek/deepseek-r1-0528:free';
const FALLBACK_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';

async function chatCompletion(params: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const apiKey = requiredEnv('OPENROUTER_API_KEY');
  const envModel = optionalEnv('OPENROUTER_MODEL');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const referer = optionalEnv('OPENROUTER_HTTP_REFERER');
  const title = optionalEnv('OPENROUTER_APP_TITLE') || 'MEDGUARD';
  if (referer) headers['HTTP-Referer'] = referer;
  if (title) headers['X-Title'] = title;

  // PERFORMANCE: Use OpenRouter's built-in routing with fallback
  // This is faster than manual sequential fallbacks
  const model = envModel || PRIMARY_MODEL;
  
  const makeRequest = async (modelId: string): Promise<string> => {
    const r = await openRouterFetch('/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        temperature: 0.7,
        max_tokens: 500,
        messages: [{ role: 'system', content: params.system }, ...params.messages],
        // Let OpenRouter handle provider selection for speed
        route: 'fallback',
        provider: {
          allow_fallbacks: true,
          // Prefer faster providers
          order: ['DeepInfra', 'Together', 'Fireworks', 'Lepton'],
        },
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`${modelId}: ${r.status} ${truncate(errText)}`);
    }

    const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = j?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error(`${modelId}: empty response`);
    }
    return content;
  };

  // Try primary model first, fallback to faster model if it fails
  try {
    return await makeRequest(model);
  } catch (primaryError) {
    // Only try fallback if not using env override
    if (!envModel && model !== FALLBACK_MODEL) {
      try {
        console.log(`Primary model failed, trying fallback: ${primaryError}`);
        return await makeRequest(FALLBACK_MODEL);
      } catch (fallbackError) {
        throw new Error(
          `All models failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)} | ` +
          `${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        );
      }
    }
    throw primaryError;
  }
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

function buildUserContext(profile: UserProfile | null): string {
  if (!profile) return '';
  const parts: string[] = [];

  const name = (profile.full_name || profile.name || '').trim();
  if (name) parts.push(`User name: ${name}.`);

  const state = (profile.state || '').trim();
  if (state) parts.push(`User location/state: ${state}.`);

  const age = profile.age;
  if (age) parts.push(`User age: ${age}.`);

  const gender = (profile.gender || '').trim();
  if (gender) parts.push(`User gender: ${gender}.`);

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

  // Start request timer for overall timeout
  const requestStart = Date.now();

  try {
    const body: ChatRequest = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const topK = clampInt(body?.k, 1, 8, 3);

    if (!message) return jsonResponse({ error: 'message is required' }, { status: 400 });

    const supabase = createUserClient(req);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userData.user.id;

    // ========================================================================
    // PERFORMANCE: Run independent operations in parallel
    // - Profile fetch, conversation setup, and embedding generation are independent
    // ========================================================================
    
    // Start embedding generation immediately (most time-consuming operation)
    const embeddingPromise = withTimeout(
      getEmbedding(message),
      20000,
      'Embedding generation'
    );

    // Fetch profile in parallel
    const profilePromise = supabase
      .from('profiles')
      .select('full_name, state, age, gender')
      .eq('id', userId)
      .maybeSingle();

    // Handle conversation creation/validation
    let conversationId = body?.conversation_id || null;

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

    // Wait for conversation to be ready (needed for message insert)
    const [resolvedConversationId, { data: profile }] = await Promise.all([
      conversationPromise,
      profilePromise,
    ]);
    conversationId = resolvedConversationId;

    // Insert user message (non-blocking, we don't need to wait for confirmation)
    // But we do need it to complete before fetching history
    await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role: 'user', content: message });

    // ========================================================================
    // PERFORMANCE: Parallel fetch of history + wait for embedding
    // ========================================================================
    const [embedding, historyResult] = await Promise.all([
      embeddingPromise,
      supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20),
    ]);

    if (historyResult.error) throw historyResult.error;

    type HistoryMessage = { role?: string; content?: string };
    const historyMessages = (historyResult.data as HistoryMessage[] || [])
      .filter((m: HistoryMessage) => m?.role === 'user' || m?.role === 'assistant')
      .map((m: HistoryMessage) => ({ role: m.role as 'user' | 'assistant', content: String(m.content || '') }))
      .filter((m: { role: 'user' | 'assistant'; content: string }) => m.content.trim().length > 0);

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
    const { intent } = classifyIntent(message, historyMessages.length > 1);
    const intentPrompt = INTENT_PROMPTS[intent] || INTENT_PROMPTS['general'];

    // Query Pinecone with timeout
    const contextChunks = await withTimeout(
      queryPinecone(embedding, topK),
      15000,
      'Vector search'
    );
    const retrievedContext = contextChunks.join('\n\n---\n\n');

    // Build context (fast operations)
    const userContext = buildUserContext(profile);
    const historyText = formatHistoryForLLM(historyMessages.slice(0, -1));

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
    const llmTimeout = Math.min(remainingTime - 2000, 30000); // Leave 2s buffer for response
    const answer = await withTimeout(
      chatCompletion({ system: systemPrompt, messages: historyMessages }),
      llmTimeout,
      'AI response generation'
    );

    // Insert assistant message (fire and forget - don't block response)
    // Using .then() to handle errors without blocking
    supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content: answer || '' })
      .then(({ error }) => {
        if (error) console.error('Failed to save assistant message:', error.message);
      });

    return jsonResponse({ conversation_id: conversationId, answer });
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

    console.error(`Chat error: ${msg}`);
    return jsonResponse({ error: userMessage }, { status });
  }
});
