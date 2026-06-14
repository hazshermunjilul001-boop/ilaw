// app/api/ppt/route.ts
// Server-side only — generates student-facing PowerPoint from LP content.
// UPDATE: Now supports English and Filipino based on the Learning Area.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { buildPptxBuffer } from '../../../lib/buildPptx';
import { callAI } from '../../../lib/callAI';

const SYSTEM = `You are an expert DepEd Philippines classroom presentation designer.
Your job is to transform a teacher's ILAW Lesson Plan into student-facing PowerPoint slide content.

CRITICAL RULES:
- Write EVERYTHING from the student's perspective — what THEY see on the projector screen.
- NEVER include teacher instructions, scripts, or LP labels.
- Use simple, clear, student-friendly language. Short sentences. Direct.
- For objectives: rephrase as "By the end of today, you will be able to..." statements.
- For examples: show the COMPLETE step-by-step solution on the slide, not a description of it.
- For activities: write the exact student task/question they need to answer.
- Include actual numbers, equations, and Davao City contexts from the LP.
- Output ONLY the structured slide data in the exact JSON format requested. No extra text. No markdown fences.`;

// ── UPDATED FUNCTION: Added langRules parameter ─────────────────────
function buildSessionPrompt(
  content: string,
  sessionNum: number,
  sessionCount: number,
  langRules: string, // <--- NEW
): string {
  return `Here is a complete ILAW Lesson Plan. Transform Session ${sessionNum} of ${sessionCount} into student-facing PowerPoint slide content.

LANGUAGE RULE: ${langRules}

LESSON PLAN CONTENT:
 ${content.slice(0, 10000)}

Focus on Session ${sessionNum}. Output ONLY valid JSON for this single session object (no array wrapper, no lessonHook):
{
  "sessionNum": ${sessionNum},
  "sessionTitle": "Short student-friendly session title (max 8 words)",
  "objectives": [
    "By the end of today, you will be able to [action] (max 20 words)",
    "By the end of today, you will be able to [action] (max 20 words)"
  ],
  "warmUpTitle": "Name of the warm-up activity (max 6 words)",
  "warmUpTask": "The exact instruction students read on the slide (max 40 words)",
  "warmUpQuestion": "The specific question or problem students answer during warm-up (max 30 words)",
  "conceptTitle": "The main concept name (max 6 words)",
  "conceptDefinition": "Clear, simple definition students can understand (max 35 words)",
  "conceptKeyPoints": [
    "Key point 1 (max 15 words)",
    "Key point 2 (max 15 words)",
    "Key point 3 (max 15 words)"
  ],
  "example1": {
    "title": "Example 1 title using Davao City context",
    "problem": "The exact problem statement students see (max 25 words)",
    "steps": [
      "Step 1: [what to do] → [result]",
      "Step 2: [what to do] → [result]",
      "Step 3: [what to do] → [result]",
      "Step 4: [what to do] → [final answer]"
    ]
  },
  "example2": {
    "title": "Example 2 title using a different Davao City context",
    "problem": "The exact problem statement students see (max 25 words)",
    "steps": [
      "Step 1: [what to do] → [result]",
      "Step 2: [what to do] → [result]",
      "Step 3: [what to do] → [result]",
      "Step 4: [what to do] → [final answer]"
    ]
  },
  "tryItProblem": "Your Turn! — the exact problem students solve independently (max 30 words)",
  "tryItHint": "A helpful hint for students who are stuck (max 20 words)",
  "discussionQuestions": [
    "Discussion question 1 for the whole class (max 20 words)",
    "Discussion question 2 for the whole class (max 20 words)",
    "Discussion question 3 for the whole class (max 20 words)"
  ],
  "activity": {
    "title": "Student activity name (max 6 words)",
    "instruction": "Exact instruction students read (max 35 words)",
    "taskA": "Track A — For everyone: exact task (max 25 words)",
    "taskB": "Track B — Need more help? Try this: exact simpler task (max 25 words)",
    "taskC": "Track C — Challenge: exact harder task (max 25 words)"
  },
  "exitTicket": "The exact exit ticket question students answer on paper before leaving (max 25 words)",
  "realLifeTitle": "Real-life connection title (max 6 words)",
  "realLifeFact": "A specific, concrete real-world fact using actual Davao City data (max 35 words)",
  "realLifeQuestion": "A question connecting the lesson to that real-world fact (max 20 words)",
  "summaryPoints": [
    "What we learned: key takeaway 1 (max 15 words)",
    "What we learned: key takeaway 2 (max 15 words)",
    "What we learned: key takeaway 3 (max 15 words)"
  ]
}`;
}

// ── UPDATED FUNCTION: Added langRules parameter ─────────────────────
function buildHookPrompt(content: string, langRules: string): string { // <--- NEW
  return `Here is an ILAW Lesson Plan. Respond with ONLY a single JSON object, no markdown:
{"lessonHook": "One surprising fact or question to open the presentation (max 25 words)"}

LANGUAGE RULE: ${langRules}

LESSON PLAN CONTENT:
 ${content.slice(0, 3000)}`;
}

// ── ROBUST JSON PARSER ───────────────────────────────────────────────
function parseJson(raw: string, label: string): any | null {
  if (!raw) return null;

  // 1. Remove Markdown code blocks (```json ... ```)
  let clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  // 2. Try to fix common AI errors (Trailing commas)
  clean = clean.replace(/,\s*([\]}])/g, '$1');

  // 3. Attempt to find and parse JSON
  try {
    // Try parsing the whole string first
    return JSON.parse(clean);
  } catch (e) {
    // If that fails, try to find the first JSON Object { ... } or Array [ ... ]
    const objectMatch = clean.match(/\{[\s\S]*\}/);
    const arrayMatch = clean.match(/\[[\s\S]*\]/);

    let candidate = objectMatch ? objectMatch[0] : (arrayMatch ? arrayMatch[0] : null);

    if (candidate) {
      try {
        const parsed = JSON.parse(candidate);
        
        // VALIDATION: Ensure it has the keys we expect (Session structure)
        // The AI sometimes returns an Array of Slides instead of a Session Object.
        // We check for "sessionNum" to ensure we got the right format.
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
             if (parsed.sessionNum || parsed.lessonHook) {
               return parsed;
             }
        }

        console.warn(`[PPT] Parsed JSON but structure is wrong for ${label}. Expected Object, got structure. Raw: ${clean.slice(0, 200)}`);
        return null; 
      } catch (innerErr) {
        console.error(`[PPT] JSON parse failed for ${label}. Raw: ${clean.slice(0, 300)}`);
        return null;
      }
    }

    console.error(`[PPT] No JSON found in response for ${label}. Raw: ${clean.slice(0, 300)}`);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { 
      content, 
      teacherName, 
      lessonName, 
      learningArea, 
      gradeSection, 
      sessions, 
      apiKey, 
      apiKey2 
    } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'No lesson plan content provided' }, { status: 400 });
    }

    // ── NEW: Determine Language for PPT ────────────────────────────────
    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mother tongue|mtb|epp/i.test(learningArea || '');
    
    const langRules = isFilipino
      ? 'Write in FILIPINO/TAGALOG. Use simple, student-friendly Filipino words.'
      : 'Write in ENGLISH only. No Filipino words.';

    const sessionCount = parseInt(sessions) || 3;

    console.log(`[PPT] Starting parallel AI calls: 1 hook + ${sessionCount} sessions`);

    // ── Pass langRules to Hook call ─────────────────────────────────────
    const hookPromise = callAI(
        SYSTEM, 
        buildHookPrompt(content, langRules), // <--- PASS RULES
        apiKey, 
        'PPT-HOOK', 
        200, 
        apiKey2 
      )
      .then(raw => parseJson(raw, 'hook'))
      .catch(() => null);

    // ── Pass langRules to Session calls ───────────────────────────────────
    // ── FIXED CODE: Fires sequentially to prevent Rate Limits ────────────────
    const sessionResults: any[] = [];

    // We use a standard for...of loop instead of Promise.all
    for (let i = 0; i < sessionCount; i++) {
      console.log(`[PPT] Starting generation for Session ${i + 1}...`);
  
      try {
        const raw = await callAI(
          SYSTEM, 
          buildSessionPrompt(content, i + 1, sessionCount, langRules),
          apiKey, 
          `PPT-S${i + 1}`, 
          3000,
          apiKey2 
        );
    
        const parsed = parseJson(raw, `session${i + 1}`);
        if (parsed) {
          sessionResults.push(parsed);
          console.log(`[PPT] Session ${i + 1} generated successfully.`);
        } else {
          console.warn(`[PPT] Session ${i + 1} parsing failed, skipping.`);
        }
      } catch (err) {
        console.error(`[PPT] Session ${i + 1} failed completely.`, err);
      }

      // OPTIONAL: Wait 500ms between sessions to be extra safe
      // await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Handle the Hook Promise separately (it's just 1 request, so it's fine)
    const hookData = await hookPromise;

    console.log(`[PPT] All sessions generated. Total: ${sessionResults.length}`);

    // ── IMPROVED ERROR HANDLING ─────────────────────────────────────────
    // Filter out nulls (failed generations) instead of creating dummy objects
    const validSessions = sessionResults.filter(s => s !== null);

    if (validSessions.length === 0) {
      return NextResponse.json(
        { error: 'AI failed to generate slide content for any session. Please try again.' },
        { status: 500 },
      );
    }

    if (validSessions.length < sessionCount) {
      console.warn(`[PPT] Only generated ${validSessions.length} out of ${sessionCount} sessions.`);
    }

    const slideData = {
      lessonHook: hookData?.lessonHook ?? 'Welcome to today\'s lesson!',
      sessions: validSessions, // Only include successful sessions
    };

    console.log(`[PPT] Slide data ready. Sessions: ${slideData.sessions.length}`);

    const buffer = await buildPptxBuffer(
      slideData, teacherName, lessonName, learningArea, gradeSection, sessionCount,
    );

    const safeName = lessonName
      ? lessonName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
      : 'ILAW_Slides';

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeName}_Slides.pptx"`,
      },
    });

  } catch (error: any) {
    console.error('PPT ROUTE ERROR:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate PowerPoint. Please try again.' },
      { status: 500 },
    );
  }
}