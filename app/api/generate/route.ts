export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    console.log('--- Generate request received ---');

    const body = await req.json();
    console.log('Learning Area:', body.learningArea);
    console.log('Lesson Name:', body.lessonName);

    const {
      lessonName, learningArea, teacherName, gradeSection,
      competency, sessions, classroomDetails
    } = body;

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
      warmupQuestion:   'Halimbawa ng tanong para sa warm-up',
      sampleTasks:      'Halimbawa ng mga tanong o gawain',
    } : {
      objectiveLink:        'Objective Link',
      teacherInstructions:  'Detailed teacher instructions',
      studentActions:       'Student actions and expected responses',
      exampleProblems:      'Contextualized example problems using Residence City landmarks',
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
      warmupQuestion:   'Sample warm-up question',
      sampleTasks:      'Sample tasks or questions',
    };

    const langRule = isFilipino
      ? `PANUNTUNAN SA WIKA: Isulat ang BUONG nilalaman sa natural, propesyonal na FILIPINO/TAGALOG. 
         Bawal ang Ingles sa loob ng mga seksyon maliban sa mga naka-ALL CAPS na section key labels (FLOW:, LEARNING_OBJECTIVES:, atbp.) at sa mga terminolohiyang teknikal na walang Filipino equivalent (hal. graph, demand curve).
         Ang lahat ng subheading, tagubilin, tanong, at paliwanag ay dapat sa Filipino.`
      : `LANGUAGE RULE: Write the ENTIRE lesson plan content in ENGLISH only.`;

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
**${L.warmupQuestion}:** "[Write the actual warm-up question using Residence City context]"

FLOW:
Isulat ang kumpletong daloy ng aralin para sa LAHAT ng sesyon. Para sa bawat bahagi ng bawat sesyon:

**SESSION [N] - [Pamagat] ([kabuuang oras])**

**BAHAGI 1 - [Pangalan ng Aktibidad] ([oras])**
**${L.objectiveLink}:**
**${L.teacherInstructions}:**
**${L.studentActions}:**
**${L.exampleProblems}:**
- Bankerohan Market, Agdao Market, Ilustre Market
- durian vendors sa Magsaysay Park
- pasalubong shops sa Aldevinco
- SM Lanang, Abreeza Mall, NCCC Mall
- jeepney o habal-habal fares sa Residence City
- tuna at bangus mula sa Samal Island
**${L.diffInstructions}:**
**${L.forAll}:** [konkretong aktibidad para sa lahat]
**${L.forSupport}:** [simplified na bersyon na may visual aids o guide questions]
**${L.forAdvanced}:** [extension task na hihiwalay sa grupo]
**${L.guidingQuestions}:**
- [Tanong 1 — pang-recall]
- [Tanong 2 — pang-analysis]
- [Tanong 3 — pang-application sa Residence City context]

**PART 2 - [Activity Name] ([time])**
[same structure]

**PART 3 - Synthesis and Reflection ([time])**
- closing discussion
- exit ticket
- real-life connection

LEARNING_RESOURCES:
**Primary Materials:** bullets
**Reference Materials:** bullets with page numbers
**Emergency Alternatives:** at least 3 contingency plans

OPPORTUNITIES_FOR_INTEGRATION:
**Other Learning Areas:** at least 3 subject connections
**Special Topics / Career Awareness:** at least 2 Residence City career connections
**Values Integration:** Filipino values connected to the lesson
**Technology (Future Integration):** free tools for future use

FORMATIVE_ASSESSMENT:
Para sa BAWAT sesyon, isulat ang detalyadong formative assessment:

**Session [N] - [Pangalan ng Assessment Tool]**
**${L.description}:**
**${L.sampleTasks}:**
**${L.administration}:**
**${L.howResultsUsed}:**
**${L.rubric}:**
**${L.accommodation}:**

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

ABSOLUTE RULES:
1. Every example MUST use a specific Residence City context.
2. If no projector/TV in classroom details, use ONLY board, chalk, cartolina, flashcards, string, ruler.
3. Every FLOW section MUST include Differentiated Instructions with all three levels.
4. Do NOT write placeholder text - write actual content.
5. Use **bold text** (asterisks) for all sub-headers.
6. Use - for bullet points.
7. Number steps as 1. 2. 3.`;

    let content = '';

    // ── Try Groq first ─────────────────────────────────────────────
    const GROQ_MODELS = [
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
    ];

    let groqSuccess = false;
    for (const model of GROQ_MODELS) {
      try {
        console.log('Trying Groq model:', model);
        const completion = await groq.chat.completions.create({
          model,
          max_tokens: 4096,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        });
        content = completion.choices[0].message.content ?? '';
        if (content) {
          console.log('Groq success:', model, '| Length:', content.length);
          groqSuccess = true;
          break;
        }
      } catch (err: any) {
        const isRateLimit = err?.message?.includes('rate_limit') ||
                            err?.message?.includes('429') ||
                            err?.message?.includes('decommissioned') ||
                            err?.status === 429;
        console.warn(`Groq ${model} failed:`, err?.message?.slice(0, 80));
        if (!isRateLimit) break;
      }
    }

    // ── Fallback to Gemini if Groq failed ──────────────────────────
    if (!groqSuccess || !content) {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: 'All Groq models are rate limited and no Gemini key is configured. Please try again in a few minutes.' },
          { status: 503 }
        );
      }
      try {
        console.log('Falling back to Gemini 2.0 Flash...');
        const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        content = result.response.text();
        console.log('Gemini success | Length:', content.length);
      } catch (geminiErr: any) {
        console.error('Gemini also failed:', geminiErr?.message);
        return NextResponse.json(
          { error: 'All AI providers are currently busy. Please try again in 1-2 minutes.' },
          { status: 503 }
        );
      }
    }

    if (!content) {
      return NextResponse.json({ error: 'No content generated. Please try again.' }, { status: 500 });
    }

    console.log('Final content length:', content.length);
    return NextResponse.json({ content });

  } catch (error: any) {
    console.error('=== ROUTE ERROR ===', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Unknown server error' },
      { status: 500 }
    );
  }
}