/**
 * MedGuard Brain v1 — Small LLM explanation helper (Phase 3)
 *
 * PURPOSE: phrase a SAFE, user-facing summary sentence from already-computed
 * structured signals. This is a controlled explanation layer, NOT the chatbot.
 *
 * HARD BOUNDARIES (Amendment #4):
 *  - No RAG, no Pinecone, no chat history, no conversation memory.
 *  - Input is structured signal facts only (no raw user prompt).
 *  - Output is a single short summary string; the caller validates it through
 *    safetyGuardrails and falls back to deterministic text on any failure.
 *  - recommendedActions are NEVER produced here (deterministic-only elsewhere).
 *
 * It reuses the same provider ENV names as the chat function (OpenRouter ->
 * Gemini -> Groq) but via its own minimal client so the two paths stay
 * independent. If no provider key is configured, it throws and the caller
 * uses the deterministic summary.
 */

import { optionalEnv } from '../env.ts';
import type { BrainSignal, BrainRiskLevel } from './types.ts';

export interface LlmExplainInput {
  area: string;
  riskLevel: BrainRiskLevel;
  signals: BrainSignal[];
  /** Hard cap on the LLM call so it never blocks the intel response. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 6000;

const SYSTEM_PROMPT = [
  'You are MedGuard, a public-health awareness assistant for Nigeria.',
  'Rewrite the given structured health-risk signals into ONE short, calm,',
  'plain-language paragraph (2-3 sentences) for a general audience.',
  'STRICT RULES:',
  '- Do NOT diagnose anyone or say "you have <disease>".',
  '- Do NOT confirm or declare an outbreak.',
  '- Do NOT prescribe medication or dosages.',
  '- Do NOT use panic or alarmist language, and do NOT invent facts.',
  '- Only use the provided signals. Be measured and non-certain.',
  '- End by reminding the reader this is not a diagnosis and to seek care if',
  '  symptoms persist or worsen.',
  'Return ONLY the paragraph text, no preamble, no lists.',
].join(' ');

/** Build a compact, fact-only user prompt from the signals (no PII, no raw text). */
function buildFactPrompt(input: LlmExplainInput): string {
  const facts = input.signals.map((s, i) => {
    const src = s.source ? ` [source: ${s.source}]` : '';
    return `${i + 1}. (${s.type}, ${s.severity}) ${s.summary} — ${s.evidence}${src}`;
  });
  return [
    `Area: ${input.area || 'the user\u2019s area'}`,
    `Computed risk level: ${input.riskLevel}`,
    'Signals:',
    facts.length ? facts.join('\n') : '(no notable signals)',
  ].join('\n');
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms) as unknown as number;
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function openRouterExplain(system: string, user: string): Promise<string | null> {
  const key = optionalEnv('OPENROUTER_API_KEY');
  if (!key) return null;
  const base = (optionalEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = optionalEnv('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct:free';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };
  const referer = optionalEnv('OPENROUTER_HTTP_REFERER');
  const title = optionalEnv('OPENROUTER_APP_TITLE') || 'MEDGUARD';
  if (referer) headers['HTTP-Referer'] = referer;
  if (title) headers['X-Title'] = title;

  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
  const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}

async function geminiExplain(system: string, user: string): Promise<string | null> {
  const key = optionalEnv('GOOGLE_GEMINI_KEY');
  if (!key) return null;
  const model = optionalEnv('GEMINI_MODEL') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
}

async function groqExplain(system: string, user: string): Promise<string | null> {
  const key = optionalEnv('GROQ_API_KEY');
  if (!key) return null;
  const model = optionalEnv('GROQ_MODEL') || 'openai/gpt-oss-20b';
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}`);
  const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}

/**
 * Returns a phrased summary string, or null if no provider is configured or
 * all providers fail. NEVER throws to the caller.
 */
export async function explainWithLlm(input: LlmExplainInput): Promise<string | null> {
  const user = buildFactPrompt(input);
  const ms = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const providers: Array<(s: string, u: string) => Promise<string | null>> = [
    openRouterExplain,
    geminiExplain,
    groqExplain,
  ];

  for (const provider of providers) {
    try {
      const out = await withTimeout(provider(SYSTEM_PROMPT, user), ms, 'brain_llm');
      if (out) return out;
      // null => provider not configured; try the next one.
    } catch {
      // provider error => try the next one.
      continue;
    }
  }
  return null;
}
