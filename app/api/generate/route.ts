export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    console.log('--- Generate request received ---');

    const body = await req.json();
    console.log('Learning Area:', body.learningArea);
    console.log('Lesson Name:', body.lessonName);

    const {
      lessonName, learningArea, teacherName, gradeSection,
      competency, sessions, classroomDetails, schoolCity
    } = body;

    const city = schoolCity?.trim() || 'their city';

    if (!lessonName || !learningArea || !teacherName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not found in environment' }, { status: 500 });
    }

    console.log('Sending to Groq...');

    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
    console.log('Language mode:', isFilipino ? 'FILIPINO' : 'ENGLISH');

    // ── Language-specific structural labels ──────────────────────────
    const L = isFilipino ? {
      objectiveLink:        'Kaugnay na Layunin',
      teacherInstructions:  'Mga tagubilin para sa guro',
      studentActions:       'Mga aksyon ng mag-aaral at inaasahang tugon',
      exampleProblems:      'Mga halimbawang kontekstwalisado',
      diffInstructions:     'Mga Naka-differentiate na Tagubilin',
      forAll:               'Para sa Lahat ng Mag-aaral',
      forSupport:           'Para sa Mga Nangangailangan ng Tulong',
      forAdvanced:          'Para sa mga Advanced na Mag-aaral',
      guidingQuestions:     'Mga Gabay na Tanong',
      closingDiscussion:    'Pangwakas na talakayan',
      exitTicket:           'Exit ticket',
      realLifeConnection:   'Koneksyon sa tunay na buhay',
      description:          'Paglalarawan',
      administration:       'Paraan ng pagbibigay',
      howResultsUsed:       'Paano gagamitin ang mga resulta',
      rubric:               'Rubrika o gabay sa pagmamarka',
      accommodation:        'Mga angkop na tulong para sa iba\'t ibang mag-aaral',
      sessionLabel:         'SESYON',
      partLabel:            'BAHAGI',
      synthesisLabel:       'Buod at Repleksyon',
      cognitive:            'Kognitibo',
      psychomotor:          'Sikolohikal',
      affective:            'Pandama',
      byEndOfSession:       'Sa katapusan ng sesyong ito, maisasagawa ng mga mag-aaral ang',
      warmupQuestion:       'Halimbawa ng tanong para sa warm-up',
      sampleTasks:          'Halimbawa ng mga tanong o gawain',
    } : {
      objectiveLink:        'Objective Link',
      teacherInstructions:  'Detailed teacher instructions',
      studentActions:       'Student actions and expected responses',
      exampleProblems:      'Contextualized example problems using ${city} landmarks',
      diffInstructions:     'Differentiated Instructions',
      forAll:               'For All Learners',
      forSupport:           'For Learners Who Need Support',
      forAdvanced:          'For Advanced Learners',
      guidingQuestions:     'Guiding Questions',
      closingDiscussion:    'Closing discussion',
      exitTicket:           'Exit ticket',
      realLifeConnection:   'Real-life connection',
      description:          'Description',
      administration:       'Administration',
      howResultsUsed:       'How results are used',
      rubric:               'Rubric or scoring guide',
      accommodation:        'Accommodation for diverse learners',
      sessionLabel:         'SESSION',
      partLabel:            'PART',
      synthesisLabel:       'Synthesis and Reflection',
      cognitive:            'Cognitive',
      psychomotor:          'Psychomotor',
      affective:            'Affective',
      byEndOfSession:       'By the end of this session, the learners will be able to',
      warmupQuestion:       'Sample warm-up question',
      sampleTasks:          'Sample tasks or questions',
    };

    const langRule = isFilipino
      ? `PANUNTUNAN SA WIKA: Isulat ang BUONG nilalaman sa natural, propesyonal na FILIPINO/TAGALOG. 
         Bawal ang Ingles sa loob ng mga seksyon maliban sa mga naka-ALL CAPS na section key labels (FLOW:, LEARNING_OBJECTIVES:, atbp.) at sa mga terminolohiyang teknikal na walang Filipino equivalent (hal. graph, demand curve).
         Ang lahat ng subheading, tagubilin, tanong, at paliwanag ay dapat sa Filipino.`
      : `LANGUAGE RULE: Write the ENTIRE lesson plan content in ENGLISH only.`;

    // ── Language-specific detailed instructions ─────────────────────
    const flowInstructions = isFilipino ? `
FLOW:
Isulat ang KUMPLETONG daloy ng aralin para sa LAHAT ng sesyon. Para sa bawat bahagi:

**SESYON [N] - [Pamagat] ([kabuuang oras])**

**${L.partLabel} 1 - [Pangalan ng Aktibidad] ([oras])**
**${L.objectiveLink}:** [Isulat ang TIYAK na layunin mula sa LEARNING_OBJECTIVES na tinutugunan ng bahaging ito]
**${L.teacherInstructions}:** Isulat ang mga tagubilin ng guro bilang SCRIPT. Kasama ang:
  - Eksaktong pambungad na salita (hal. "Sabihin: 'Klase, tingnan ninyo ang larawang ito...'")
  - Hakbang-hakbang na pagtuturo sa pisara
  - Mga tanong para masuri ang pag-unawa ng mga mag-aaral habang nagtatakbo ang aktibidad
  - Pangwakas na pahayag para sa susunod na bahagi
**${L.studentActions}:** Ilarawan ang EKSAKTONG ginagawa, sinasabi, at ginagawa ng mga mag-aaral — hindi lang "makinig at kumuha ng tala." Kasama ang inaasahang verbal na tugon sa mga tanong ng guro.
**${L.exampleProblems}:** Isulat ang HINDI BABABA SA 2 GANAP NA NASOSOLUSYUNAN na kontekstwalisadong halimbawa gamit ang mga TIYAK na lugar sa ${city} na may TUNAY na numero. Ipakita ang kumpletong hakbang ng solusyon.
  Gamitin ang mga lokal na konteksto tulad ng: mga palengke, paaralan, tanggapan ng pamahalaan, pamilihan, transportasyon, at mga sikat na lugar sa ${city}.
**${L.diffInstructions}:**
**${L.forAll}:** [Tiyak na aktibidad na may eksaktong tagubilin — ano ang gagawin nila, anong materyales, anong output]
**${L.forSupport}:** [Scaffolded na bersyon — hal. bahagyang nasosolusyunan na problema na pupunan lang ng mga mag-aaral, o reference card ng formula]
**${L.forAdvanced}:** [Tunay na extension — mas mahirap na problema, patunay, real-world application, o paglikha ng sariling problema]
**${L.guidingQuestions}:**
- [Tanong sa recall — direkta mula sa nilalaman ng aralin]
- [Tanong sa analysis — nangangailangan ng paghahambing, pagpapaliwanag, o pagbibigay-katwiran]
- [Tanong sa application — gumagamit ng tiyak na sitwasyon sa ${city} na may mga numero]

**${L.partLabel} 3 - ${L.synthesisLabel} ([oras])**
**${L.closingDiscussion}:** Isulat ang AKTWAL na mga tanong sa talakayan na itatanong ng guro sa klase (hindi bababa sa 3 tanong). Kasama ang inaasahang tugon ng mga mag-aaral.
**${L.exitTicket}:** Isulat ang EKSAKTONG tanong o gawaing sasaguting ng mga mag-aaral bago umalis. Dapat masagot sa loob ng 2-3 minuto at direktang sinusukat ang layunin ng sesyon.
**${L.realLifeConnection}:** Isulat ang tiyak na 2-3 pangungusap na sasabihin ng guro upang ikonekta ang aralin sa tunay na konteksto sa ${city} na personal na maiuugnay ng mga mag-aaral.
` : `
FLOW:
Write the COMPLETE lesson flow for ALL sessions. For each part of each session:

**SESSION [N] - [Title] ([total time])**

**${L.partLabel} 1 - [Activity Name] ([time])**
**${L.objectiveLink}:** [State the SPECIFIC objective from LEARNING_OBJECTIVES this part addresses]
**${L.teacherInstructions}:** Write as a TEACHING SCRIPT. Include:
  - Exact opening words (e.g. "Say to the class: 'Look at this diagram...'")
  - Step-by-step board work or demonstration with exact content
  - Mid-activity comprehension check questions with expected responses
  - Transition statement to the next part
**${L.studentActions}:** Describe exactly what students DO, SAY, and PRODUCE — not just "listen and take notes." Include expected verbal responses.
**${L.exampleProblems}:** Write AT LEAST 2 FULLY SOLVED contextualized problems using SPECIFIC ${city} landmarks with REAL numbers. Show every solution step.
  Use local contexts such as: local markets, schools, government offices, malls, transportation routes, tourist spots, and landmarks in ${city}.
**${L.diffInstructions}:**
**${L.forAll}:** [Specific activity with exact instructions — what they do, with what materials, producing what output]
**${L.forSupport}:** [Scaffolded version — e.g. partially solved problem where students fill in only steps 3-4, or a formula reference card]
**${L.forAdvanced}:** [Genuine extension — harder problem, a proof, real-world application, or creating their own problem]
**${L.guidingQuestions}:**
- [Recall question — directly from lesson content]
- [Analysis question — requires comparing, explaining, or justifying]
- [Application question — uses a specific ${city} scenario with numbers]

**${L.partLabel} 3 - ${L.synthesisLabel} ([time])**
**${L.closingDiscussion}:** Write the ACTUAL discussion questions (at least 3) the teacher will ask. Include expected student responses.
**${L.exitTicket}:** Write the EXACT exit ticket question students answer before leaving. Must be completable in 2-3 minutes and directly assess the session objective.
**${L.realLifeConnection}:** Write a specific 2-3 sentence statement connecting today's lesson to a real ${city} context students can personally relate to.
`;

    const preLessonInstructions = isFilipino ? `
PRE_LESSON:
Para sa BAWAT sesyon, isulat ang kumpletong warm-up activity:

**Session [N] - "[Pangalan ng Aktibidad]" ([oras])**
**Materials:** [listahan]
**Procedure:**
1. [Eksaktong hakbang — ano ang gagawin ng guro]
2. [Ano ang sasabihin ng guro — word-for-word kung posible]
3. [Paano mag-re-respond ang mga mag-aaral]
4. [Paano ito nag-a-activate ng prior knowledge]
**Purpose:** [Paliwanag kung bakit ito epektibo para sa araling ito]
**${L.warmupQuestion}:** "[Write the actual warm-up question using ${city} context]"
` : `
PRE_LESSON:
For EACH session, write the complete warm-up activity:

**Session [N] - "[Activity Name]" ([time])**
**Materials:** [list]
**Procedure:**
1. [Exact teacher step]
2. [Exact teacher script]
3. [Student response]
4. [How it activates prior knowledge]
**Purpose:** [Why this is effective]
**${L.warmupQuestion}:** "[Actual warm-up question using ${city} context]"
`;

    const formativeInstructions = isFilipino ? `
FORMATIVE_ASSESSMENT:
Para sa BAWAT sesyon, isulat ang detalyadong formative assessment:

**Session [N] - [Pangalan ng Assessment Tool]**
**${L.description}:**
**${L.sampleTasks}:**
**${L.administration}:**
**${L.howResultsUsed}:**
**${L.rubric}:**
**${L.accommodation}:**
` : `
FORMATIVE_ASSESSMENT:
For EACH session, write the detailed formative assessment:

**Session [N] - [Assessment Tool Name]**
**${L.description}:**
**${L.sampleTasks}:**
**${L.administration}:**
**${L.howResultsUsed}:**
**${L.rubric}:**
**${L.accommodation}:**
`;

    const absoluteRules = `
ABSOLUTE RULES — VIOLATIONS MAKE THE LESSON PLAN UNUSABLE:
1. Every contextualized example MUST name a SPECIFIC landmark, place, or situation in ${city} with ACTUAL numbers.
2. If no projector/TV in classroom details, use ONLY board, chalk, cartolina, flashcards, string, ruler.
3. Every FLOW PART must have Differentiated Instructions with ALL THREE levels fully written — never write "provide extra support" or "provide more complex problems" as those are unacceptable placeholders.
4. PRE_LESSON must include a warm-up for EVERY session — not just Session 1.
5. PART 3 Synthesis must have actual written discussion questions, an actual exit ticket question, and an actual real-life connection statement — never leave these as single-word labels.
6. FORMATIVE_ASSESSMENT must include fully written assessment items with complete problem statements or questions — not just descriptions of what the assessment is.
7. FLOW teacher instructions must read like a teaching script — what the teacher physically does and says, word for word.
8. Contextualized examples must show COMPLETE solutions with numbered steps — not just mention the context.
9. Do NOT truncate, summarize, or skip any section. Every section must be fully written.
10. ${isFilipino ? 'Lahat ng nilalaman ay sa FILIPINO/TAGALOG. Bawal ang Ingles maliban sa section key labels at mga teknikal na terminong walang katumbas sa Filipino.' : 'Write ALL content in ENGLISH only.'}
`;

    const prompt = `You are a master DepEd curriculum writer and instructional coach in the Philippines with 20 years of experience writing detailed, classroom-ready ILAW Framework lesson plans for DepEd public secondary schools.
${langRule}

Your task is to write a COMPLETE, DETAILED, CLASSROOM-READY lesson plan. Every section must be THOROUGH. A substitute teacher should be able to pick this up and teach it without any other reference.

Use EXACTLY these section labels (ALL CAPS, followed by colon):

REFERENCES:
List 4-6 specific references with page numbers and MELC code.

DECLARATION_AI:
3-4 sentences about AI assistance, teacher review, and DO 3 s.2026 Annex A compliance.

LEARNING_COMPETENCY:
Full MELC competency text, MELC code, Content Standard, and Performance Standard.

LEARNING_OBJECTIVES:
For EACH session under bold session headers, write at least 3 objectives each for Cognitive, Psychomotor, and Affective domains. Use "By the end of this session, the learners will be able to..." format.
**${L.cognitive}:** ${L.byEndOfSession}...
**${L.psychomotor}:** ${L.byEndOfSession}...
**${L.affective}:** ${L.byEndOfSession}...

LEARNER_CONTEXT:
Write 4 subsections:
**Strengths and Prior Knowledge:** at least 3 bullets
**Interests and Engagement Hooks:** at least 3 bullets
**Possible Barriers to Learning:** at least 4 bullets
**Accommodations and Support:** at least 4 bullets

${preLessonInstructions}

${flowInstructions}

LEARNING_RESOURCES:
**Primary Materials:** bullets
**Reference Materials:** bullets with page numbers
**Emergency Alternatives:** at least 3 contingency plans

OPPORTUNITIES_FOR_INTEGRATION:
**Other Learning Areas:** at least 3 subject connections
**Special Topics / Career Awareness:** at least 2 Residence City career connections
**Values Integration:** Filipino values connected to the lesson
**Technology (Future Integration):** free tools for future use

${formativeInstructions}

EXTENDED_LEARNING:
**For All Learners:** 2 tasks with Residence City context
**For Learners Who Need Reinforcement (Remediation):** 2 scaffolded tasks
**For Advanced Learners (Enrichment):** 2 challenging tasks

---
LESSON DETAILS:
- Name of Lesson: ${lessonName}
- Learning Area: ${learningArea}
- Teacher: ${teacherName}
- Grade Level and Section: ${gradeSection}
- Learning Competency: ${competency}
- Sessions: ${sessions}
- Classroom Details: ${classroomDetails}
- School City: ${city}

${absoluteRules}`;

    const GROQ_MODELS = [
      'llama-3.3-70b-versatile',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'openai/gpt-oss-120b',
      'llama-3.1-8b-instant',
    ];

    // OpenRouter free models as final fallback (separate quota entirely)
    const OPENROUTER_MODELS = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
    ];

    let completion: any = null;
    let lastError: any = null;

    // ── Try Groq models first ──
    for (const model of GROQ_MODELS) {
      try {
        console.log('Trying Groq model:', model);
        completion = await groq.chat.completions.create({
          model,
          max_tokens: 8192,      // raised from 4096
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        });
        console.log('Success with Groq model:', model);
        break;
      } catch (err: any) {
        console.warn(`Groq model ${model} failed:`, err?.message);
        lastError = err;
        const isRateLimit = err?.message?.includes('rate_limit') ||
                            err?.message?.includes('429') ||
                            err?.status === 429;
        if (!isRateLimit) throw err;
      }
    }

    // ── Fallback to OpenRouter if all Groq models exhausted ──
    if (!completion && process.env.OPENROUTER_API_KEY) {
      for (const model of OPENROUTER_MODELS) {
        try {
          console.log('Trying OpenRouter model:', model);
          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://ilaw-generator.vercel.app',
              'X-Title': 'ILAW Lesson Plan Generator',
            },
            body: JSON.stringify({
              model,
              max_tokens: 8192,
              temperature: 0.7,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const orData = await orRes.json();
          if (orData.choices?.[0]?.message?.content) {
            // Normalize to same shape as Groq response
            completion = { choices: [{ message: { content: orData.choices[0].message.content }, finish_reason: 'stop' }] };
            console.log('Success with OpenRouter model:', model);
            break;
          }
          lastError = new Error(orData.error?.message || `OpenRouter model ${model} returned no content`);
        } catch (err: any) {
          console.warn(`OpenRouter model ${model} failed:`, err?.message);
          lastError = err;
        }
      }
    }

if (!completion) {
  const waitMsg = lastError?.message?.match(/try again in (.+?)\./)?.[1];
  throw new Error(
    waitMsg
      ? `All models are rate limited. Please try again in ${waitMsg}.`
      : 'All models are currently rate limited. Please try again in a few minutes.'
  );
}

    console.log('Groq responded. Finish reason:', completion.choices[0].finish_reason);

    const content = completion.choices[0].message.content ?? '';

    if (!content) {
      return NextResponse.json({ error: 'Groq returned empty content' }, { status: 500 });
    }

    console.log('Content length:', content.length, 'characters');
    console.log('--- Done ---');

    return NextResponse.json({ content });

  } catch (error: any) {
    console.error('=== ROUTE ERROR ===');
    console.error('Message:', error?.message);
    console.error('Status:', error?.status);
    console.error('Code:', error?.code);
    console.error('===================');
    return NextResponse.json(
      { error: error?.message || 'Unknown server error' },
      { status: 500 }
    );
  }
}