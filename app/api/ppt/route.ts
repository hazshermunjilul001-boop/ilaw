// app/api/ppt/route.ts
// Server-side only — generates student-facing PowerPoint from LP content.
// Makes ONE AI call to transform teacher-facing LP content into student-facing
// slide content, then passes that to buildPptx.ts for rendering.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { buildPptxBuffer } from '../../../lib/buildPptx';

// ── AI providers (same pattern as generate/route.ts) ─────────────────────────
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter((k): k is string => !!k);

const hasGroq       = GROQ_KEYS.length > 0;
const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
const hasMistral    = !!process.env.MISTRAL_API_KEY;
const hasCerebras   = !!process.env.CEREBRAS_API_KEY;

async function callAI(systemPrompt: string, userPrompt: string, label: string): Promise<string> {
  let result: string | null = null;

  // ── Helper: call any OpenAI-compatible REST endpoint ──────────────────────
  async function tryProvider(
    providerLabel: string,
    url: string,
    authHeader: string,
    model: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<string | null> {
    try {
      console.log(`[${label}] Trying ${providerLabel} (${model})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[${label}] ${providerLabel} ${response.status}: ${errText.slice(0, 200)}`);
        return null;
      }
      const data = await response.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';
      if (!text) { console.warn(`[${label}] ${providerLabel} empty content`); return null; }
      console.log(`[${label}] ${providerLabel} success! Chars: ${text.length}`);
      return text;
    } catch (err: any) {
      console.error(`[${label}] ${providerLabel} exception: ${err?.message}`);
      return null;
    }
  }

  // ── Groq ──────────────────────────────────────────────────────────────────
  if (!result && hasGroq) {
    const MODELS = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
    ];
    outer:
    for (const key of GROQ_KEYS) {
      for (const model of MODELS) {
        const text = await tryProvider(`Groq/${model}`,
          'https://api.groq.com/openai/v1/chat/completions',
          `Bearer ${key}`, model);
        if (text) { result = text; break outer; }
      }
    }
  }

  // ── OpenRouter ────────────────────────────────────────────────────────────
  if (!result && hasOpenRouter) {
    for (const model of ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct']) {
      const text = await tryProvider(`OpenRouter/${model}`,
        'https://openrouter.ai/api/v1/chat/completions',
        `Bearer ${process.env.OPENROUTER_API_KEY}`, model,
        { 'HTTP-Referer': 'https://ilaw.vercel.app', 'X-Title': 'ILAW PPT Generator' });
      if (text) { result = text; break; }
    }
  }

  // ── Mistral ───────────────────────────────────────────────────────────────
  if (!result && hasMistral) {
    for (const model of ['mistral-large-latest', 'mistral-small-latest']) {
      const text = await tryProvider(`Mistral/${model}`,
        'https://api.mistral.ai/v1/chat/completions',
        `Bearer ${process.env.MISTRAL_API_KEY}`, model);
      if (text) { result = text; break; }
    }
  }

  // ── Cerebras ──────────────────────────────────────────────────────────────
  if (!result && hasCerebras) {
    for (const model of ['llama-3.3-70b', 'llama3.3-70b']) {
      const text = await tryProvider(`Cerebras/${model}`,
        'https://api.cerebras.ai/v1/chat/completions',
        `Bearer ${process.env.CEREBRAS_API_KEY}`, model);
      if (text) { result = text; break; }
    }
  }

  if (!result) throw new Error('All AI providers unavailable. Please try again in a few minutes.');
  return result;
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
const SYSTEM = `You are an expert DepEd Philippines classroom presentation designer.
Your job is to transform a teacher's ILAW Lesson Plan into student-facing PowerPoint slide content.

CRITICAL RULES:
- Write EVERYTHING from the student's perspective — what THEY see on the projector screen.
- NEVER include teacher instructions, scripts, or LP labels (no "Teacher instructions:", no "For All Learners:", no "Procedure:", no "Session Divider", no "A", "B", "C" badge labels).
- Use simple, clear, student-friendly language. Short sentences. Direct.
- For objectives: rephrase as "By the end of today, you will be able to..." statements.
- For examples: show the COMPLETE step-by-step solution on the slide, not a description of it.
- For activities: write the exact student task/question they need to answer.
- For assessments: write the actual question or problem students will solve.
- For the hook/opener: write an engaging question or surprising fact that grabs attention.
- Include actual numbers, equations, and Davao City contexts from the LP.
- Output ONLY the structured slide data in the exact JSON format requested. No extra text. No markdown fences.`;

export async function POST(req: Request) {
  try {
    const { content, teacherName, lessonName, learningArea, gradeSection, sessions } =
      await req.json();

    if (!content) {
      return NextResponse.json({ error: 'No lesson plan content provided' }, { status: 400 });
    }

    const sessionCount = parseInt(sessions) || 3;

    // ── Build the transformation prompt ──────────────────────────────────────
    // We ask the AI to produce structured JSON for each session's slides.
    // This gives buildPptx.ts clean, typed data to render — no parsing needed.
    const userPrompt = `Here is a complete ILAW Lesson Plan. Transform it into student-facing PowerPoint slide content for ${sessionCount} session(s).

LESSON PLAN CONTENT:
${content.slice(0, 12000)}

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no explanation:
{
  "lessonHook": "One surprising fact or question to open the presentation (max 25 words)",
  "sessions": [
    {
      "sessionNum": 1,
      "sessionTitle": "Short student-friendly session title (max 8 words)",
      "objectives": [
        "By the end of today, you will be able to [action] (max 20 words)",
        "By the end of today, you will be able to [action] (max 20 words)"
      ],
      "warmUpTitle": "Name of the warm-up activity (max 6 words)",
      "warmUpTask": "The exact instruction students read on the slide. What do they DO? (max 40 words)",
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
    }
  ]
}

Generate exactly ${sessionCount} session(s) in the sessions array. Use actual numbers, equations, and Davao City contexts from the lesson plan.`;

    console.log(`[PPT] Calling AI to transform LP into student-facing slide content...`);
    const aiResponse = await callAI(SYSTEM, userPrompt, 'PPT-TRANSFORM');

    // ── Parse AI JSON response ────────────────────────────────────────────────
    let slideData: any;
    try {
      // Strip any accidental markdown fences
      const clean = aiResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      slideData = JSON.parse(clean);
    } catch (parseErr) {
      console.error('[PPT] JSON parse failed. Raw response:', aiResponse.slice(0, 500));
      return NextResponse.json(
        { error: 'AI returned invalid slide data. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[PPT] Slide data parsed. Sessions: ${slideData.sessions?.length}`);

    // ── Build the PPTX ────────────────────────────────────────────────────────
    const buffer = await buildPptxBuffer(
      slideData, teacherName, lessonName, learningArea, gradeSection, sessionCount
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
      { status: 500 }
    );
  }
}