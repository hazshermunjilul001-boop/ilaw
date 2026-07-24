// app/api/generate/header/route.ts
// PART A: REFERENCES, DECLARATION_AI, LEARNING_COMPETENCY, LEARNING_OBJECTIVES, LEARNER_CONTEXT
// Runs as its own serverless function — fits within Vercel Hobby 60s limit.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { callAI } from '../../../../lib/callAI';
import { isFilipinoPH } from '../../../../lib/language';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // ── CHANGE: Extract apiKey and apiKey2 from the request body ─────────
    const { 
      lessonName, 
      learningArea, 
      teacherName, 
      gradeSection, 
      competency, 
      sessions, 
      classroomDetails, 
      schoolCity, 
      apiKey,
      apiKey2,
      geminiKey,      // <--- ADDED
      openrouterKey,  // <--- ADDED // <--- ADDED
    } = body;

    const city = schoolCity?.trim() || 'their city';
    // FIX: was a locally duplicated regex missing "VE" (Values Education —
    // ESP's MATATAG-curriculum rename), which caused Filipino-medium
    // subjects like "VE 8" to silently generate in English. Now uses the
    // same shared detector as buildDocx.ts so this can't drift out of sync.
    const isFilipino = isFilipinoPH(learningArea);
    const noProjector = !classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv');

    // ── REPLACE THIS BLOCK ───────────────────────────────────────────────
    const lang = isFilipino
      ? 'FILIPINO/TAGALOG ONLY. Write entirely in Filipino. Do not use English words except for ALL CAPS section keys and unavoidable technical terms.'
      : 'STRICT ENGLISH ONLY. Do NOT translate to Tagalog or Bisaya. Write entirely in English. When using Davao City context, use English names (e.g., "Davao City Hall", not "Gobyerno ng Davao"). Do NOT use local dialect words.';
    // ────────────────────────────────────────────────────────────────────

    const aiNote = isFilipino
      ? '3-4 pangungusap sa FILIPINO tungkol sa paggamit ng AI, pagsusuri ng guro, at pagsunod sa DO 3 s.2026 Annex A.'
      : '3-4 sentences about AI assistance, teacher review, and DO 3 s.2026 Annex A compliance.';

    const L = isFilipino ? {
      strengths: 'Mga Kalakasan at Nakaraang Kaalaman',
      interests:  'Mga Interes at Pakikipag-ugnayan',
      barriers:   'Mga Hadlang sa Pagkatuto',
      support:    'Mga Angkop na Tulong at Suporta',
      session:    'SESYON',
    } : {
      strengths: 'Strengths and Prior Knowledge',
      interests:  'Interests and Engagement Hooks',
      barriers:   'Possible Barriers to Learning',
      support:    'Accommodations and Support',
      session:    'SESSION',
    };

    const lessonHeader = `LESSON: ${lessonName} | AREA: ${learningArea} | TEACHER: ${teacherName}
GRADE: ${gradeSection} | SESSIONS: ${sessions} | CITY: ${city}
COMPETENCY: ${competency}
CLASSROOM: ${classroomDetails}
 ${noProjector ? 'NOTE: NO projector or TV — use board, chalk, cartolina, flashcards only.' : ''}`;

    const systemPrompt = `You are an expert DepEd Philippines ILAW lesson plan writer. Always follow these rules:
• Write in ${lang}
• Use bullet points (•) only — absolutely no numbered lists anywhere.
• Every teacher instruction must be a word-for-word script.
• Every example must name a real, specific place, price, or event from ${city}.
• Label every Bloom's question: [KNOWLEDGE] [COMPREHENSION] [APPLICATION] [ANALYSIS] [EVALUATION].
• A substitute teacher with no subject knowledge must be able to run every session using only this document.
• CRITICAL: Write the section for EVERY session — never skip, merge, or abbreviate any session.
• CRITICAL FORMAT RULE: Every ALL-CAPS section key must appear on its OWN line, alone, with nothing else on that line.`;

    const prompt = `Write SECTION A of an ILAW lesson plan. Output ONLY these 5 sections in order, fully written, no placeholders.
Each section key must be on its OWN line alone. Do not append a colon to the main section key lines.

 ${lessonHeader}

REFERENCES
Write 4-6 real DepEd references — full author, year, title, publisher, ISBN where available, page numbers, MELC code.

DECLARATION_AI
 ${aiNote}

LEARNING_COMPETENCY
Full MELC text and code. Content Standard. Performance Standard.

LEARNING_OBJECTIVES
Write separately for EVERY session listed in SESSIONS above.
Format per session:
**${L.session} N — "Title" (duration):**
• [Clear, focused learning objective using an action verb. One per bullet.]
• [Second objective if needed]

LEARNER_CONTEXT
**${L.strengths}:** • 4 specific bullets on what this class already knows relevant to ${lessonName}
**${L.interests}:** • 4 bullets tied to real ${city} youth culture, landmarks, or events
**${L.barriers}:** • 5 specific learning barriers this topic typically causes
**${L.support}:** • 5 concrete strategies, one matched to each barrier above`;

    // ── CHANGE: Pass apiKey, apiKey2, and maxTokens to callAI ──────────────
    // 3000 tokens is sufficient for headers, references, and objectives.
    const content = await callAI(systemPrompt, prompt, apiKey, 'A-HEADER', 3000, apiKey2, geminiKey, openrouterKey);
    
    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('HEADER ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}