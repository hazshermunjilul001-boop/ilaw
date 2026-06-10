// lib/callAI.ts
// Optimized AI provider with Aggressive Truncation to prevent 413 errors.
import Groq from 'groq-sdk';

// Automatically trim spaces from keys
export const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6,
  process.env.GROQ_API_KEY_7,
].map(k => k?.trim()).filter((k): k is string => !!k);

// Gemini keys are temporarily disabled to prevent 404/429 errors shown in logs.
// export const GEMINI_KEYS = [ ... ];

console.log('[callAI] Module loaded. GROQ_KEYS:', GROQ_KEYS.length);

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  callLabel: string,
  maxTok = 8192,
): Promise<string> {
  // ── FIX 1: AGGRESSIVE TRUNCATION ────────────────────────────────────────
  // The 413 error happens because the combined prompt is too big for the 8b model.
  // We cut the System Prompt to 1500 chars and User Prompt to 2500 chars.
  const MAX_SYSTEM_CHARS = 1500;
  const MAX_USER_CHARS = 2500;

  let safeSystemPrompt = systemPrompt;
  if (safeSystemPrompt.length > MAX_SYSTEM_CHARS) {
    console.warn(`[${callLabel}] System Prompt too long (${safeSystemPrompt.length}), truncating to ${MAX_SYSTEM_CHARS}.`);
    safeSystemPrompt = safeSystemPrompt.slice(0, MAX_SYSTEM_CHARS) + "...";
  }

  let safeUserPrompt = userPrompt;
  if (safeUserPrompt.length > MAX_USER_CHARS) {
    console.warn(`[${callLabel}] User Prompt too long (${safeUserPrompt.length}), truncating to ${MAX_USER_CHARS}.`);
    safeUserPrompt = safeUserPrompt.slice(0, MAX_USER_CHARS) + "...";
  }

  if (GROQ_KEYS.length === 0) {
    throw new Error('CRITICAL: No Groq API Keys found. Please add GROQ_API_KEY to your environment variables.');
  }

  // ── FIX 2: SIMPLIFIED GROQ LOGIC ─────────────────────────────────────────
  // We only try Groq now. Gemini/Cerebras were causing 404/429 errors in your logs.
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const apiKey of GROQ_KEYS) {
    for (const model of models) {
      try {
        const groqClient = new Groq({ apiKey });
        console.log(`[${callLabel}] Attempting ${model} with key ending in ...${apiKey.slice(-4)}`);

        const completion = await groqClient.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: safeSystemPrompt },
            { role: 'user', content: safeUserPrompt },
          ],
          temperature: 0.7,
          max_tokens: maxTok > 8000 ? 8000 : maxTok, // Safety clamp
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          console.log(`[${callLabel}] SUCCESS via ${model}`);
          return content;
        }
      } catch (err: any) {
        const status = err?.status;
        const message = err?.message;

        // Handle specific errors
        if (status === 429) {
          console.warn(`[${callLabel}] Rate limit (429) hit for key ...${apiKey.slice(-4)}. Trying next key/model...`);
          // Don't throw, just try the next key
          continue; 
        }
        
        if (status === 413) {
           console.error(`[${callLabel}] Payload too large (413) even after truncation. This is unusual.`);
           // Try next model (maybe 70b handles it better) or throw
           continue;
        }

        console.error(`[${callLabel}] Error with ${model}:`, message);
      }
    }
  }

  // ── FINAL FALLBACK ────────────────────────────────────────────────────────
  throw new Error(
    `Generation failed. All Groq keys are likely rate-limited (429) or invalid. ` +
    `Please get a FREE personal key at https://console.groq.com and update your .env file.`
  );
}