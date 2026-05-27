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

    const languageRule = isFilipino ? `
LANGUAGE RULE — Sundin ito nang mahigpit:
Isulat ang BUONG lesson plan sa FILIPINO/TAGALOG.
Isinalin ang LAHAT ng subheading:
- "For All Learners" = "Para sa Lahat ng Mag-aaral"
- "For Learners Who Need Support" = "Para sa Mga Mag-aaral na Nangangailangan ng Tulong"
- "For Advanced Learners" = "Para sa mga Advanced na Mag-aaral"
- "Guiding Questions" = "Mga Gabay na Tanong"
- "Objective Link" = "Kaugnay na Layunin"
- "Materials" = "Mga Kagamitan"
- "Procedure" = "Mga Hakbang"
- "Purpose" = "Layunin ng Aktibidad"
- "Strengths and Prior Knowledge" = "Mga Kalakasan at Nakaraang Kaalaman"
- "Interests and Engagement Hooks" = "Mga Interes at Pakikipag-ugnayan"
- "Possible Barriers to Learning" = "Mga Hadlang sa Pagkatuto"
- "Accommodations and Support" = "Mga Angkop na Tulong at Suporta"
- "Primary Materials" = "Pangunahing Kagamitan"
- "Reference Materials" = "Mga Sanggunian"
- "Emergency Alternatives" = "Mga Alternatibo sa Emerhensya"
- "Differentiated Instructions" = "Mga Naka-differentiate na Tagubilin"
- "Synthesis and Reflection" = "Buod at Repleksyon"
- "Guiding Questions" = "Mga Gabay na Tanong"
Gumamit ng natural, propesyonal na Filipino. HUWAG gumamit ng Ingles sa loob ng mga seksyon.
Ang section label keys (LEARNING_COMPETENCY:, FLOW:, atbp.) ay dapat manatiling ALL CAPS ENGLISH.
` : `
LANGUAGE RULE: Write the ENTIRE lesson plan in ENGLISH.
`;

    const prompt = `You are a master DepEd curriculum writer and instructional coach in the Philippines with 20 years of experience writing detailed, classroom-ready ILAW Framework lesson plans for Davao City public secondary schools.
${languageRule}
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

LEARNER_CONTEXT:
Write 4 subsections:
**Strengths and Prior Knowledge:** at least 3 bullets
**Interests and Engagement Hooks:** at least 3 bullets
**Possible Barriers to Learning:** at least 4 bullets
**Accommodations and Support:** at least 4 bullets

PRE_LESSON:
For EACH session write a complete warm-up with:
**[Session] - Activity Name (X minutes)**
**Materials:** list
**Procedure:**
1. step one
2. step two
3. step three
4. step four
**Purpose:** explanation

FLOW:
Write the complete lesson flow for ALL sessions. For each session:

**SESSION [N] - [Title] ([total time])**

**PART 1 - [Activity Name] ([time])**
**Objective Link:** which objective this addresses
- detailed teacher instructions
- student actions and expected responses
- at least 3 contextualized example problems using Davao City landmarks
**Differentiated Instructions:**
**For All Learners:** what everyone does
**For Learners Who Need Support:** simplified version with visual aids
**For Advanced Learners:** extension task
**Guiding Questions:**
- question 1
- question 2
- question 3

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
**Special Topics / Career Awareness:** at least 2 Davao City career connections
**Values Integration:** Filipino values connected to the lesson
**Technology (Future Integration):** free tools for future use

FORMATIVE_ASSESSMENT:
For EACH session:
**[Session N] - [Assessment Tool Name]**
- description
- administration
- how results are used
- rubric or scoring guide
- accommodation for struggling learners

EXTENDED_LEARNING:
**For All Learners:** 2 tasks with Davao City context
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
1. Every example MUST use a specific Davao City context.
2. If no projector/TV in classroom details, use ONLY board, chalk, cartolina, flashcards, string, ruler.
3. Every FLOW section MUST include Differentiated Instructions with all three levels.
4. Do NOT write placeholder text - write actual content.
5. Use **bold text** (asterisks) for all sub-headers.
6. Use - for bullet points.
7. Number steps as 1. 2. 3.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

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