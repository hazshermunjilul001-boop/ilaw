// app/api/generate/flow/route.ts
// PARTS B+C: PRE_LESSON + FLOW + LEARNING_RESOURCES + OPPORTUNITIES_FOR_INTEGRATION
// Two parallel calls, each ~20s — fits within Vercel Hobby 60s limit.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { callAI } from '../../../../lib/callAI';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lessonName, learningArea, teacherName, gradeSection, competency, sessions, classroomDetails, schoolCity } = body;

    const city = schoolCity?.trim() || 'their city';
    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
    const noProjector = !classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv');

    const lang = isFilipino
      ? 'FILIPINO/TAGALOG. Lahat ng salita, subheading, at paliwanag ay sa Filipino. Bawal ang Ingles maliban sa ALL CAPS section keys at teknikal na termino.'
      : 'ENGLISH only. No Filipino/Tagalog words anywhere except ALL CAPS section keys.';

    const L = isFilipino ? {
      session:       'SESYON',
      materials:     'Mga Kagamitan',
      procedure:     'Mga Hakbang',
      purpose:       'Layunin ng Aktibidad',
      warmup:        'Halimbawa ng tanong para sa warm-up',
      teacherScript: 'Mga tagubilin para sa guro',
      studentActions:'Mga aksyon ng mag-aaral at inaasahang tugon',
      examples:      'Mga halimbawang kontekstwalisado',
      diffLabel:     'Mga Naka-differentiate na Tagubilin',
      forAll:        'Para sa Lahat ng Mag-aaral',
      forSupport:    'Para sa Mga Nangangailangan ng Tulong',
      forAdvanced:   'Para sa mga Advanced na Mag-aaral (Pagpapayaman)',
      guiding:       'Mga Gabay na Tanong',
      synthesis:     'Buod at Repleksyon',
      closing:       'Pangwakas na talakayan',
      exit:          'Exit Ticket',
      realLife:      'Koneksyon sa tunay na buhay',
      primaryMat:    'Pangunahing Kagamitan',
      emergency:     'Mga Alternatibo sa Emerhensya',
      otherAreas:    'Iba pang Larangang Pang-aralan',
      specialTopics: 'Mga Espesyal na Paksa / Kamalayan sa Karera',
      values:        'Integrasyon ng mga Pagpapahalaga',
      tech:          'Teknolohiya (Hinaharap na Integrasyon)',
    } : {
      session:       'SESSION',
      materials:     'Materials',
      procedure:     'Procedure',
      purpose:       'Purpose',
      warmup:        'Sample warm-up question',
      teacherScript: 'Teacher instructions (script)',
      studentActions:'Student actions and expected responses',
      examples:      `Contextualized examples using ${city} landmarks`,
      diffLabel:     'Differentiated Instructions',
      forAll:        'For All Learners',
      forSupport:    'For Learners Who Need Support',
      forAdvanced:   'For Advanced Learners (Enrichment)',
      guiding:       'Guiding Questions',
      synthesis:     'Synthesis and Reflection',
      closing:       'Closing discussion',
      exit:          'Exit ticket',
      realLife:      'Real-life connection',
      primaryMat:    'Primary Materials',
      emergency:     'Emergency Alternatives',
      otherAreas:    'Other Learning Areas',
      specialTopics: 'Special Topics / Career Awareness',
      values:        'Values Integration',
      tech:          'Technology (Future Integration)',
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

    const promptB = `Write SECTION B of an ILAW lesson plan. Output ONLY the PRE_LESSON section, fully written for EVERY session. Never skip any session.
The section key PRE_LESSON must be on its OWN line alone.

${lessonHeader}

PRE_LESSON
Write a complete entry for EVERY session listed in SESSIONS above. Use this exact structure for each:

**${L.session} N — "Warm-Up Activity Title" (time)**
**${L.materials}:** • list every physical item needed
**${L.procedure}:**
• [Word-for-word teacher line 1] → Expected student response
• [Word-for-word teacher line 2] → Expected student response
• [Word-for-word teacher line 3] → Expected student response
• [Word-for-word teacher line 4] → Expected student response
• [Word-for-word teacher line 5] → Expected student response
**${L.purpose}:** One sentence: what prior knowledge this activates and why it matters for today's session.
**${L.warmup}:** Write the full question using a specific ${city} place, person, or event. Then write the expected complete student answer.`;

    const promptC = `Write SECTION C of an ILAW lesson plan. Output ONLY these 3 sections in order, fully written. Never skip any session.
Each section key must be on its OWN line alone.

${lessonHeader}

FLOW
Write the complete lesson flow for EVERY session. For each session, design a coherent instructional sequence guided by these Learning Design Principles (DO 016 s.2026 Annex B):
• Clear Goals • Scaffolding • Active Learning • Checks for Understanding • Differentiation • Connection to Real Life

For EACH session write:
**${L.session} N — "Session Title" (total duration)**

**${L.teacherScript}:** Word-for-word teacher lines. Include real ${city} examples with specific names, places, or amounts.
**${L.studentActions}:** What students write, say, calculate, or produce at each stage.
**${L.examples}:**
• Example 1: Fully worked problem using a real ${city} street, institution, or price — show complete solution.
• Example 2: Fully worked problem using a different real ${city} context — show complete solution.
**${L.diffLabel}:**
• **${L.forAll}:** Exact universal instruction for all students.
• **${L.forSupport}:** Specific scaffold explicitly tied to this task.
• **${L.forAdvanced}:** Genuine higher-order challenge.
**${L.guiding}:**
• [KNOWLEDGE] Full question
• [COMPREHENSION] Full question
• [APPLICATION] Full question
• [ANALYSIS] Full question
• [EVALUATION] Full question
**${L.synthesis}:**
• **${L.closing}:** Write 3 full discussion questions with expected student responses.
• **${L.exit}:** Write the exact exit ticket question + scoring guide.
• **${L.realLife}:** 2-3 sentences connecting this lesson to something real and current in ${city}.

LEARNING_RESOURCES
**${L.primaryMat}:** • List 3 distinct resources detailing authors, specific module chapters, and exact page numbers.
**${L.emergency}:** • Provide 3 comprehensive backup strategies if all technology or printed resources fail.

OPPORTUNITIES_FOR_INTEGRATION
**${L.otherAreas}:** • Provide 2 explicit subject-to-subject links showing how ${lessonName} connects to other Grade 10 subjects.
**${L.specialTopics}:** • Connect this topic to 2 real public offices or enterprises in ${city} where professionals use these skills.
**${L.values}:** • Identify 2 explicit moments where Filipino core values are actively reinforced.
**${L.tech}:** • Detail 2 accessible digital tools with absolute URLs that enhance learning outside class.`;

    // Run B and C in parallel — each is fast enough to fit within 60s together
    const [partB, partC] = await Promise.all([
      callAI(systemPrompt, promptB, 'B-PRELESSON'),
      callAI(systemPrompt, promptC, 'C-FLOW'),
    ]);

    return NextResponse.json({ content: partB + '\n\n' + partC });
  } catch (error: any) {
    console.error('FLOW ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}