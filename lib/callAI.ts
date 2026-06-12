// lib/callAI.ts
// Optimized for BYOK (Bring Your Own Key) strategy.
import Groq from 'groq-sdk';

// Server-side fallback keys.
export const SERVER_FALLBACK_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
].map(k => k?.trim()).filter((k): k is string => !!k);

console.log('[callAI] Module loaded. SERVER_FALLBACK_KEYS:', SERVER_FALLBACK_KEYS.length);

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  userApiKey: string,
  callLabel: string,
  maxTok = 8192,
  userApiKey2?: string,
): Promise<string> {
  
  // ── STEP 1: BUILD KEY PRIORITY LIST ───────────────────────────────────────
  const keysToTry: string[] = [];
  
  if (userApiKey && userApiKey.trim() !== '') {
    keysToTry.push(userApiKey.trim());
  }

  if (userApiKey2 && userApiKey2.trim() !== '') {
    keysToTry.push(userApiKey2.trim());
  }

  if (SERVER_FALLBACK_KEYS.length > 0) {
    keysToTry.push(...SERVER_FALLBACK_KEYS);
  }

  if (keysToTry.length === 0) {
    throw new Error('CRITICAL: No API Key provided by user and no Server keys found.');
  }

  // ── STEP 2: AGGRESSIVE TRUNCATION ────────────────────────────────────────
  const MAX_SYSTEM_CHARS = 1500;
  const MAX_USER_CHARS_LARGE = 6000; 
  const MAX_USER_CHARS_SMALL = 2500; 

  let safeSystemPrompt = systemPrompt;
  if (safeSystemPrompt.length > MAX_SYSTEM_CHARS) {
    console.warn(`[${callLabel}] System Prompt too long (${safeSystemPrompt.length}), truncating to ${MAX_SYSTEM_CHARS}.`);
    safeSystemPrompt = safeSystemPrompt.slice(0, MAX_SYSTEM_CHARS) + "...";
  }

  let safeUserPrompt = userPrompt;
  if (safeUserPrompt.length > MAX_USER_CHARS_LARGE) {
    console.warn(`[${callLabel}] User Prompt too long (${safeUserPrompt.length}), truncating to ${MAX_USER_CHARS_LARGE}.`);
    safeUserPrompt = safeUserPrompt.slice(0, MAX_USER_CHARS_LARGE) + "...";
  }

  // ── STEP 3: EXECUTE GENERATION ─────────────────────────────────────────────
  const models = [
    { name: 'llama-3.3-70b-versatile', limit: MAX_USER_CHARS_LARGE },
    { name: 'llama-3.1-8b-instant', limit: MAX_USER_CHARS_SMALL }
  ];

  for (let i = 0; i < keysToTry.length; i++) {
    const apiKey = keysToTry[i];
    const isUserKey = (i < 2); 
    const keySource = isUserKey ? "User Key" : "Server Backup Key";

    for (const model of models) {
      try {
        // Dynamic truncation based on the model being attempted
        let promptForModel = safeUserPrompt;
        if (promptForModel.length > model.limit) {
           console.log(`[${callLabel}] Truncating to ${model.limit} for ${model.name}`);
           promptForModel = promptForModel.slice(0, model.limit) + "...";
        }

        console.log(`[${callLabel}] Trying ${model.name} via ${keySource} ...`);

        const groqClient = new Groq({ 
          apiKey,
          timeout: 55000, 
        });

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
        const message = err?.message;

        // 1. Invalid Key (401): Discard and try next key.
        if (status === 401) {
          console.warn(`[${callLabel}] Invalid Key (401) for ${keySource}. Discarding key.`);
          break; 
        }

        // 2. Rate Limit (429): WAIT 3 SECONDS then retry.
        if (status === 429) {
          console.warn(`[${callLabel}] Rate limit (429) on ${model.name}. Waiting 3s then retrying...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // <--- INCREASED TO 3000ms
          continue; 
        }
        
        // 3. Context Length (413): Try next model.
        if (status === 413) {
           console.warn(`[${callLabel}] Context overflow (413) on ${model.name}. Trying next model...`);
           continue;
        }

        // 4. Timeout / Network Errors
        if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
          console.warn(`[${callLabel}] Request timed out. Trying next model/key...`);
          continue;
        }

        console.error(`[${callLabel}] Error with ${model.name}:`, message);
        continue;
      }
    }
  }

  throw new Error(
    `Generation failed. Please check your API Key in settings. ` +
    `If using your own key, it may be invalid or rate-limited.`
  );
}