// app/api/generate/flow/route.ts
// PART C: FLOW section only (no resources/integration)

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { callAI } from '../../../../lib/callAI';
import { outputLanguageRules, resolveOutputLanguage } from '../../../../lib/language';

function ensureFlowTag(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const hasFlowTag = lines.some((l) => {
    const clean = l.replace(/^#{1,4}\s*/, '').replace(/\*{1,2}/g, '').replace(/:+$/, '').trim().toUpperCase();
    return clean === 'FLOW';
  });
  return hasFlowTag ? text : `FLOW\n${text}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      lessonName, learningArea, teacherName, gradeSection, 
      competency, sessions, classroomDetails, schoolCity,
      apiKey, apiKey2, geminiKey, openrouterKey,
    } = body;

    const city = schoolCity?.trim() || 'their city';
    const outputLanguage = resolveOutputLanguage(learningArea, body.outputLanguage, [lessonName, competency, classroomDetails]);
    const isFilipino = outputLanguage === 'filipino';
    const noProjector = !classroomDetails?.toLowerCase().includes('projector') 
                     && !classroomDetails?.toLowerCase().includes('tv');

    const lang = outputLanguageRules(outputLanguage);

    const L = isFilipino ? {
      session: 'SESYON', teacherScript: 'Mga tagubilin para sa guro',
      studentActions: 'Mga Gawain ng Mag-aaral', examples: 'Mga Halimbawa',
      diffLabel: 'Ibinabagay na mga Panuto', forAll: 'Para sa Lahat ng Mag-aaral',
      forSupport: 'Para sa mga Mag-aaral na Nangangailangan ng Tulong', forAdvanced: 'Para sa mga Mag-aaral na Handa sa Hamon',
      guiding: 'Mga Gabay na Tanong', synthesis: 'Buod at Repleksyon',
      closing: 'Pangwakas na Talakayan', exit: 'Pangwakas na Gawain', realLife: 'Koneksyon sa Tunay na Buhay',
    } : {
      session: 'SESSION', teacherScript: 'Teacher Script',
      studentActions: 'Student Actions', examples: 'Examples',
      diffLabel: 'Differentiated Instructions', forAll: 'For All Learners',
      forSupport: 'For Learners Who Need Support', forAdvanced: 'For Advanced Learners',
      guiding: 'Guiding Questions', synthesis: 'Synthesis and Reflection',
      closing: 'Closing Discussion', exit: 'Exit Ticket', realLife: 'Real-Life Connection',
    };
    const bloomLabels = isFilipino
      ? ['KAALAMAN', 'PAG-UNAWA', 'PAGLALAPAT', 'PAGSUSURI', 'PAGTATAYA']
      : ['KNOWLEDGE', 'COMPREHENSION', 'APPLICATION', 'ANALYSIS', 'EVALUATION'];

    const lessonHeader = `LESSON: ${lessonName} | AREA: ${learningArea} | TEACHER: ${teacherName}
GRADE: ${gradeSection} | SESSIONS: ${sessions} | CITY: ${city}
COMPETENCY: ${competency}
CLASSROOM: ${classroomDetails}
 ${noProjector ? 'NOTE: NO projector or TV — use board, chalk, cartolina only.' : ''}`;

    const systemPrompt = `You are an expert DepEd ILAW lesson plan writer.
• Write in ${lang}
• Use bullet points (•) only — no numbered lists.
• Teacher instructions must be word-for-word scripts.
• Examples must use real ${city} places/prices/events.
• Label Bloom's questions: ${bloomLabels.map(label => `[${label}]`).join(' ')}
• FLOW must be on its OWN line alone.
• Write for EVERY session — never skip any.`;

    // SIMPLIFIED prompt — reduced verbosity to fit 60s
    const prompt = `Write the FLOW section for an ILAW lesson plan. Write for EVERY session.

 ${lessonHeader}

FLOW
For EACH session write:

**${L.session} N — "Title" (duration)**

**${L.teacherScript}:** Word-for-word lines with ${city} examples.
**${L.studentActions}:** What students do at each stage.
**${L.examples}:**
• One fully worked example using a real ${city} place/price.
• One fully worked example using a different ${city} context.
**${L.diffLabel}:**
• **${L.forAll}:** Universal instruction.
• **${L.forSupport}:** Specific scaffold.
• **${L.forAdvanced}:** Higher-order challenge.
**${L.guiding}:**
• [${bloomLabels[0]}] Question
• [${bloomLabels[1]}] Question
• [${bloomLabels[2]}] Question
• [${bloomLabels[3]}] Question
• [${bloomLabels[4]}] Question
**${L.synthesis}:**
• **${L.closing}:** 2 discussion questions with expected responses.
• **${L.exit}:** Exit ticket question + scoring guide.
• **${L.realLife}:** 1-2 sentences connecting to ${city}.`;

    const result = await callAI(systemPrompt, prompt, apiKey, 'C-FLOW', 5000, apiKey2, geminiKey, openrouterKey);
    
    return NextResponse.json({ content: ensureFlowTag(result) });
  } catch (error: any) {
    console.error('FLOW ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
