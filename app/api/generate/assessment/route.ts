// app/api/generate/assessment/route.ts
// PART D: FORMATIVE_ASSESSMENT + EXTENDED_LEARNING
// Single call — fits well within Vercel Hobby 60s limit.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { callAI } from '../../../../lib/callAI';

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
      openrouterKey, // <--- ADDED
    } = body;

    const city = schoolCity?.trim() || 'their city';
    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mother tongue|mtb|epp/i.test(learningArea);
    const noProjector = !classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv');

    // ── REPLACE THIS BLOCK ───────────────────────────────────────────────
    const lang = isFilipino
      ? 'FILIPINO/TAGALOG ONLY. Write entirely in Filipino. Do not use English words except for ALL CAPS section keys and unavoidable technical terms.'
      : 'STRICT ENGLISH ONLY. Do NOT translate to Tagalog or Bisaya. Write entirely in English. When using Davao City context, use English names (e.g., "Davao City Hall", not "Gobyerno ng Davao"). Do NOT use local dialect words.';
    // ────────────────────────────────────────────────────────────────────

    const aiNote = isFilipino
    const L = isFilipino ? {
      session:    'SESYON',
      descLabel:  'Paglalarawan',
      sampleTasks:'Halimbawa ng mga tanong o gawain',
      admin:      'Paraan ng pagbibigay',
      howUsed:    'Paano gagamitin ang mga resulta',
      rubric:     'Rubrika o gabay sa pagmamarka',
      accom:      "Mga angkop na tulong para sa iba't ibang mag-aaral",
      extTitle:   'Mga Aktibidad sa Pagpapalawak',
      homework:   'Takdang-Aralin',
      enrichment: 'Pagpapayaman',
      remediation:'Remedyasyon',
      family:     'Pakikipag-ugnayan sa Pamilya',
    } : {
      session:    'SESSION',
      descLabel:  'Description',
      sampleTasks:'Sample tasks or questions',
      admin:      'Administration',
      howUsed:    'How results are used',
      rubric:     'Rubric or scoring guide',
      accom:      'Accommodation for diverse learners',
      extTitle:   'Extended Learning Activities',
      homework:   'Homework / Take-home task',
      enrichment: 'Enrichment',
      remediation:'Remediation',
      family:     'Family Engagement',
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
• CRITICAL: Write the section for EVERY session — never skip, merge, or abbreviate any session.
• CRITICAL FORMAT RULE: Every ALL-CAPS section key must appear on its OWN line, alone, with nothing else on that line.`;

    const prompt = `Write SECTION D of an ILAW lesson plan. Output ONLY these 2 sections in order, fully written. Never skip any session.
Each section key must be on its OWN line alone.

 ${lessonHeader}

FORMATIVE_ASSESSMENT
Write a complete entry for EVERY session listed in SESSIONS above:

**${L.session} N — "Assessment Tool Name"**
**${L.descLabel}:** What specific skill this measures and why this format fits the session objective.
**${L.sampleTasks}:**
• [BLOOM'S LEVEL] Full task 1 — must use a ${city} real-world context with actual numbers
• [BLOOM'S LEVEL] Full task 2
• [BLOOM'S LEVEL] Full task 3
**${L.admin}:** Exact procedure: how distributed, time allowed, individual or pairs, how submitted or checked.
**${L.howUsed}:** Scores 1-2: [exact teacher remedial action]. Scores 3-4: [exact enrichment action].
**${L.rubric}:**
• 4 — [Full mastery: specific, measurable, observable accuracy]
• 3 — [Proficiency: what they can do with minor errors]
• 2 — [Developing: partial concept understanding with structural support]
• 1 — [Beginning: fundamentally flawed response]
**${L.accom}:**
• For reading difficulty: [specific visual scaffolding strategy]
• For absent students: [specific makeup path or modular task]

EXTENDED_LEARNING
Write a complete entry for EVERY session listed in SESSIONS above:

**${L.session} N**
**${L.homework}:** One meaningful take-home task directly connected to today's session. Include specific ${city} context.
**${L.enrichment}:** One higher-order challenge for students who mastered the session objectives.
**${L.remediation}:** One targeted re-teaching activity for students who did not meet the session objectives.
**${L.family}:** One concrete suggestion for how families can support learning at home related to this topic.`;

    // ── CHANGE: Pass apiKey, apiKey2, and maxTokens to callAI ──────────────
    // 5000 tokens set to accommodate detailed rubrics for multiple sessions.
    const content = await callAI(systemPrompt, prompt, apiKey, 'D-ASSESSMENT', 5000, apiKey2, geminiKey, openrouterKey);
    
    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('ASSESSMENT ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}