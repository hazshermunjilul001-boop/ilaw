// app/api/generate/prelesson/route.ts
// PART B: PRE_LESSON only

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { callAI } from '../../../../lib/callAI';
import { isFilipinoPH } from '../../../../lib/language';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      lessonName, learningArea, teacherName, gradeSection, 
      competency, sessions, classroomDetails, schoolCity,
      apiKey, apiKey2, geminiKey, openrouterKey,
    } = body;

    const city = schoolCity?.trim() || 'their city';
    const isFilipino = isFilipinoPH(learningArea);
    const noProjector = !classroomDetails?.toLowerCase().includes('projector') 
                     && !classroomDetails?.toLowerCase().includes('tv');

    const lang = isFilipino
      ? 'FILIPINO/TAGALOG ONLY. Write entirely in Filipino. Do not use English words except for ALL CAPS section keys and unavoidable technical terms.'
      : 'STRICT ENGLISH ONLY. Do NOT translate to Tagalog or Bisaya. Write entirely in English.';

    const L = isFilipino ? {
      session: 'SESYON', materials: 'Mga Kagamitan', procedure: 'Mga Hakbang',
      purpose: 'Layunin ng Aktibidad', warmup: 'Halimbawa ng tanong para sa warm-up',
    } : {
      session: 'SESSION', materials: 'Materials', procedure: 'Procedure',
      purpose: 'Purpose', warmup: 'Sample warm-up question',
    };

    const lessonHeader = `LESSON: ${lessonName} | AREA: ${learningArea} | TEACHER: ${teacherName}
GRADE: ${gradeSection} | SESSIONS: ${sessions} | CITY: ${city}
COMPETENCY: ${competency}
CLASSROOM: ${classroomDetails}
 ${noProjector ? 'NOTE: NO projector or TV — use board, chalk, cartolina, flashcards only.' : ''}`;

    const systemPrompt = `You are an expert DepEd Philippines ILAW lesson plan writer.
• Write in ${lang}
• Use bullet points (•) only — no numbered lists.
• Every teacher instruction must be a word-for-word script.
• Every example must name a real place, price, or event from ${city}.
• PRE_LESSON must be on its OWN line alone.`;

    const prompt = `Write PRE_LESSON for an ILAW lesson plan. Write for EVERY session.

 ${lessonHeader}

PRE_LESSON
For EACH session use this structure:

**${L.session} N — "Warm-Up Title" (time)**
**${L.materials}:** • list items
**${L.procedure}:**
• [Teacher line 1] → Expected response
• [Teacher line 2] → Expected response
• [Teacher line 3] → Expected response
**${L.purpose}:** One sentence.
**${L.warmup}:** Full question using ${city} context + expected answer.`;

    const result = await callAI(systemPrompt, prompt, apiKey, 'B-PRELESSON', 3000, apiKey2, geminiKey, openrouterKey);
    
    return NextResponse.json({ content: result });
  } catch (error: any) {
    console.error('PRELESSON ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}