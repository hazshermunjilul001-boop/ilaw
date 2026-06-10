// lib/callAI.ts
// Shared AI provider fallback chain used by all generate sub-routes and ppt route.

import Groq from 'groq-sdk';

export const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6,
  process.env.GROQ_API_KEY_7,
].filter((k): k is string => !!k);

export const GEMINI_KEYS = [
  process.env.GOOGLE_AI_KEY,
  process.env.GOOGLE_AI_KEY_2,
  process.env.GOOGLE_AI_KEY_3,
  process.env.GOOGLE_AI_KEY_4,
  process.env.GOOGLE_AI_KEY_5,
].filter((k): k is string => !!k);

console.log('[callAI] Module loaded. GEMINI_KEYS:', GEMINI_KEYS.length, 'GROQ_KEYS:', GROQ_KEYS.length);

function isSkippable(err: any): boolean {
  const msg: string = err?.message ?? '';
  const status = err?.status ?? err?.statusCode ?? 0;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('overloaded') ||
    msg.includes('currently unavailable') ||
    msg.includes('529')
  );
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  callLabel: string,
  maxTok = 8192,
): Promise<string> {
  let result: string | null = null;
  const failReasons: string[] = [];

  const hasGroq       = GROQ_KEYS.length > 0;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasCerebras   = !!process.env.CEREBRAS_API_KEY;
  const hasGemini     = GEMINI_KEYS.length > 0;

  async function tryProvider(
    label: string,
    url: string,
    authHeader: string,
    model: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<string | null> {
    try {
      console.log(`[${callLabel}] Trying ${label}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({
          model,
          max_tokens: maxTok,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const reason = `${label} → HTTP ${response.status}: ${errText.slice(0, 200)}`;
        console.warn(`[${callLabel}] ${reason}`);
        failReasons.push(reason);
        return null;
      }
      const data = await response.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';
      if (!text) {
        failReasons.push(`${label} → empty response`);
        return null;
      }
      console.log(`[${callLabel}] ${label} success! Chars: ${text.length}`);
      return text;
    } catch (err: any) {
      const reason = `${label} → exception: ${err?.message}`;
      console.error(`[${callLabel}] ${reason}`);
      failReasons.push(reason);
      return null;
    }
  }

  // ── PRIORITY 1: Google Gemini (paid key first) ────────────────────────────
  if (!result && hasGemini) {
    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash-lite'];
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    for (const apiKey of GEMINI_KEYS) {
      for (const model of geminiModels) {
        const text = await tryProvider(`Gemini/${model}`, endpoint, `Bearer ${apiKey}`, model);
        if (text) { result = text; break; }
      }
      if (result) break;
    }
  }

  // ── PRIORITY 2: Cerebras ──────────────────────────────────────────────────
  if (!result && hasCerebras) {
    for (const model of ['llama-3.3-70b', 'llama-3.1-8b']) {
      const text = await tryProvider(
        `Cerebras/${model}`,
        'https://api.cerebras.ai/v1/chat/completions',
        `Bearer ${process.env.CEREBRAS_API_KEY}`,
        model,
      );
      if (text) { result = text; break; }
    }
  }

  // ── PRIORITY 3: Groq key pool ─────────────────────────────────────────────
  if (!result && hasGroq) {
    const GROQ_MODELS = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];
    outerGroq:
    for (const apiKey of GROQ_KEYS) {
      const groqClient = new Groq({ apiKey });
      for (const model of GROQ_MODELS) {
        try {
          console.log(`[${callLabel}] Groq key ...${apiKey.slice(-4)} | model: ${model}`);
          const c = await groqClient.chat.completions.create({
            model, max_tokens: maxTok, temperature: 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: userPrompt },
            ],
          });
          const text = c.choices[0]?.message?.content ?? '';
          if (text) {
            console.log(`[${callLabel}] Groq success: ${model} | chars: ${text.length}`);
            result = text;
            break outerGroq;
          }
        } catch (err: any) {
          const reason = `Groq ...${apiKey.slice(-4)}/${model} → ${err?.message?.slice(0, 120)}`;
          console.warn(`[${callLabel}] ${reason}`);
          failReasons.push(reason);
          if (!isSkippable(err)) throw err;
        }
      }
    }
  }

  // ── PRIORITY 4: OpenRouter ────────────────────────────────────────────────
  if (!result && hasOpenRouter) {
    for (const model of [
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-nemo:free',
      'google/gemma-3-12b-it:free',
    ]) {
      const text = await tryProvider(
        `OpenRouter/${model}`,
        'https://openrouter.ai/api/v1/chat/completions',
        `Bearer ${process.env.OPENROUTER_API_KEY}`,
        model,
        { 'HTTP-Referer': 'https://ilawlpgenerator.vercel.app', 'X-Title': 'ILAW LP Generator' },
      );
      if (text) { result = text; break; }
    }
  }

  if (!result) {
    console.error(`[${callLabel}] ALL PROVIDERS FAILED:\n${failReasons.join('\n')}`);
    throw new Error('Lahat ng AI providers ay abala / All AI providers are currently busy. Please try again in 5–10 minutes.');
  }
  return result;
}