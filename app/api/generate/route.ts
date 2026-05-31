export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    console.log('--- Generate request received ---');

    const body = await req.json();
    const {
      lessonName, learningArea, teacherName, gradeSection,
      competency, sessions, classroomDetails, schoolCity,
    } = body;

    const city = schoolCity?.trim() || 'their city';

    if (!lessonName || !learningArea || !teacherName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    if (!hasGroq && !hasGemini && !hasOpenRouter) {
      return NextResponse.json({ error: 'No AI API key found in environment. Please set GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY.' }, { status: 500 });
    }

    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
    console.log('Language mode:', isFilipino ? 'FILIPINO' : 'ENGLISH', '| City:', city);

    // ── Labels ───────────────────────────────────────────────────
    const L = isFilipino ? {
      cognitive:          'Kognitibo',
      psychomotor:        'Sikolohikal',
      affective:          'Pandama',
      byEnd:              'Sa katapusan ng sesyong ito, maisasagawa ng mga mag-aaral ang',
      strengths:          'Mga Kalakasan at Nakaraang Kaalaman',
      interests:          'Mga Interes at Pakikipag-ugnayan',
      barriers:           'Mga Hadlang sa Pagkatuto',
      support:            'Mga Angkop na Tulong at Suporta',
      materials:          'Mga Kagamitan',
      procedure:          'Mga Hakbang',
      purpose:            'Layunin ng Aktibidad',
      warmup:             'Halimbawa ng tanong para sa warm-up',
      objLink:            'Kaugnay na Layunin',
      teacherScript:      'Mga tagubilin para sa guro',
      studentActions:     'Mga aksyon ng mag-aaral at inaasahang tugon',
      examples:           'Mga halimbawang kontekstwalisado',
      diffLabel:          'Mga Naka-differentiate na Tagubilin',
      forAll:             'Para sa Lahat ng Mag-aaral',
      forSupport:         'Para sa Mga Nangangailangan ng Tulong',
      forAdvanced:        'Para sa mga Advanced na Mag-aaral (Pagpapayaman)',
      forRemediation:     'Para sa Mga Nangangailangan ng Remedyasyon',
      guiding:            'Mga Gabay na Tanong',
      closing:            'Pangwakas na talakayan',
      exit:               'Exit Ticket',
      realLife:           'Koneksyon sa tunay na buhay',
      session:            'SESYON',
      part:               'BAHAGI',
      synthesis:          'Buod at Repleksyon',
      primaryMat:         'Pangunahing Kagamitan',
      refMat:             'Mga Sanggunian',
      emergency:          'Mga Alternatibo sa Emerhensya',
      otherAreas:         'Iba pang Larangang Pang-aralan',
      specialTopics:      'Mga Espesyal na Paksa / Kamalayan sa Karera',
      values:             'Integrasyon ng mga Pagpapahalaga',
      tech:               'Teknolohiya (Hinaharap na Integrasyon)',
      descLabel:          'Paglalarawan',
      sampleTasks:        'Halimbawa ng mga tanong o gawain',
      admin:              'Paraan ng pagbibigay',
      howUsed:            'Paano gagamitin ang mga resulta',
      rubric:             'Rubrika o gabay sa pagmamarka',
      accom:              "Mga angkop na tulong para sa iba't ibang mag-aaral",
    } : {
      cognitive:          'Cognitive',
      psychomotor:        'Psychomotor',
      affective:          'Affective',
      byEnd:              'By the end of this session, learners will be able to',
      strengths:          'Strengths and Prior Knowledge',
      interests:          'Interests and Engagement Hooks',
      barriers:           'Possible Barriers to Learning',
      support:            'Accommodations and Support',
      materials:          'Materials',
      procedure:          'Procedure',
      purpose:            'Purpose',
      warmup:             'Sample warm-up question',
      objLink:            'Objective Link',
      teacherScript:      'Teacher instructions (script)',
      studentActions:     'Student actions and expected responses',
      examples:           `Contextualized examples using ${city} landmarks`,
      diffLabel:          'Differentiated Instructions',
      forAll:             'For All Learners',
      forSupport:         'For Learners Who Need Support',
      forAdvanced:        'For Advanced Learners (Enrichment)',
      forRemediation:     'For Learners Who Need Reinforcement (Remediation)',
      guiding:            'Guiding Questions',
      closing:            'Closing discussion',
      exit:               'Exit ticket',
      realLife:           'Real-life connection',
      session:            'SESSION',
      part:               'PART',
      synthesis:          'Synthesis and Reflection',
      primaryMat:         'Primary Materials',
      refMat:             'Reference Materials',
      emergency:          'Emergency Alternatives',
      otherAreas:         'Other Learning Areas',
      specialTopics:      'Special Topics / Career Awareness',
      values:             'Values Integration',
      tech:               'Technology (Future Integration)',
      descLabel:          'Description',
      sampleTasks:        'Sample tasks or questions',
      admin:              'Administration',
      howUsed:            'How results are used',
      rubric:             'Rubric or scoring guide',
      accom:              'Accommodation for diverse learners',
    };

    const lang = isFilipino
      ? 'FILIPINO/TAGALOG. Lahat ng salita, subheading, at paliwanag ay sa Filipino. Bawal ang Ingles maliban sa ALL CAPS section keys at teknikal na termino.'
      : 'ENGLISH only. No Filipino/Tagalog words anywhere except ALL CAPS section keys.';

    // ── System prompt (static rules — kept separate to reduce user token count) ──
    const systemPrompt = `You are an expert DepEd Philippines curriculum writer and master teacher.
Write COMPLETE, DEEPLY SPECIFIC, CLASSROOM-READY ILAW lesson plans.
ABSOLUTE RULES — never violate:
- USE ONLY BULLET POINTS (•) for every list. NO numbered lists anywhere.
- Every teacher script is word-for-word. Never write "discuss the topic" or "ask students about X".
- Every example names a SPECIFIC local place, price, person, or event from the city provided. Never generic.
- Every guiding question is written in full and labeled: [KNOWLEDGE] [COMPREHENSION] [APPLICATION] [ANALYSIS] [EVALUATION]
- NEVER skip or merge sessions. PRE_LESSON and FLOW must have a separate full entry for EVERY session.
- A substitute teacher must be able to run every session using ONLY this document.`;

    // ── User prompt (dynamic lesson data only) ────────────────────────────
    const prompt = `Write a COMPLETE ILAW lesson plan in ${lang}.

Output sections in this EXACT order using ALL-CAPS labels followed by colon:

REFERENCES:
4-6 real DepEd references with page numbers and MELC code.

DECLARATION_AI:
${isFilipino
  ? '3-4 pangungusap sa FILIPINO tungkol sa paggamit ng Gemini AI, pagsusuri ng guro, at pagsunod sa DO 3 s.2026 Annex A.'
  : '3-4 sentences in ENGLISH about Gemini AI assistance, teacher review, and DO 3 s.2026 Annex A compliance.'}

LEARNING_COMPETENCY:
Full MELC text, MELC code, Content Standard, Performance Standard.

LEARNING_OBJECTIVES:
For EACH session, bold header then 3 objectives per domain:
**${L.cognitive}:** ${L.byEnd}...
**${L.psychomotor}:** ${L.byEnd}...
**${L.affective}:** ${L.byEnd}...

LEARNER_CONTEXT:
**${L.strengths}:** 3+ specific bullets
**${L.interests}:** 3+ bullets relevant to ${city} learners
**${L.barriers}:** 4+ specific bullets
**${L.support}:** 4+ actionable bullets

PRE_LESSON:
For EVERY session (do not skip any):
**${L.session} N - "Activity Name" (time)**
**${L.materials}:** list
**${L.procedure}:**
1. Exact teacher action
2. Word-for-word teacher script using ${city} context
3. Expected student response
4. How it activates prior knowledge
**${L.purpose}:** why this prepares learners
**${L.warmup}:** "Actual question using ${city} context"

FLOW:
For EVERY session and every part:
**${L.session} N - Title (total time)**
**${L.part} 1 - Activity Name (time)**
**${L.objLink}:** specific objective addressed
**${L.teacherScript}:** Word-for-word script: opening, board work steps, comprehension checks, transition
**${L.studentActions}:** exactly what students do, say, and produce
**${L.examples}:** 2+ fully solved problems with REAL numbers from ${city} (show every step)
**${L.diffLabel}:**
**${L.forAll}:** exact instructions
**${L.forSupport}:** scaffolded version
**${L.forAdvanced}:** genuine extension task
**${L.guiding}:**
- recall question
- analysis question
- application question using ${city}
**${L.part} 3 - ${L.synthesis} (time)**
**${L.closing}:** 3+ actual discussion questions with expected responses
**${L.exit}:** exact question answerable in 2-3 minutes
**${L.realLife}:** 2-3 sentences connecting lesson to ${city} context

LEARNING_RESOURCES:
**${L.primaryMat}:** specific bullets
**${L.refMat}:** bullets with page numbers
**${L.emergency}:** 3+ contingency plans

OPPORTUNITIES_FOR_INTEGRATION:
**${L.otherAreas}:** 3+ connections
**${L.specialTopics}:** 2+ career connections in ${city}
**${L.values}:** Filipino values in this lesson
**${L.tech}:** free digital tools

FORMATIVE_ASSESSMENT:
For EVERY session:
**${L.session} N - Assessment Tool Name**
**${L.descLabel}:** what it measures
**${L.sampleTasks}:**
1. Full question/task with ${city} context
2. Full question/task
3. Full question/task
**${L.admin}:** how and how long
**${L.howUsed}:** specific teacher action based on results
**${L.rubric}:**
4 - descriptor
3 - descriptor
2 - descriptor
1 - descriptor
**${L.accom}:** specific accommodations

EXTENDED_LEARNING:
**${L.forAll}:** 2 tasks with ${city} context
**${L.forRemediation}:** 2 scaffolded tasks
**${L.forAdvanced}:** 2 challenging tasks

---
LESSON: ${lessonName} | AREA: ${learningArea} | TEACHER: ${teacherName}
GRADE: ${gradeSection} | SESSIONS: ${sessions} | CITY: ${city}
COMPETENCY: ${competency}
CLASSROOM: ${classroomDetails}
${!classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv') ? 'NO PROJECTOR/TV: Use only board, chalk, cartolina, flashcards.' : ''}

Write in ${lang}. Use ONLY bullet points (•). Word-for-word scripts. Specific ${city} examples.`;

    let completion: any = null;
    let lastError: any = null;

    // ── 1. Try Groq ───────────────────────────────────────────────
    if (hasGroq) {
      const PREFERRED = [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.1-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-70b-8192',
      ];

      let GROQ_MODELS: string[] = PREFERRED;
      try {
        const r = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        });
        if (r.ok) {
          const d = await r.json();
          const live = new Set<string>(
            (d.data || []).filter((m: any) => m.active !== false).map((m: any) => m.id as string)
          );
          const verified = PREFERRED.filter(id => live.has(id));
          const extras = [...live].filter(id =>
            !verified.includes(id) &&
            (id.includes('llama') || id.includes('qwen') || id.includes('gpt-oss') || id.includes('deepseek')) &&
            !id.includes('guard') && !id.includes('whisper') && !id.includes('tts') && !id.includes('vision')
          );
          GROQ_MODELS = verified.length > 0 ? [...verified, ...extras.slice(0, 3)] : PREFERRED;
          console.log('Groq models to try:', GROQ_MODELS.join(', '));
        }
      } catch (e) {
        console.warn('Groq model list fetch failed, using defaults');
      }

      for (const model of GROQ_MODELS) {
        try {
          console.log('Trying Groq model:', model);
          completion = await groq.chat.completions.create({
            model,
            max_tokens: 8192,
            temperature: 0.7,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          });
          console.log('Groq success:', model, '| finish:', completion.choices[0].finish_reason);
          break;
        } catch (err: any) {
          console.warn(`Groq ${model} failed:`, err?.message);
          lastError = err;
          const skip = err?.message?.includes('rate_limit') || err?.message?.includes('429') ||
                       err?.message?.includes('413') || err?.status === 429 || err?.status === 413 ||
                       err?.message?.includes('Request too large') || err?.message?.includes('model_not_found') ||
                       err?.message?.includes('does not exist') || err?.message?.includes('decommissioned');
          if (!skip) throw err;
        }
      }
    }

    // ── 2. Try Gemini (if Groq failed or unavailable) ─────────────
    if (!completion && hasGemini) {
      const GEMINI_MODELS = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.5-pro-preview-06-05',
      ];

      for (const model of GEMINI_MODELS) {
        try {
          console.log('Trying Gemini model:', model);
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
              },
            }),
          });

          const d = await r.json();

          if (d.error) {
            const isRateLimit = d.error.code === 429 || d.error.status === 'RESOURCE_EXHAUSTED';
            console.warn(`Gemini ${model} error:`, d.error.message);
            lastError = new Error(d.error.message);
            if (isRateLimit) continue; // try next model
            throw new Error(d.error.message);
          }

          const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            completion = {
              choices: [{ message: { content: text }, finish_reason: 'stop' }],
            };
            console.log('Gemini success:', model);
            break;
          }

          lastError = new Error(`Gemini ${model} returned no content`);
        } catch (err: any) {
          console.warn(`Gemini ${model} failed:`, err?.message);
          lastError = err;
        }
      }
    }

    // ── 3. Try OpenRouter (last resort) ──────────────────────────
    if (!completion && hasOpenRouter) {
      const OPENROUTER_MODELS = [
        'deepseek/deepseek-v3:free',
        'deepseek/deepseek-r1:free',
        'meta-llama/llama-3.3-70b-instruct:free',
      ];

      for (const model of OPENROUTER_MODELS) {
        try {
          console.log('Trying OpenRouter:', model);
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://ilaw-generator.vercel.app',
              'X-Title': 'ILAW Lesson Plan Generator',
            },
            body: JSON.stringify({
              model, max_tokens: 8192, temperature: 0.7,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
            }),
          });
          const d = await r.json();
          if (d.choices?.[0]?.message?.content) {
            completion = {
              choices: [{ message: { content: d.choices[0].message.content }, finish_reason: 'stop' }],
            };
            console.log('OpenRouter success:', model);
            break;
          }
          lastError = new Error(d.error?.message || `${model} returned no content`);
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    if (!completion) {
      const wait = lastError?.message?.match(/try again in (.+?)\./)?.[1];
      throw new Error(
        wait
          ? `All models rate limited. Try again in ${wait}.`
          : 'All models currently rate limited. Please try again in a few minutes.'
      );
    }

    const rawContent = completion.choices[0].message.content ?? '';
    if (!rawContent) return NextResponse.json({ error: 'AI returned empty content' }, { status: 500 });

    // ── Post-processor: fix leaked English subheadings in Filipino output ──
    let content = rawContent;
    if (isFilipino) {
      const fix: [RegExp, string][] = [
        [/\*\*Strengths and Prior Knowledge\*\*/g,              `**${L.strengths}**`],
        [/\*\*Interests and Engagement Hooks\*\*/g,             `**${L.interests}**`],
        [/\*\*Possible Barriers to Learning\*\*/g,              `**${L.barriers}**`],
        [/\*\*Accommodations and Support\*\*/g,                 `**${L.support}**`],
        [/\*\*For All Learners\*\*/g,                           `**${L.forAll}**`],
        [/\*\*For Learners Who Need Support\*\*/g,              `**${L.forSupport}**`],
        [/\*\*For Learners Who Need Reinforcement[^*]*\*\*/g,   `**${L.forRemediation}**`],
        [/\*\*For Advanced Learners[^*]*\*\*/g,                 `**${L.forAdvanced}**`],
        [/\*\*Primary Materials\*\*/g,                          `**${L.primaryMat}**`],
        [/\*\*Reference Materials\*\*/g,                        `**${L.refMat}**`],
        [/\*\*Emergency Alternatives\*\*/g,                     `**${L.emergency}**`],
        [/\*\*Other Learning Areas\*\*/g,                       `**${L.otherAreas}**`],
        [/\*\*Special Topics \/ Career Awareness\*\*/g,         `**${L.specialTopics}**`],
        [/\*\*Values Integration\*\*/g,                         `**${L.values}**`],
        [/\*\*Technology[^*]*\*\*/g,                            `**${L.tech}**`],
        [/\*\*Differentiated Instructions\*\*/g,                `**${L.diffLabel}**`],
        [/\*\*Guiding Questions\*\*/g,                          `**${L.guiding}**`],
        [/\*\*Objective Link\*\*/g,                             `**${L.objLink}**`],
        [/\*\*Detailed teacher instructions\*\*/g,              `**${L.teacherScript}**`],
        [/\*\*Teacher instructions[^*]*\*\*/g,                  `**${L.teacherScript}**`],
        [/\*\*Student actions and expected responses\*\*/g,     `**${L.studentActions}**`],
        [/\*\*Contextualized example[^*]*\*\*/g,                `**${L.examples}**`],
        [/\*\*Synthesis and Reflection\*\*/g,                   `**${L.synthesis}**`],
        [/\*\*Closing discussion\*\*/g,                         `**${L.closing}**`],
        [/\*\*Exit ticket\*\*/gi,                               `**${L.exit}**`],
        [/\*\*Real-life connection\*\*/g,                       `**${L.realLife}**`],
        [/\*\*Materials\*\*:/g,                                 `**${L.materials}**:`],
        [/\*\*Procedure\*\*:/g,                                 `**${L.procedure}**:`],
        [/\*\*Purpose\*\*:/g,                                   `**${L.purpose}**:`],
        [/\*\*Sample warm-up question\*\*/g,                    `**${L.warmup}**`],
        [/\*\*Description\*\*:/g,                               `**${L.descLabel}**:`],
        [/\*\*Administration\*\*:/g,                            `**${L.admin}**:`],
        [/\*\*How results are used\*\*/g,                       `**${L.howUsed}**`],
        [/\*\*Rubric or scoring guide\*\*/g,                    `**${L.rubric}**`],
        [/\*\*Accommodation for diverse learners\*\*/g,         `**${L.accom}**`],
        [/\*\*Sample tasks or questions\*\*/g,                  `**${L.sampleTasks}**`],
        [/\*\*Cognitive\*\*:/g,                                 `**${L.cognitive}**:`],
        [/\*\*Psychomotor\*\*:/g,                               `**${L.psychomotor}**:`],
        [/\*\*Affective\*\*:/g,                                 `**${L.affective}**:`],
      ];
      for (const [p, r] of fix) content = content.replace(p, r);
    }

    console.log('Content length:', content.length);
    return NextResponse.json({ content });

  } catch (error: any) {
    console.error('ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown server error' }, { status: 500 });
  }
}