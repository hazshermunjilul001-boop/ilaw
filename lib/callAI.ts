// lib/callAI.ts
// Strategy: Gemini (primary, multi-model, multi-key) -> Groq (thin backup) -> OpenRouter (last resort)
import Groq from 'groq-sdk';

// ── SERVER FALLBACK KEYS ─────────────────────────────────────────────────
export const GEMINI_SERVER_FALLBACK_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].map(k => k?.trim()).filter((k): k is string => !!k);

export const GROQ_SERVER_FALLBACK_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
].map(k => k?.trim()).filter((k): k is string => !!k);

console.log(
  '[callAI] Module loaded. Gemini fallback keys:', GEMINI_SERVER_FALLBACK_KEYS.length,
  '| Groq fallback keys:', GROQ_SERVER_FALLBACK_KEYS.length,
);

const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

// ── TIMEOUT / BUDGET CONFIG ──────────────────────────────────────────────
// OVERALL_BUDGET_MS is now STRICTLY enforced: every individual network
// attempt is capped at whatever time remains, never at ATTEMPT_TIMEOUT_MS
// alone. This guarantees one callAI() call can never run longer than
// OVERALL_BUDGET_MS, which is what lets a caller safely run two callAI()
// calls in parallel (or sequentially) and stay under Vercel's 60s cap.
const ATTEMPT_TIMEOUT_MS = 9000;
const OVERALL_BUDGET_MS = 25000;   // ← tightened from 48000

type QuotaType = 'day' | 'minute' | 'other';

function classifyGemini429(errText: string): QuotaType {
  const t = errText.toLowerCase();
  if (t.includes('perday') || t.includes('per_day') || t.includes('daily')) return 'day';
  if (t.includes('perminute') || t.includes('per_minute') || t.includes('rpm') || t.includes('tpm')) return 'minute';
  return 'other';
}

// ── GEMINI CALL (single attempt, single model, budget-aware) ─────────────
async function callGeminiOnce(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  callLabel: string,
  maxTok: number,
  model: string,
  timeLeft: () => number,
): Promise<string> {
  const remaining = timeLeft();
  if (remaining <= 500) {
    throw new Error(`[${callLabel}] Skipping Gemini (${model}) — out of time budget.`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const attemptTimeout = Math.min(ATTEMPT_TIMEOUT_MS, remaining);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), attemptTimeout);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: maxTok > 8000 ? 8000 : maxTok },
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`[${callLabel}] Gemini (${model}) timed out after ${attemptTimeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`Gemini (${model}) error ${res.status}: ${errText}`);
    err.status = res.status;
    if (res.status === 429) err.quotaType = classifyGemini429(errText);
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`[${callLabel}] Gemini (${model}) returned no content.`);
  console.log(`[${callLabel}] SUCCESS via Gemini (${model})`);
  return text;
}

// Tries one Gemini KEY across both models. No sleep-and-retry anymore — on
// ANY failure (RPM, day quota, invalid key, timeout) it moves straight to
// the next model/key. Two models × N keys already gives real redundancy
// without doubling latency per attempt, which is what was blowing the
// time budget before.
async function callGeminiWithKey(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  keyLabel: string,
  callLabel: string,
  maxTok: number,
  timeLeft: () => number,
): Promise<string> {
  let lastErr: any = null;

  for (const model of GEMINI_MODELS) {
    if (timeLeft() <= 500) break;
    try {
      return await callGeminiOnce(systemPrompt, userPrompt, apiKey, callLabel, maxTok, model, timeLeft);
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 401) throw err; // invalid key — don't waste the other model
      console.warn(`[${callLabel}] ${keyLabel} (${model}) failed (${err?.status ?? 'timeout/other'}). Trying next model...`);
      continue;
    }
  }

  throw lastErr ?? new Error(`[${callLabel}] All Gemini models failed for ${keyLabel}.`);
}

// ── OPENROUTER CALL ──────────────────────────────────────────────────────
async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  callLabel: string,
  maxTok: number,
  timeLeft: () => number,
): Promise<string> {
  const remaining = timeLeft();
  if (remaining <= 500) throw new Error(`[${callLabel}] Skipping OpenRouter — out of time budget.`);

  const model = 'meta-llama/llama-3.3-70b-instruct:free';
  const attemptTimeout = Math.min(ATTEMPT_TIMEOUT_MS, remaining);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), attemptTimeout);

  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: maxTok > 8000 ? 8000 : maxTok,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`[${callLabel}] OpenRouter timed out after ${attemptTimeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`OpenRouter error ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`[${callLabel}] OpenRouter returned no content.`);
  console.log(`[${callLabel}] SUCCESS via OpenRouter (${model})`);
  return text;
}

// ── THIN GROQ FALLBACK ────────────────────────────────────────────────────
async function callGroqFallback(
  systemPrompt: string,
  userPrompt: string,
  keysToTry: string[],
  callLabel: string,
  maxTok: number,
  timeLeft: () => number,
): Promise<string> {
  const model = 'openai/gpt-oss-120b';

  for (let i = 0; i < keysToTry.length; i++) {
    if (timeLeft() <= 500) break;
    const apiKey = keysToTry[i];
    try {
      const groqClient = new Groq({ apiKey, timeout: Math.min(ATTEMPT_TIMEOUT_MS, Math.max(timeLeft(), 1000)) });
      const completion = await groqClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: maxTok > 8000 ? 8000 : maxTok,
      });
      const content = completion.choices[0]?.message?.content;
      if (content) {
        console.log(`[${callLabel}] SUCCESS via Groq fallback (${model})`);
        return content;
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) { console.warn(`[${callLabel}] Groq key invalid, discarding.`); continue; }
      if (status === 429) { console.warn(`[${callLabel}] Groq rate-limited, next key...`); continue; }
      console.warn(`[${callLabel}] Groq fallback error:`, err?.message);
      continue;
    }
  }
  throw new Error(`[${callLabel}] Groq fallback exhausted.`);
}

// ── MAIN ENTRY POINT ─────────────────────────────────────────────────────
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  userApiKey: string,
  callLabel: string,
  maxTok = 8192,
  userApiKey2?: string,
  geminiKey?: string,
  openrouterKey?: string,
): Promise<string> {

  const startTime = Date.now();
  const timeLeft = () => OVERALL_BUDGET_MS - (Date.now() - startTime);

  const MAX_SYSTEM_CHARS = 1500;
  const MAX_USER_CHARS = 6000;

  let safeSystemPrompt = systemPrompt;
  if (safeSystemPrompt.length > MAX_SYSTEM_CHARS) {
    safeSystemPrompt = safeSystemPrompt.slice(0, MAX_SYSTEM_CHARS) + '...';
  }
  let safeUserPrompt = userPrompt;
  if (safeUserPrompt.length > MAX_USER_CHARS) {
    safeUserPrompt = safeUserPrompt.slice(0, MAX_USER_CHARS) + '...';
  }

  let lastFailure: 'gemini-day' | 'gemini-minute' | 'gemini-invalid' | 'gemini-other'
    | 'groq' | 'openrouter' | 'none-configured' | 'timeout' = 'none-configured';

  // ── STEP 1: GEMINI ────────────────────────────────────────────────────
  const geminiKeysToTry: { key: string; label: string }[] = [];
  if (geminiKey && geminiKey.trim() !== '') {
    geminiKeysToTry.push({ key: geminiKey.trim(), label: 'User Gemini Key' });
  }
  GEMINI_SERVER_FALLBACK_KEYS.forEach((k, i) =>
    geminiKeysToTry.push({ key: k, label: `Server Gemini Key ${i + 1}` })
  );

  for (const { key, label } of geminiKeysToTry) {
    if (timeLeft() <= 500) { lastFailure = 'timeout'; break; }
    try {
      console.log(`[${callLabel}] Trying Gemini via ${label}...`);
      return await callGeminiWithKey(safeSystemPrompt, safeUserPrompt, key, label, callLabel, maxTok, timeLeft);
    } catch (err: any) {
      if (err?.status === 429 && err?.quotaType === 'day') {
        console.warn(`[${callLabel}] ${label}: daily quota exhausted, trying next key...`);
        lastFailure = 'gemini-day';
      } else if (err?.status === 429) {
        console.warn(`[${callLabel}] ${label}: rate-limited, trying next key...`);
        lastFailure = 'gemini-minute';
      } else if (err?.status === 401) {
        console.warn(`[${callLabel}] ${label}: invalid key, discarding.`);
        lastFailure = 'gemini-invalid';
      } else {
        console.warn(`[${callLabel}] ${label} failed: ${err?.message}`);
        lastFailure = 'gemini-other';
      }
    }
  }

  // ── STEP 2: GROQ ──────────────────────────────────────────────────────
  const groqKeysToTry: string[] = [];
  if (userApiKey && userApiKey.trim() !== '') groqKeysToTry.push(userApiKey.trim());
  if (userApiKey2 && userApiKey2.trim() !== '') groqKeysToTry.push(userApiKey2.trim());
  groqKeysToTry.push(...GROQ_SERVER_FALLBACK_KEYS);

  if (groqKeysToTry.length > 0 && timeLeft() > 500) {
    try {
      return await callGroqFallback(safeSystemPrompt, safeUserPrompt, groqKeysToTry, callLabel, maxTok, timeLeft);
    } catch (err: any) {
      console.warn(`[${callLabel}] Groq fallback failed: ${err?.message}`);
      lastFailure = 'groq';
    }
  }

  // ── STEP 3: OPENROUTER ───────────────────────────────────────────────
  if (openrouterKey && openrouterKey.trim() !== '' && timeLeft() > 500) {
    try {
      console.log(`[${callLabel}] Trying OpenRouter (last resort)...`);
      return await callOpenRouter(safeSystemPrompt, safeUserPrompt, openrouterKey.trim(), callLabel, maxTok, timeLeft);
    } catch (err: any) {
      console.warn(`[${callLabel}] OpenRouter failed: ${err?.message}`);
      lastFailure = 'openrouter';
    }
  }

  const messages: Record<typeof lastFailure, string> = {
    'gemini-day': "Gemini's free daily quota is exhausted on every model and key tried. It resets at midnight Pacific Time — or add a Groq/OpenRouter key in Settings as a backup for the rest of today.",
    'gemini-minute': "Gemini's per-minute limit was hit repeatedly. Please wait about a minute and try again.",
    'gemini-invalid': 'Your Gemini API key was rejected as invalid. Please check it in Settings — get a fresh one at aistudio.google.com/apikey.',
    'gemini-other': 'Gemini failed for an unexpected reason. Please try again, or add a Groq/OpenRouter key in Settings as a backup.',
    'groq': 'Gemini and Groq both failed. Please try again in a bit, or add an OpenRouter key in Settings as a third backup.',
    'openrouter': 'Gemini, Groq, and OpenRouter all failed. Please try again shortly.',
    'none-configured': 'No API key was found. Please add at least a Gemini API key in Settings — get a free one at aistudio.google.com/apikey.',
    'timeout': 'Generation ran out of time before finishing. Please try again — shorter lessons or fewer sessions generate faster.',
  };

  throw new Error(`Generation failed. ${messages[lastFailure]}`);
}