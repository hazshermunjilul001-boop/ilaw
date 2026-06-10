// lib/callAI.ts
// Shared AI provider fallback chain used by all generate sub-routes and ppt route.
import Groq from 'groq-sdk';

// Automatically trim spaces from keys to prevent 401 Unauthorized errors
export const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6,
  process.env.GROQ_API_KEY_7,
].map(k => k?.trim()).filter((k): k is string => !!k);

export const GEMINI_KEYS = [
  process.env.GOOGLE_AI_KEY,
  process.env.GOOGLE_AI_KEY_2,
  process.env.GOOGLE_AI_KEY_3,
  process.env.GOOGLE_AI_KEY_4,
  process.env.GOOGLE_AI_KEY_5,
].map(k => k?.trim()).filter((k): k is string => !!k);

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

  const hasGroq = GROQ_KEYS.length > 0;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasCerebras = !!process.env.CEREBRAS_API_KEY;
  const hasGemini = GEMINI_KEYS.length > 0;

  if (!hasGemini && !hasGroq && !hasCerebras && !hasOpenRouter) {
    throw new Error('CRITICAL ERROR: No AI API Keys found. Please check Vercel Environment Variables.');
  }

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
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          ...extraHeaders
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTok,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const reason = `${label} failed (${response.status}): ${errText.slice(0, 150)}`;
        console.warn(`[${callLabel}] ${reason}`);
        failReasons.push(reason);
        return null;
      }

      const data = await response.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';

      if (!text) {
        failReasons.push(`${label} returned an empty response`);
        return null;
      }

      console.log(`[${callLabel}] ${label} success!`);
      return text;
    } catch (err: any) {
      const reason = `${label} exception: ${err?.message}`;
      console.error(`[${callLabel}] ${reason}`);
      failReasons.push(reason);
      return null;
    }
  }

  // ── PRIORITY 1: Groq key pool (Fastest) ───────────────────────────────────
  if (!result && hasGroq) {
    const GROQ_MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];
    outerGroq: for (const apiKey of GROQ_KEYS) {
      const groqClient = new Groq({ apiKey });
      for (const model of GROQ_MODELS) {
        try {
          console.log(`[${callLabel}] Trying Groq (${model}) with key ...${apiKey.slice(-4)}`);
          const c = await groqClient.chat.completions.create({
            model,
            // Groq has a hard max token limit, so we clamp it to 8000
            max_tokens: maxTok > 8000 ? 8000 : maxTok, 
            temperature: 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          });
          const text = c.choices[0]?.message?.content ?? '';
          if (text) {
            console.log(`[${callLabel}] Groq success!`);
            result = text;
            break outerGroq;
          }
        } catch (err: any) {
          const reason = `Groq ${model} failed: ${err?.message?.slice(0, 150)}`;
          console.warn(`[${callLabel}] ${reason}`);
          failReasons.push(reason);
          // If it's a critical error (like wrong API key), move on to next provider
          if (!isSkippable(err)) {
              break outerGroq;
          }
        }
      }
    }
  }

  // ── PRIORITY 2: Google Gemini (Stable & High Limits) ──────────────────────
  if (!result && hasGemini) {
    const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    for (const apiKey of GEMINI_KEYS) {
      for (const model of geminiModels) {
        const text = await tryProvider(`Gemini/${model}`, endpoint, `Bearer ${apiKey}`, model);
        if (text) {
          result = text;
          break;
        }
      }
      if (result) break;
    }
  }

  // ── PRIORITY 3: Cerebras ──────────────────────────────────────────────────
  if (!result && hasCerebras) {
    const cerebrasModels = ['llama3.3-70b', 'llama3.1-8b'];
    for (const model of cerebrasModels) {
      const text = await tryProvider(
        `Cerebras/${model}`,
        'https://api.cerebras.ai/v1/chat/completions',
        `Bearer ${process.env.CEREBRAS_API_KEY?.trim()}`,
        model,
      );
      if (text) {
        result = text;
        break;
      }
    }
  }

  // ── PRIORITY 4: OpenRouter (Free Tier Fallbacks) ──────────────────────────
  if (!result && hasOpenRouter) {
    for (const model of [
      'google/gemini-2.0-flash-lite-preview-02-05:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free',
    ]) {
      const text = await tryProvider(
        `OpenRouter/${model}`,
        'https://openrouter.ai/api/v1/chat/completions',
        `Bearer ${process.env.OPENROUTER_API_KEY?.trim()}`,
        model,
        {
          'HTTP-Referer': 'https://ilawlpgenerator.vercel.app',
          'X-Title': 'ILAW LP Generator'
        },
      );
      if (text) {
        result = text;
        break;
      }
    }
  }

  // ── ERROR HANDLING ────────────────────────────────────────────────────────
  if (!result) {
    const debugOutput = failReasons.map(r => r.replace(/\n/g, ' ')).join(' || ');
    console.error(`[${callLabel}] FATAL: ${debugOutput}`);
    throw new Error(`Generation failed! DEBUG INFO: ${debugOutput}`);
  }

  return result;
}