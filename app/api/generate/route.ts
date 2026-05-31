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
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasMistral = !!process.env.MISTRAL_API_KEY;
    const hasCerebras = !!process.env.CEREBRAS_API_KEY;

    if (!hasGroq && !hasOpenRouter && !hasMistral && !hasCerebras) {
      return NextResponse.json({ error: 'No API key found. Add GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, or CEREBRAS_API_KEY to .env.local' }, { status: 500 });
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

    // ── Prompts: system (rules) + user (lesson data only) ───────────────────
    // Split keeps token count ~4k so all free-tier models can handle it.
    const systemPrompt = `You are an expert DepEd Philippines ILAW lesson plan writer. Always follow these rules:
• Use bullet points (•) only — absolutely no numbered lists anywhere.
• Every teacher instruction must be a word-for-word script — never write "discuss", "explain", or "ask students about X" as placeholders.
• Every example must name a real, specific place, price, or event from the city given — never generic.
• Label every question with its Bloom's level: [KNOWLEDGE] [COMPREHENSION] [APPLICATION] [ANALYSIS] [EVALUATION].
• Write a fully separate PRE_LESSON and FLOW entry for every session — never skip, merge, or abbreviate.
• A substitute teacher with no subject knowledge must be able to run every session using only this document.`;

    const noProjector = !classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv');
    const aiNote = isFilipino
      ? '3-4 pangungusap sa FILIPINO tungkol sa paggamit ng AI, pagsusuri ng guro, at pagsunod sa DO 3 s.2026 Annex A.'
      : '3-4 sentences about AI assistance, teacher review, and DO 3 s.2026 Annex A compliance.';

    const prompt = `Write a COMPLETE classroom-ready ILAW lesson plan in ${lang}.
${noProjector ? 'NOTE: NO projector or TV — use board, chalk, cartolina, flashcards only.' : ''}

LESSON: ${lessonName} | AREA: ${learningArea} | TEACHER: ${teacherName}
GRADE: ${gradeSection} | SESSIONS: ${sessions} | CITY: ${city}
COMPETENCY: ${competency}
CLASSROOM: ${classroomDetails}

Output these sections IN ORDER using ALL-CAPS label + colon. Write every section in full — no placeholders.

REFERENCES: 4-6 real DepEd references with full citation, page numbers, MELC code.

DECLARATION_AI: ${aiNote}

LEARNING_COMPETENCY: Full MELC text, code, Content Standard, Performance Standard.

LEARNING_OBJECTIVES: Per session separately — **${L.cognitive}**, **${L.psychomotor}**, **${L.affective}** with Bloom's action verbs.

LEARNER_CONTEXT:
**${L.strengths}:** 4+ specific bullets about prior knowledge this class has
**${L.interests}:** 4+ bullets tied to real ${city} youth culture or community life
**${L.barriers}:** 5+ specific learning barriers
**${L.support}:** 5+ concrete strategies matched to each barrier above

PRE_LESSON: Separate full entry for EVERY session — never skip:
**${L.session} N — "Activity Title" (time)**
**${L.materials}:** • bullet list of every item needed
**${L.procedure}:** • each bullet = one specific teacher action or word-for-word script line + expected student response
**${L.purpose}:** what prior knowledge this activates and why it matters for today
**${L.warmup}:** one fully written question using a specific ${city} place/person/event, with expected answers

FLOW: Full entry for EVERY session. Write Parts 1, 2, 3 — never skip Part 2:
**${L.session} N — "Title" (total time)**
**${L.part} 1 — "Activity" (time)**
**${L.objLink}:** which specific objective this addresses
**${L.teacherScript}:** • word-for-word bullet script: opening → modeling with ${city} example → board steps → mid-activity check → transition
**${L.studentActions}:** • exactly what students do, write, say, and produce
**${L.examples}:** • 2 fully worked examples set in ${city} — real street names, peso amounts, actual titles, real institutions
**${L.diffLabel}:**
• **${L.forAll}:** exact universal instruction
• **${L.forSupport}:** specific scaffold (e.g., graphic organizer with first row pre-filled, sentence starters)
• **${L.forAdvanced}:** genuine higher-order task — not just "more of the same"
**${L.guiding}:** • 5 questions, one per Bloom's level, each fully written and labeled
**${L.part} 2 — "Activity" (time):** [same full structure as Part 1]
**${L.part} 3 — ${L.synthesis} (time):**
• **${L.closing}:** 3 discussion questions with expected student responses
• **${L.exit}:** exact question + scoring guide (complete vs. incomplete answer)
• **${L.realLife}:** 2-3 sentences connecting to something happening NOW in ${city}

LEARNING_RESOURCES: Primary materials, references with page numbers, 3 emergency alternatives fully described.

OPPORTUNITIES_FOR_INTEGRATION: Subject connections, ${city} career paths (name real companies/institutions), Filipino values with specific lesson moments, free digital tools with URLs.

FORMATIVE_ASSESSMENT: Separate full entry for EVERY session:
**${L.session} N — "Tool Name"**
**${L.descLabel}:** what skill/knowledge it measures and why this method fits
**${L.sampleTasks}:** • 3 full tasks labeled with Bloom's level, at least one set in ${city}
**${L.admin}:** exact procedure, timing, silent or collaborative, how submitted
**${L.howUsed}:** specific teacher action for scores 1-2 vs 3-4
**${L.rubric}:** • 4 - [full mastery descriptor] • 3 - [proficiency] • 2 - [developing] • 1 - [beginning]
**${L.accom}:** • accommodations for reading difficulty, absent students, early finishers

EXTENDED_LEARNING:
**${L.forAll}:** • 2 take-home tasks rooted in ${city} daily life
**${L.forRemediation}:** • 2 scaffolded tasks with explicit step-by-step instructions
**${L.forAdvanced}:** • 2 tasks requiring synthesis/creation for a real ${city} audience`;

    let completion: any = null;
    let lastError: any = null;

    const isSkippable = (err: any, msg = err?.message ?? '') =>
      err?.status === 429 || err?.status === 413 ||
      msg.includes('429') || msg.includes('413') ||
      msg.includes('rate_limit') || msg.includes('Request too large') ||
      msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') ||
      msg.includes('limit: 0') || msg.includes('model_not_found') ||
      msg.includes('does not exist') || msg.includes('decommissioned');

    // ── 1. Groq — free, no billing (groq.com) ────────────────────
    // Only large-context models; 8b models have 6k TPM which is too small.
    if (hasGroq) {
      const PREFERRED = [
        'meta-llama/llama-4-scout-17b-16e-instruct',  // 500k TPD free
        'llama-3.3-70b-versatile',                    // 100k TPD free
        'llama-3.1-70b-versatile',
        'compound-beta',
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
            (id.includes('llama-3.3') || id.includes('llama-4') || id.includes('llama-3.1-70b')) &&
            !id.includes('guard') && !id.includes('whisper') && !id.includes('tts') &&
            !id.includes('8b') && !id.includes('8B')
          );
          GROQ_MODELS = verified.length > 0 ? [...verified, ...extras.slice(0, 2)] : PREFERRED;
          console.log('Groq models to try:', GROQ_MODELS.join(', '));
        }
      } catch { console.warn('Groq model list fetch failed, using defaults'); }

      for (const model of GROQ_MODELS) {
        try {
          console.log('Trying Groq:', model);
          completion = await groq.chat.completions.create({
            model, max_tokens: 8192, temperature: 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
          });
          console.log('Groq success:', model, '| finish:', completion.choices[0].finish_reason);
          break;
        } catch (err: any) {
          console.warn(`Groq ${model} failed:`, err?.message);
          lastError = err;
          if (!isSkippable(err)) throw err;
        }
      }
    }

    // ── 2. OpenRouter — free models, no billing (openrouter.ai) ──
    // Free signup, no credit card. OPENROUTER_API_KEY in .env.local
    if (!completion && hasOpenRouter) {
      const OR_MODELS = [
        'deepseek/deepseek-v3:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'deepseek/deepseek-r1:free',
        'google/gemma-3-27b-it:free',
        'mistralai/mistral-7b-instruct:free',
        'microsoft/phi-4-reasoning-plus:free',
        'tngtech/deepseek-r1t-chimera:free',
      ];
      for (const model of OR_MODELS) {
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
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
              ],
            }),
          });
          const d = await r.json();
          if (d.choices?.[0]?.message?.content) {
            completion = { choices: [{ message: { content: d.choices[0].message.content }, finish_reason: 'stop' }] };
            console.log('OpenRouter success:', model);
            break;
          }
          console.warn('OpenRouter no content:', d.error?.message ?? 'empty');
          lastError = new Error(d.error?.message ?? `${model} returned no content`);
        } catch (err: any) {
          console.warn(`OpenRouter ${model} failed:`, err?.message);
          lastError = err;
        }
      }
    }

    // ── 3. Mistral AI — free tier, no billing (console.mistral.ai) 
    // Free signup, no credit card. MISTRAL_API_KEY in .env.local
    if (!completion && hasMistral) {
      const MISTRAL_MODELS = [
        'mistral-small-latest',
        'open-mistral-nemo',
        'open-mistral-7b',
      ];
      for (const model of MISTRAL_MODELS) {
        try {
          console.log('Trying Mistral:', model);
          const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            },
            body: JSON.stringify({
              model, max_tokens: 8192, temperature: 0.7,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
              ],
            }),
          });
          const d = await r.json();
          if (d.choices?.[0]?.message?.content) {
            completion = { choices: [{ message: { content: d.choices[0].message.content }, finish_reason: 'stop' }] };
            console.log('Mistral success:', model);
            break;
          }
          console.warn('Mistral no content:', d.error?.message ?? 'empty');
          lastError = new Error(d.error?.message ?? `${model} returned no content`);
        } catch (err: any) {
          console.warn(`Mistral ${model} failed:`, err?.message);
          lastError = err;
          if (!isSkippable(err)) throw err;
        }
      }
    }

    // ── 4. Cerebras AI — free tier, no billing (cloud.cerebras.ai) 
    // Free signup with email only, no credit card. Fastest free inference.
    // CEREBRAS_API_KEY in .env.local
    if (!completion && hasCerebras) {
      const CEREBRAS_MODELS = [
        'llama-3.3-70b',
        'llama3.1-70b',
        'llama3.1-8b',
      ];
      for (const model of CEREBRAS_MODELS) {
        try {
          console.log('Trying Cerebras:', model);
          const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
            },
            body: JSON.stringify({
              model, max_tokens: 8192, temperature: 0.7,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
              ],
            }),
          });
          const d = await r.json();
          if (d.choices?.[0]?.message?.content) {
            completion = { choices: [{ message: { content: d.choices[0].message.content }, finish_reason: 'stop' }] };
            console.log('Cerebras success:', model);
            break;
          }
          console.warn('Cerebras no content:', d.error?.message ?? 'empty');
          lastError = new Error(d.error?.message ?? `${model} returned no content`);
        } catch (err: any) {
          console.warn(`Cerebras ${model} failed:`, err?.message);
          lastError = err;
          if (!isSkippable(err)) throw err;
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