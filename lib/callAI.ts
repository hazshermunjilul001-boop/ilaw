// lib/callAI.ts
// BYOK strategy. Order: Gemini -> Groq -> OpenRouter
import Groq from 'groq-sdk';

// Server-side fallback keys (Groq only, used if user provides no keys at all)
export const SERVER_FALLBACK_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
].map(k => k?.trim()).filter((k): k is string => !!k);

console.log('[callAI] Module loaded. SERVER_FALLBACK_KEYS:', SERVER_FALLBACK_KEYS.length);

// ── GEMINI CALL ──────────────────────────────────────────────────────────
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  callLabel: string,
  maxTok: number,
): Promise<string> {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: maxTok > 8000 ? 8000 : maxTok,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`Gemini error ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`[${callLabel}] Gemini returned no content.`);
  }
  console.log(`[${callLabel}] SUCCESS via Gemini (${model})`);
  return text;
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

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: maxTok > 8000 ? 8000 : maxTok,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`OpenRouter error ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`[${callLabel}] OpenRouter returned no content.`);
  }
  console.log(`[${callLabel}] SUCCESS via OpenRouter (${model})`);
  return text;
}

// ── MAIN ENTRY POINT ─────────────────────────────────────────────────────
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  userApiKey: string,          // Groq key 1 (kept for backward compatibility)
  callLabel: string,
  maxTok = 8192,
  userApiKey2?: string,        // Groq key 2
  geminiKey?: string,          // NEW — tried first
  openrouterKey?: string,      // NEW — tried last
): Promise<string> {

  const MAX_SYSTEM_CHARS = 1500;
  const MAX_USER_CHARS_LARGE = 6000;
  const MAX_USER_CHARS_SMALL = 2500;

  let safeSystemPrompt = systemPrompt;
  if (safeSystemPrompt.length > MAX_SYSTEM_CHARS) {
    safeSystemPrompt = safeSystemPrompt.slice(0, MAX_SYSTEM_CHARS) + "...";
  }

  let safeUserPrompt = userPrompt;
  if (safeUserPrompt.length > MAX_USER_CHARS_LARGE) {
    safeUserPrompt = safeUserPrompt.slice(0, MAX_USER_CHARS_LARGE) + "...";
  }

  // ── STEP 1: TRY GEMINI FIRST ────────────────────────────────────────────
  if (geminiKey && geminiKey.trim() !== '') {
    try {
      console.log(`[${callLabel}] Trying Gemini (primary)...`);
      return await callGemini(safeSystemPrompt, safeUserPrompt, geminiKey.trim(), callLabel, maxTok);
    } catch (err: any) {
      console.warn(`[${callLabel}] Gemini failed (${err?.status ?? 'unknown'}): ${err?.message}. Falling back to Groq...`);
      // fall through to Groq
    }
  }

  // ── STEP 2: BUILD GROQ KEY PRIORITY LIST ────────────────────────────────
  const keysToTry: string[] = [];
  if (userApiKey && userApiKey.trim() !== '') keysToTry.push(userApiKey.trim());
  if (userApiKey2 && userApiKey2.trim() !== '') keysToTry.push(userApiKey2.trim());
  if (SERVER_FALLBACK_KEYS.length > 0) keysToTry.push(...SERVER_FALLBACK_KEYS);

  const models = [
    { name: 'openai/gpt-oss-120b', limit: MAX_USER_CHARS_LARGE },
    { name: 'openai/gpt-oss-20b',  limit: MAX_USER_CHARS_SMALL  },
  ];

  for (let i = 0; i < keysToTry.length; i++) {
    const apiKey = keysToTry[i];
    const isUserKey = (i < 2);
    const keySource = isUserKey ? "User Key" : "Server Backup Key";

    for (const model of models) {
      try {
        let promptForModel = safeUserPrompt;
        if (promptForModel.length > model.limit) {
          promptForModel = promptForModel.slice(0, model.limit) + "...";
        }

        console.log(`[${callLabel}] Trying ${model.name} via ${keySource} (Groq)...`);

        const groqClient = new Groq({ apiKey, timeout: 55000 });

        const completion = await groqClient.chat.completions.create({
          model: model.name,
          messages: [
            { role: 'system', content: safeSystemPrompt },
            { role: 'user', content: promptForModel },
          ],
          temperature: 0.6,
          max_tokens: maxTok > 8000 ? 8000 : maxTok,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          console.log(`[${callLabel}] SUCCESS via ${model.name} (${keySource})`);
          return content;
        }
      } catch (err: any) {
        const status = err?.status;
        const message = err?.message ?? '';

        if (status === 401) {
          console.warn(`[${callLabel}] Invalid Key (401) for ${keySource}. Discarding key.`);
          break;
        }
        if (status === 429) {
          console.warn(`[${callLabel}] Rate limit (429) on ${model.name} via ${keySource}. Switching keys...`);
          break;
        }
        if (status === 413) {
          console.warn(`[${callLabel}] Context overflow (413) on ${model.name}. Trying next model...`);
          continue;
        }
        if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
          console.warn(`[${callLabel}] Request timed out. Trying next model/key...`);
          continue;
        }
        console.error(`[${callLabel}] Error with ${model.name}:`, message);
        continue;
      }
    }
  }

  // ── STEP 3: LAST RESORT — OPENROUTER ────────────────────────────────────
  if (openrouterKey && openrouterKey.trim() !== '') {
    try {
      console.log(`[${callLabel}] Trying OpenRouter (last resort)...`);
      return await callOpenRouter(safeSystemPrompt, safeUserPrompt, openrouterKey.trim(), callLabel, maxTok);
    } catch (err: any) {
      console.warn(`[${callLabel}] OpenRouter failed: ${err?.message}`);
    }
  }

  throw new Error(
    `Generation failed. Please check your API Key in settings. ` +
    `If using your own key, it may be invalid or rate-limited.`
  );
}