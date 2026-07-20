// lib/callAI.ts
// Strategy: Gemini (primary, multi-model, multi-key) -> Groq (thin backup) -> OpenRouter (last resort)
import Groq from 'groq-sdk';

// ── SERVER FALLBACK KEYS ─────────────────────────────────────────────────
// Gemini quotas are per Google Cloud PROJECT, not per key. Only add keys here
// that live under genuinely separate projects — extra keys under the same
// project share one quota bucket and won't add real capacity.
export const GEMINI_SERVER_FALLBACK_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].map(k => k?.trim()).filter((k): k is string => !!k);

// Kept as a thin last-resort layer. Many Groq models have been decommissioned,
// so this is intentionally short (1 model, fewer keys tried) rather than the
// old 14-attempt sweep.
export const GROQ_SERVER_FALLBACK_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
].map(k => k?.trim()).filter((k): k is string => !!k);

console.log(
  '[callAI] Module loaded. Gemini fallback keys:', GEMINI_SERVER_FALLBACK_KEYS.length,
  '| Groq fallback keys:', GROQ_SERVER_FALLBACK_KEYS.length,
);

// ── GEMINI MODELS, TRIED IN ORDER PER KEY ────────────────────────────────
// Quotas are tracked separately per model. flash-lite currently carries a
// much higher free-tier RPM/RPD ceiling than flash, so trying it first
// absorbs the vast majority of first-time-user bursts before ever touching
// flash's tighter limit.
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

// ── TIMEOUT / BUDGET CONFIG ──────────────────────────────────────────────
const ATTEMPT_TIMEOUT_MS = 10000;   // per single attempt
const MINUTE_BACKOFF_MS = 1500;     // short wait before retrying an RPM/TPM 429 once
const OVERALL_BUDGET_MS = 48000;    // stop trying new fallbacks before Vercel's hard cap

type QuotaType = 'day' | 'minute' | 'other';

function classifyGemini429(errText: string): QuotaType {
  // Gemini's error body includes quota details like "...PerDay..." or
  // "...PerMinute.../PerMinutePerProject..." inside violations/quotaId.
  const t = errText.toLowerCase();
  if (t.includes('perday') || t.includes('per_day') || t.includes('daily')) return 'day';
  if (t.includes('perminute') || t.includes('per_minute') || t.includes('rpm') || t.includes('tpm')) return 'minute';
  return 'other';
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

// ── GEMINI CALL (single attempt, single model) ────────────────────────────
async function callGeminiOnce(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  callLabel: string,
  maxTok: number,
  model: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

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
      throw new Error(`[${callLabel}] Gemini (${model}) timed out after ${ATTEMPT_TIMEOUT_MS}ms`);
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

// Tries one Gemini KEY across both models (flash-lite, then flash).
// For each model: on an RPM/TPM 429, waits briefly and retries once on that
// same model; on an RPD 429 or invalid key, moves straight to the next model
// (separate quota bucket — worth a fresh shot) without wasting a retry.
async function callGeminiWithKey(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  keyLabel: string,
  callLabel: string,
  maxTok: number,
): Promise<string> {
  let lastErr: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiOnce(systemPrompt, userPrompt, apiKey, callLabel, maxTok, model);
    } catch (err: any) {
      lastErr = err;

      if (err?.status === 401) {
        // Invalid key — no point trying the other model with the same key.
        throw err;
      }

      if (err?.status === 429 && err?.quotaType === 'minute') {
        console.warn(`[${callLabel}] ${keyLabel} (${model}): RPM/TPM limit hit, backing off ${MINUTE_BACKOFF_MS}ms and retrying once...`);
        await sleep(MINUTE_BACKOFF_MS);
        try {
          return await callGeminiOnce(systemPrompt, userPrompt, apiKey, callLabel, maxTok, model);
        } catch (retryErr: any) {
          lastErr = retryErr;
          console.warn(`[${callLabel}] ${keyLabel} (${model}): retry also failed. Trying next model...`);
          continue;
        }
      }

      // Day-quota exhausted or other error on this model — try the next model.
      console.warn(`[${callLabel}] ${keyLabel} (${model}) failed (${err?.status ?? 'unknown'}). Trying next model...`);
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
): Promise<string> {
  const model = 'meta-llama/llama-3.3-70b-instruct:free';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

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
      throw new Error(`[${callLabel}] OpenRouter timed out after ${ATTEMPT_TIMEOUT_MS}ms`);
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

// ── THIN GROQ FALLBACK (1 model only — most others are decommissioned) ───
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
    if (timeLeft() <= 0) break;
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
  userApiKey: string,          // Groq key 1 (kept for backward compatibility)
  callLabel: string,
  maxTok = 8192,
  userApiKey2?: string,        // Groq key 2
  geminiKey?: string,          // primary path
  openrouterKey?: string,      // last resort
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

  // Tracks what actually went wrong, so the final error message (if we get
  // there) reflects reality instead of always blaming Gemini's daily quota.
  let lastFailure: 'gemini-day' | 'gemini-minute' | 'gemini-invalid' | 'gemini-other'
    | 'groq' | 'openrouter' | 'none-configured' = 'none-configured';

  // ── STEP 1: GEMINI, USER KEY FIRST, THEN SERVER FALLBACK KEYS ───────────
  const geminiKeysToTry: { key: string; label: string }[] = [];
  if (geminiKey && geminiKey.trim() !== '') {
    geminiKeysToTry.push({ key: geminiKey.trim(), label: 'User Gemini Key' });
  }
  GEMINI_SERVER_FALLBACK_KEYS.forEach((k, i) =>
    geminiKeysToTry.push({ key: k, label: `Server Gemini Key ${i + 1}` })
  );

  for (const { key, label } of geminiKeysToTry) {
    if (timeLeft() <= 0) break;
    try {
      console.log(`[${callLabel}] Trying Gemini via ${label}...`);
      return await callGeminiWithKey(safeSystemPrompt, safeUserPrompt, key, label, callLabel, maxTok);
    } catch (err: any) {
      if (err?.status === 429 && err?.quotaType === 'day') {
        console.warn(`[${callLabel}] ${label}: daily quota exhausted on all Gemini models, trying next key...`);
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
      // fall through to next Gemini key
    }
  }

  // ── STEP 2: THIN GROQ FALLBACK ───────────────────────────────────────────
  const groqKeysToTry: string[] = [];
  if (userApiKey && userApiKey.trim() !== '') groqKeysToTry.push(userApiKey.trim());
  if (userApiKey2 && userApiKey2.trim() !== '') groqKeysToTry.push(userApiKey2.trim());
  groqKeysToTry.push(...GROQ_SERVER_FALLBACK_KEYS);

  if (groqKeysToTry.length > 0 && timeLeft() > 0) {
    try {
      return await callGroqFallback(safeSystemPrompt, safeUserPrompt, groqKeysToTry, callLabel, maxTok, timeLeft);
    } catch (err: any) {
      console.warn(`[${callLabel}] Groq fallback failed: ${err?.message}`);
      lastFailure = 'groq';
    }
  }

  // ── STEP 3: LAST RESORT — OPENROUTER ────────────────────────────────────
  if (openrouterKey && openrouterKey.trim() !== '' && timeLeft() > 0) {
    try {
      console.log(`[${callLabel}] Trying OpenRouter (last resort)...`);
      return await callOpenRouter(safeSystemPrompt, safeUserPrompt, openrouterKey.trim(), callLabel, maxTok);
    } catch (err: any) {
      console.warn(`[${callLabel}] OpenRouter failed: ${err?.message}`);
      lastFailure = 'openrouter';
    }
  }

  // ── FINAL ERROR — reflects what actually happened ────────────────────────
  const messages: Record<typeof lastFailure, string> = {
    'gemini-day': "Gemini's free daily quota is exhausted on every model and key tried. It resets at midnight Pacific Time — or add a Groq/OpenRouter key in Settings as a backup for the rest of today.",
    'gemini-minute': "Gemini's per-minute limit was hit repeatedly and the automatic retries didn't clear it. Please wait about a minute and try again.",
    'gemini-invalid': 'Your Gemini API key was rejected as invalid. Please check it in Settings — get a fresh one at aistudio.google.com/apikey.',
    'gemini-other': 'Gemini failed for an unexpected reason. Please try again, or add a Groq/OpenRouter key in Settings as a backup.',
    'groq': 'Gemini and Groq both failed. Please try again in a bit, or add an OpenRouter key in Settings as a third backup.',
    'openrouter': 'Gemini, Groq, and OpenRouter all failed. Please try again shortly.',
    'none-configured': 'No API key was found. Please add at least a Gemini API key in Settings — get a free one at aistudio.google.com/apikey.',
  };

  throw new Error(`Generation failed. ${messages[lastFailure]}`);
}