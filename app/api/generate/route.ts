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
    const {
      lessonName, learningArea, teacherName, gradeSection,
      competency, sessions, classroomDetails
    } = body;

    if (!lessonName || !learningArea || !teacherName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
    console.log('Language mode:', isFilipino ? 'FILIPINO' : 'ENGLISH');

    const L = isFilipino ? {
      objectiveLink: 'Kaugnay na Layunin',
      diffInstructions: 'Mga Naka-differentiate na Tagubilin',
      forAll: 'Para sa Lahat ng Mag-aaral',
      forSupport: 'Para sa Mga Nangangailangan ng Tulong',
      forAdvanced: 'Para sa mga Advanced na Mag-aaral',
      guidingQuestions: 'Mga Gabay na Tanong',
      sessionLabel: 'SESYON',
      partLabel: 'BAHAGI',
      synthesisLabel: 'Buod at Repleksyon',
      cognitive: 'Kognitibo',
      psychomotor: 'Sikolohikal',
      affective: 'Pandama',
      materials: 'Mga Kagamitan',
      procedure: 'Mga Hakbang',
      purpose: 'Layunin ng Aktibidad',
      description: 'Paglalarawan',
      administration: 'Paraan ng pagbibigay',
      howResultsUsed: 'Paano gagamitin ang mga resulta',
      rubric: 'Rubrika o gabay sa pagmamarka',
      accommodation: 'Mga angkop na tulong',
      strengthsPrior: 'Mga Kalakasan at Nakaraang Kaalaman',
      interests: 'Mga Interes at Pakikipag-ugnayan',
      barriers: 'Mga Hadlang sa Pagkatuto',
      accommodations: 'Mga Angkop na Tulong at Suporta',
      primaryMaterials: 'Pangunahing Kagamitan',
      references: 'Mga Sanggunian',
      emergency: 'Mga Alternatibo sa Emerhensya',
      otherAreas: 'Iba pang Larangang Pang-aralan',
      specialTopics: 'Mga Espesyal na Paksa / Kamalayan sa Karera',
      values: 'Integrasyon ng mga Pagpapahalaga',
      technology: 'Teknolohiya (Hinaharap na Integrasyon)',
      forRemediation: 'Para sa Mga Nangangailangan ng Remedyasyon',
      forEnrichment: 'Para sa mga Advanced na Mag-aaral (Pagpapayaman)',
      closingDiscussion: 'Pangwakas na talakayan',
      exitTicket: 'Exit ticket',
      realLife: 'Koneksyon sa tunay na buhay',
    } : {
      objectiveLink: 'Objective Link',
      diffInstructions: 'Differentiated Instructions',
      forAll: 'For All Learners',
      forSupport: 'For Learners Who Need Support',
      forAdvanced: 'For Advanced Learners',
      guidingQuestions: 'Guiding Questions',
      sessionLabel: 'SESSION',
      partLabel: 'PART',
      synthesisLabel: 'Synthesis and Reflection',
      cognitive: 'Cognitive',
      psychomotor: 'Psychomotor',
      affective: 'Affective',
      materials: 'Materials',
      procedure: 'Procedure',
      purpose: 'Purpose',
      description: 'Description',
      administration: 'Administration',
      howResultsUsed: 'How results are used',
      rubric: 'Rubric or scoring guide',
      accommodation: 'Accommodation for diverse learners',
      strengthsPrior: 'Strengths and Prior Knowledge',
      interests: 'Interests and Engagement Hooks',
      barriers: 'Possible Barriers to Learning',
      accommodations: 'Accommodations and Support',
      primaryMaterials: 'Primary Materials',
      references: 'Reference Materials',
      emergency: 'Emergency Alternatives',
      otherAreas: 'Other Learning Areas',
      specialTopics: 'Special Topics / Career Awareness',
      values: 'Values Integration',
      technology: 'Technology (Future Integration)',
      forRemediation: 'For Learners Who Need Reinforcement (Remediation)',
      forEnrichment: 'For Advanced Learners (Enrichment)',
      closingDiscussion: 'Closing discussion',
      exitTicket: 'Exit ticket',
      realLife: 'Real-life connection',
    };

    const langRule = isFilipino
      ? `PANUNTUNAN SA WIKA: Isulat ang BUONG nilalaman sa natural, propesyonal na FILIPINO/TAGALOG.
         Bawal ang Ingles sa loob ng mga seksyon maliban sa mga ALL CAPS section key labels at teknikal na terminolohiya.
         Lahat ng subheading, tagubilin, tanong, at paliwanag ay dapat sa Filipino.`
      : `LANGUAGE RULE: Write the ENTIRE lesson plan content in ENGLISH only.`;

    const prompt = `You are a master DepEd curriculum writer and instructional coach in the Philippines with 20 years of experience writing detailed, classroom-ready ILAW Framework lesson plans for DepEd public secondary schools in Davao City.

${langRule}

Write a COMPLETE, DETAILED, CLASSROOM-READY lesson plan. Every section must be THOROUGH. A substitute teacher should be able to pick this up and teach without any other reference.

Use EXACTLY these section labels (ALL CAPS followed by colon). Do not skip any:

REFERENCES:
List 4-6 specific references with page numbers and MELC code.

DECLARATION_AI:
3-4 sentences: AI (Groq/Gemini AI) assisted in generating this plan, teacher reviewed and adapted all content, complies with DO 3 s.2026 Annex A.

LEARNING_COMPETENCY:
Full MELC competency text, MELC code, Content Standard, and Performance Standard.

LEARNING_OBJECTIVES:
For EACH session under bold session headers, write at least 3 objectives for each domain:
**${L.cognitive}:** (knowledge and understanding)
**${L.psychomotor}:** (skills and tasks)
**${L.affective}:** (values and attitudes)

LEARNER_CONTEXT:
**${L.strengthsPrior}:** at least 3 bullets
**${L.interests}:** at least 3 bullets
**${L.barriers}:** at least 4 bullets
**${L.accommodations}:** at least 4 bullets

PRE_LESSON:
For EACH session write:
**[Session label] [N] - "[Activity Name]" ([minutes])**
**${L.materials}:** list all needed
**${L.procedure}:**
1. exact step
2. what teacher says/does
3. student response
4. how it activates prior knowledge
**${L.purpose}:** why this is effective pedagogically

FLOW:
Complete lesson flow for ALL sessions:

**${L.sessionLabel} [N] - [Title] ([total time])**

**${L.partLabel} 1 - [Activity Name] ([time])**
**${L.objectiveLink}:**
- detailed teacher instructions (what to say, draw, demonstrate)
- student actions and expected responses
- at least 3 specific Davao City contextualized examples (Bankerohan Market, Samal Island, Mount Apo, Davao Port, SM Lanang, Kadayawan Festival, habal-habal, durian vendors, tuna fishing, etc.)
**${L.diffInstructions}:**
**${L.forAll}:** concrete activity for everyone
**${L.forSupport}:** simplified version with visual aids or guide questions
**${L.forAdvanced}:** extension task
**${L.guidingQuestions}:**
- recall question
- analysis question
- application question using Davao City context

**${L.partLabel} 2 - [Activity Name] ([time])**
[same structure]

**${L.partLabel} 3 - ${L.synthesisLabel} ([time])**
**${L.closingDiscussion}:** discussion questions
**${L.exitTicket}:** describe the task
**${L.realLife}:** connection to Davao City daily life

LEARNING_RESOURCES:
**${L.primaryMaterials}:** detailed bullets of all physical materials
**${L.references}:** DepEd LM and TG with specific page numbers
**${L.emergency}:** at least 3 specific contingency plans

OPPORTUNITIES_FOR_INTEGRATION:
**${L.otherAreas}:** at least 3 subject connections
**${L.specialTopics}:** at least 2 Davao City career connections
**${L.values}:** Filipino values connected to the lesson
**${L.technology}:** free tools like GeoGebra, Google Maps, Canva for future use

FORMATIVE_ASSESSMENT:
For EACH session:
**[Session label] [N] - [Assessment Tool Name]**
**${L.description}:**
**${L.administration}:**
**${L.howResultsUsed}:**
**${L.rubric}:**
**${L.accommodation}:**

EXTENDED_LEARNING:
**${L.forAll}:** 2 tasks with specific Davao City context
**${L.forRemediation}:** 2 scaffolded tasks with step-by-step support
**${L.forEnrichment}:** 2 challenging tasks beyond the competency

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
1. Every example MUST use a specific Davao City context.
2. If no projector/TV in classroom details, use ONLY board, chalk, cartolina, flashcards, string, ruler.
3. If TV/projector is available, include how to use it in the activity.
4. Every FLOW section MUST include all three Differentiated Instruction levels.
5. Do NOT write placeholder text - write actual detailed content.
6. Use **bold text** (asterisks) for all sub-headers.
7. Use - for all bullet points.
8. Number all procedure steps as 1. 2. 3.
9. Minimum 400 words per session in the FLOW section.`;

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
        console.log('=== AI OUTPUT PREVIEW ===');
        console.log(content.slice(0, 500));
        console.log('=== END PREVIEW ===');
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