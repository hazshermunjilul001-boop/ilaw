import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const {
    lessonName, learningArea, teacherName, gradeSection,
    competency, sessions, classroomDetails
  } = await req.json();

  const prompt = `You are a master DepEd curriculum writer and instructional coach in the Philippines with 20 years of experience writing detailed, classroom-ready ILAW Framework lesson plans for Davao City public secondary schools.

Your task is to write a COMPLETE, DETAILED, CLASSROOM-READY lesson plan. Every section must be THOROUGH — not a summary, not a skeleton. A substitute teacher should be able to pick this up and teach it without any other reference.

Use EXACTLY these section labels (ALL CAPS, followed by colon). Do not add extra labels.

---

REFERENCES:
List 4–6 specific references: DepEd LM page numbers, TG chapter, MELC code, and 1–2 other relevant books or toolkits.

DECLARATION_AI:
Write 3–4 sentences stating that AI (Groq AI / Llama 3.3) assisted in generating this lesson plan, that all content was reviewed and adapted by the teacher, and that it complies with DO 3 s.2026 Annex A.

LEARNING_COMPETENCY:
State the full MELC competency text, MELC code, Content Standard, and Performance Standard verbatim and completely.

LEARNING_OBJECTIVES:
Write objectives for EACH session separately under bold session headers. For each session write at least 3 objectives each for:
- Cognitive (knowledge and understanding)
- Psychomotor (skills and tasks)
- Affective (values and attitudes)
Use "By the end of this session, the learners will be able to..." format. Be specific and measurable.

LEARNER_CONTEXT:
Write 4 subsections with bold headers:
**Strengths and Prior Knowledge:** — at least 3 bullets describing what learners already know and can do, based on prior grade level competencies
**Interests and Engagement Hooks:** — at least 3 bullets describing what motivates and engages these learners, including Davao City cultural context
**Possible Barriers to Learning:** — at least 4 bullets describing specific challenges: class size, technology, language, cognitive load, etc.
**Accommodations and Support:** — at least 4 bullets describing concrete strategies for inclusion, mixed-ability grouping, and differentiated support

PRE_LESSON:
For EACH session, write a complete warm-up activity with these clearly labeled sub-parts:
**[Session Number] — Activity Name (X minutes)**
**Materials:** [list all materials needed]
**Procedure:**
- Step-by-step instructions (at least 4 steps)
**Purpose:** [1–2 sentences explaining the pedagogical reason for this activity]

FLOW:
This is the most important section. Write the complete lesson flow for ALL sessions combined. For each session use this structure:

**SESSION [N] — [Title] ([total time])**

**PART 1 — [Activity Name] ([time])**
**Objective Link:** [which session objective this addresses]
Under each part write:
- Detailed teacher instructions (what to say, what to draw, what to ask)
- Student actions and expected responses
- At least 3–4 contextualized example problems using Davao City landmarks, industries, or community scenarios (Samal Island ferry routes, Mount Apo surveying, Marilog farmland, Davao Port navigation, Kadayawan Festival, Bankerohan Market, etc.)
- Differentiated Instructions with THREE clearly labeled sub-sections:
  **For All Learners:** [what everyone does]
  **For Learners Who Need Support:** [simplified version, visual aids, peer pairing strategies]
  **For Advanced Learners:** [extension task, deeper problem, leadership role]
- Guiding Questions to check understanding (at least 2–3 questions per part)

**PART 2 — [Activity Name] ([time])**
[Same structure as above]

**PART 3 — Synthesis and Reflection ([time])**
- Closing discussion questions
- Exit ticket description
- Connection to real life in Davao City

[Repeat for each session]

LEARNING_RESOURCES:
Write 3 subsections:
**Primary Materials:** — bullet list of all physical materials (cartolina, flashcards, chalk, string, etc.) with specific descriptions of how each is used
**Reference Materials:** — DepEd LM and TG with specific page numbers
**Emergency Alternatives:** — at least 3 specific contingency plans if materials are unavailable

OPPORTUNITIES_FOR_INTEGRATION:
Write 4 subsections with bold headers:
**Other Learning Areas:** — at least 3 subject integrations with specific connections
**Special Topics / Career Awareness:** — at least 2 Davao City career connections
**Values Integration:** — Filipino values connected to the lesson content
**Technology (Future Integration):** — free tools like GeoGebra or Google Maps that could be used when technology becomes available

FORMATIVE_ASSESSMENT:
For EACH session write the assessment tools with this structure:
**[Session N] — [Assessment Tool Name]**
- Description of the task
- How it is administered
- How the teacher uses the results
- Rubric or scoring guide (where applicable)
- Accommodation for learners who need support
Always include differentiated assessment options.

EXTENDED_LEARNING:
Write 3 clearly labeled subsections:
**For All Learners:** — 2 engaging tasks connecting to Davao City daily life
**For Learners Who Need Reinforcement (Remediation):** — 2 simplified tasks with scaffolding (step-by-step guides, peer support, visual models)
**For Advanced Learners (Enrichment):** — 2 challenging tasks that go beyond the competency (research, creation, community application)

---

LESSON INPUT DETAILS:
- Name of Lesson: ${lessonName}
- Learning Area: ${learningArea}
- Teacher: ${teacherName}
- Grade Level and Section: ${gradeSection}
- Learning Competency: ${competency}
- Sessions: ${sessions}
- Classroom Details: ${classroomDetails}

ABSOLUTE RULES — follow every one of these:
1. Every example problem MUST use a Davao City context (name specific places, professions, events).
2. If classroom details say no projector or TV, use ONLY board, chalk, cartolina, flashcards, string, ruler, and printed/handwritten materials.
3. Every FLOW section must include Differentiated Instructions (For All Learners / For Learners Who Need Support / For Advanced Learners).
4. Write in professional DepEd tone — clear, specific, and respectful.
5. Do NOT write placeholder text like "[write here]" or "[insert example]" — write the actual content.
6. Minimum length: each FLOW session must be at least 400 words. The full lesson plan must be comprehensive and ready to use.
7. Use **bold text** (with asterisks) for all sub-headers and key terms within sections.
8. Use bullet points (starting with -) for all lists.
9. Number steps in procedures as 1. 2. 3. etc.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = completion.choices[0].message.content ?? '';
  return NextResponse.json({ content });
}