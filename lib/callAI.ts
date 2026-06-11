// lib/callAI.ts
import Groq from 'groq-sdk';

export const SERVER_FALLBACK_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6,
  process.env.GROQ_API_KEY_7,
].map(k => k?.trim()).filter((k): k is string => !!k);

console.log('[callAI] Module loaded. SERVER_FALLBACK_KEYS:', SERVER_FALLBACK_KEYS.length);

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  userApiKey: string,
  callLabel: string,
  maxTok = 8192,
): Promise<string> {
  // ── STEP 1: BUILD KEY PRIORITY LIST ───────────────────────────────────────
  const keysToTry: string[] = [];
  
  if (userApiKey && userApiKey.trim() !== '') {
    keysToTry.push(userApiKey.trim());
  }

  if (SERVER_FALLBACK_KEYS.length > 0) {
    keysToTry.push(...SERVER_FALLBACK_KEYS);
  }

  if (keysToTry.length === 0) {
    throw new Error('CRITICAL: No API Key provided by user and no Server keys found.');
  }

  // ── STEP 2: ULTRA-SAFE TRUNCATION (Initial) ─────────────────────────────
  // We start very small (800 chars) to ensure compatibility with the finicky 8b model.
  const MAX_SYSTEM_CHARS = 800; 
  const MAX_USER_CHARS = 800;   

  let safeSystemPrompt = systemPrompt;
  if (safeSystemPrompt.length > MAX_SYSTEM_CHARS) {
    safeSystemPrompt = safeSystemPrompt.slice(0, MAX_SYSTEM_CHARS) + "...";
  }

  let safeUserPrompt = userPrompt;
  if (safeUserPrompt.length > MAX_USER_CHARS) {
    safeUserPrompt = safeUserPrompt.slice(0, MAX_USER_CHARS) + "...";
  }

  // ── STEP 3: EXECUTE GENERATION ─────────────────────────────────────────────
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  let lastError: any = null;
  let lastErrorType: string = 'unknown';

  for (let i = 0; i < keysToTry.length; i++) {
    const apiKey = keysToTry[i];
    const isUserKey = (i === 0 && userApiKey);
    const keySource = isUserKey ? "User Key" : "Server Backup Key";

    for (const model of models) {
      let reductionLevel = 0; // 0 = Full (800 chars), 1 = 75%, 2 = 50%
      
      while (reductionLevel < 3) { // Max 3 attempts to shrink
        try {
          // Calculate prompt size based on reduction level
          let currentSystem = safeSystemPrompt;
          let currentUser = safeUserPrompt;

          if (reductionLevel === 1) {
            currentSystem = safeSystemPrompt.slice(0, Math.floor(safeSystemPrompt.length * 0.75));
            currentUser = safeUserPrompt.slice(0, Math.floor(safeUserPrompt.length * 0.75));
            console.log(`[${callLabel}] Trying ${model} via ${keySource} (Reduced to 75%)...`);
          } else if (reductionLevel === 2) {
            currentSystem = safeSystemPrompt.slice(0, Math.floor(safeSystemPrompt.length * 0.5));
            currentUser = safeUserPrompt.slice(0, Math.floor(safeUserPrompt.length * 0.5));
            console.log(`[${callLabel}] Trying ${model} via ${keySource} (Reduced to 50%)...`);
          }

          const groqClient = new Groq({ apiKey });

          const completion = await groqClient.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: currentSystem },
              { role: 'user', content: currentUser },
            ],
            temperature: 0.7,
            max_tokens: maxTok > 8000 ? 8000 : maxTok,
          });

          const content = completion.choices[0]?.message?.content;
          if (content) {
            console.log(`[${callLabel}] SUCCESS via ${model} (${keySource})`);
            return content;
          }
        } catch (err: any) {
          lastError = err;
          const status = err?.status;
          const message = err?.message;

          if (status === 401) {
            lastErrorType = 'invalid_key';
            console.warn(`[${callLabel}] Invalid Key (401) for ${keySource}. Discarding key.`);
            break; 
          }

          if (status === 429) {
            lastErrorType = 'rate_limit';
            console.warn(`[${callLabel}] Rate limited (429) on ${model}. Trying next key/model...`);
            break; // Rate limit is hard, stop trying this model
          }
          
          if (status === 413) {
             lastErrorType = 'too_large';
             console.error(`[${callLabel}] Payload too large (413) on ${model}.`);
             // Don't break immediately. Increase reduction level and retry.
             reductionLevel++;
             continue;
          }

          console.error(`[${callLabel}] Error with ${model}:`, message);
          break; // Generic error, move on
        }
      }
    }
  }

  // ── STEP 4: INTELLIGENT ERROR REPORTING ───────────────────────────────────
  if (lastErrorType === 'rate_limit') {
    throw new Error('AI server is busy. Please wait 1 minute and try again.');
  }

  if (lastErrorType === 'invalid_key') {
    throw new Error('Invalid API Key. Please check your settings.');
  }

  if (lastErrorType === 'too_large') {
    throw new Error('The lesson details are too long. Please shorten your Competency or Classroom Details.');
  }

  throw new Error(`Generation failed. Please try again.`);
}