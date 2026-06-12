// lib/callAI.ts
import Groq from 'groq-sdk';

// Server-side fallback keys
export const SERVER_FALLBACK_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
].map(k => k?.trim()).filter((k): k is string => !!k);

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  userApiKey: string,
  callLabel: string,
  maxTok = 4096, // Reduced default to prevent timeouts
  userApiKey2?: string // <--- NEW: Optional Second Key
): Promise<string> {
  
  // ── STEP 1: BUILD KEY PRIORITY LIST ───────────────────────────────
  const keysToTry: string[] = [];
  
  if (userApiKey && userApiKey.trim() !== '') {
    keysToTry.push(userApiKey.trim());
  }
  
  // Add second user key if provided (Helps with rate limits)
  if (userApiKey2 && userApiKey2.trim() !== '') {
    keysToTry.push(userApiKey2.trim());
  }

  // Add server fallbacks last
  if (SERVER_FALLBACK_KEYS.length > 0) {
    keysToTry.push(...SERVER_FALLBACK_KEYS);
  }

  if (keysToTry.length === 0) {
    throw new Error('CRITICAL: No API Key provided.');
  }

  // ── STEP 2: SMART TRUNCATION ───────────────────────────────────────
  // 70b model can handle more context, 8b needs less.
  // We check the user prompt size to decide how much to cut.
  const MAX_USER_CHARS_LARGE = 6000; // For 70b
  const MAX_USER_CHARS_SMALL = 2500; // For 8b
  
  let safeSystemPrompt = systemPrompt.length > 1500 ? systemPrompt.slice(0, 1500) + "..." : systemPrompt;
  let safeUserPrompt = userPrompt;

  // Initial truncation to safe limits (Start high, will be cut per model)
  if (safeUserPrompt.length > MAX_USER_CHARS_LARGE) {
    console.warn(`[${callLabel}] Prompt very long (${safeUserPrompt.length}), pre-truncating.`);
    safeUserPrompt = safeUserPrompt.slice(0, MAX_USER_CHARS_LARGE) + "...";
  }

  // ── STEP 3: EXECUTE GENERATION ─────────────────────────────────────
  // We prioritize the smarter model (70b) first, but fallback to 8b if needed.
  const models = [
    { name: 'llama-3.3-70b-versatile', limit: MAX_USER_CHARS_LARGE },
    { name: 'llama-3.1-8b-instant', limit: MAX_USER_CHARS_SMALL }
  ];

  for (let i = 0; i < keysToTry.length; i++) {
    const apiKey = keysToTry[i];
    const isUserKey = (i < 2); // First 2 keys are user keys
    const keySource = isUserKey ? "User Key" : "Server Fallback";

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
          timeout: 55000, // <--- CRITICAL FIX: Prevents Vercel 504 Timeout
        });

        const completion = await groqClient.chat.completions.create({
          model: model.name,
          messages: [
            { role: 'system', content: safeSystemPrompt },
            { role: 'user', content: promptForModel },
          ],
          temperature: 0.6, // Slightly lower temp for more stable JSON
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

        // 1. Invalid Key (401): Discard and try next key
        if (status === 401) {
          console.warn(`[${callLabel}] Invalid Key (401). Trying next key.`);
          break; 
        }

        // 2. Rate Limit (429): Try next model (or key if models exhausted)
        if (status === 429) {
          console.warn(`[${callLabel}] Rate limit (429) on ${model.name}. Retrying...`);
          // Add a tiny delay to help the bucket refill
          await new Promise(r => setTimeout(r, 500)); 
          continue; 
        }
        
        // 3. Context Length (413): This model is too small for the text. Try next model.
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
    `Generation failed. Please check your API Key. ` +
    `If using your own key, it might be invalid or rate-limited.`
  );
}