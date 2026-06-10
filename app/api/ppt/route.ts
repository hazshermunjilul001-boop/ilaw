// app/api/ppt/route.ts
// Server-side only — generates student-facing PowerPoint from LP content.

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

export async function POST(req: Request) {
  try {
    const { content, teacherName, lessonName, learningArea, gradeSection, sessions } =
      await req.json();

    if (!content) {
      return NextResponse.json({ error: 'No lesson plan content provided' }, { status: 400 });
    }

    const sessionCount = parseInt(sessions) || 3;

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
    }
  ]
}

Generate exactly ${sessionCount} session(s) in the sessions array.`;

    console.log(`[PPT] Calling AI to transform LP into student-facing slide content...`);
    const aiResponse = await callAI(SYSTEM, userPrompt, 'PPT-TRANSFORM', 6000);

    let slideData: any;
    try {
      const clean = aiResponse
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*[\r\n]/gm, '')
        .trim();
      // Extract just the JSON object if there's text before/after
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      slideData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[PPT] JSON parse failed. Raw response:', aiResponse.slice(0, 500));
      return NextResponse.json(
        { error: 'AI returned invalid slide data. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[PPT] Slide data parsed. Sessions: ${slideData.sessions?.length}`);

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