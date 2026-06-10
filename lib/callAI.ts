// lib/callAI.ts
// Optimized for BYOK (Bring Your Own Key) strategy.
import Groq from 'groq-sdk';

// Server-side fallback keys.
// These are ONLY used if the user does not provide their own key.
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
  userApiKey: string, // <--- NEW: Accepts the key from the frontend
  callLabel: string,
  maxTok = 8192,
): Promise<string> {
  
  // ── STEP 1: BUILD KEY PRIORITY LIST ───────────────────────────────────────
  // Priority 1: The User's Personal Key (Provided via UI)
  // Priority 2: Server Keys (From .env file - Fallback only)
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

  // ── STEP 2: AGGRESSIVE TRUNCATION ────────────────────────────────────────
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

  // ── STEP 3: EXECUTE GENERATION ─────────────────────────────────────────────
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (let i = 0; i < keysToTry.length; i++) {
    const apiKey = keysToTry[i];
    const isUserKey = (i === 0 && userApiKey);
    const keySource = isUserKey ? "User Key" : "Server Backup Key";

    for (const model of models) {
      try {
        console.log(`[${callLabel}] Trying ${model} via ${keySource} ...${apiKey.slice(-4)}`);

        const groqClient = new Groq({ apiKey });

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
          console.log(`[${callLabel}] SUCCESS via ${model} (${keySource})`);
          return content;
        }
      } catch (err: any) {
        const status = err?.status;
        const message = err?.message;

        // STRATEGY: Handle errors based on type
        
        // 1. Invalid Key (401): Don't retry other models with this bad key. Move to next key.
        if (status === 401) {
          console.warn(`[${callLabel}] Invalid Key (401) for ${keySource}. Discarding key.`);
          break; // Break the model loop, proceed to next key in list
        }

        // 2. Rate Limit (429): Try the next model (e.g., 8b might be available when 70b is not).
        if (status === 429) {
          console.warn(`[${callLabel}] Rate limit (429) on ${model}. Trying next model...`);
          continue; 
        }
        
        // 3. Payload Too Large (413): Try next model (70b handles context better than 8b).
        if (status === 413) {
           console.warn(`[${callLabel}] Payload too large (413) for ${model}. Trying next model...`);
           continue;
        }

        // 4. Other Errors: Log and try next model
        console.error(`[${callLabel}] Error with ${model}:`, message);
        continue;
      }
    }
  }

  // ── FINAL FALLBACK ────────────────────────────────────────────────────────
  throw new Error(
    `Generation failed. Please check your API Key in settings. ` +
    `If you are using your own key, it may be invalid or rate-limited.`
  );
}