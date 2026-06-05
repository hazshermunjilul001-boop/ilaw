export const maxDuration = 120;
export const dynamic = 'force-dynamic';

import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

// Groq key pool — add GROQ_API_KEY_2 and GROQ_API_KEY_3 to .env.local
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter((k): k is string => !!k);

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

    const hasGroq       = GROQ_KEYS.length > 0;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasMistral    = !!process.env.MISTRAL_API_KEY;
    const hasCerebras   = !!process.env.CEREBRAS_API_KEY;

    if (!hasGroq && !hasOpenRouter && !hasMistral && !hasCerebras) {
      return NextResponse.json(
        { error: 'No API key found. Add GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, or CEREBRAS_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
    console.log('Language mode:', isFilipino ? 'FILIPINO' : 'ENGLISH', '| City:', city);

    // ── Labels ────────────────────────────────────────────────────────────────
    // FIX #2: Removed cognitive/psychomotor/affective (old DLP domain) labels.
    // These are replaced by plain objective writing per DO 016 s.2026 Section 7(a)(ii).
    const L = isFilipino ? {
      strengths:     'Mga Kalakasan at Nakaraang Kaalaman',
      interests:     'Mga Interes at Pakikipag-ugnayan',
      barriers:      'Mga Hadlang sa Pagkatuto',
      support:       'Mga Angkop na Tulong at Suporta',
      materials:     'Mga Kagamitan',
      procedure:     'Mga Hakbang',
      purpose:       'Layunin ng Aktibidad',
      warmup:        'Halimbawa ng tanong para sa warm-up',
      objLink:       'Kaugnay na Layunin',
      teacherScript: 'Mga tagubilin para sa guro',
      studentActions:'Mga aksyon ng mag-aaral at inaasahang tugon',
      examples:      'Mga halimbawang kontekstwalisado',
      diffLabel:     'Mga Naka-differentiate na Tagubilin',
      forAll:        'Para sa Lahat ng Mag-aaral',
      forSupport:    'Para sa Mga Nangangailangan ng Tulong',
      forAdvanced:   'Para sa mga Advanced na Mag-aaral (Pagpapayaman)',
      forRemediation:'Para sa Mga Nangangailangan ng Remedyasyon',
      guiding:       'Mga Gabay na Tanong',
      closing:       'Pangwakas na talakayan',
      exit:          'Exit Ticket',
      realLife:      'Koneksyon sa tunay na buhay',
      session:       'SESYON',
      synthesis:     'Buod at Repleksyon',
      primaryMat:    'Pangunahing Kagamitan',
      refMat:        'Mga Sanggunian',
      emergency:     'Mga Alternatibo sa Emerhensya',
      otherAreas:    'Iba pang Larangang Pang-aralan',
      specialTopics: 'Mga Espesyal na Paksa / Kamalayan sa Karera',
      values:        'Integrasyon ng mga Pagpapahalaga',
      tech:          'Teknolohiya (Hinaharap na Integrasyon)',
      descLabel:     'Paglalarawan',
      sampleTasks:   'Halimbawa ng mga tanong o gawain',
      admin:         'Paraan ng pagbibigay',
      howUsed:       'Paano gagamitin ang mga resulta',
      rubric:        'Rubrika o gabay sa pagmamarka',
      accom:         "Mga angkop na tulong para sa iba't ibang mag-aaral",
    } : {
      strengths:     'Strengths and Prior Knowledge',
      interests:     'Interests and Engagement Hooks',
      barriers:      'Possible Barriers to Learning',
      support:       'Accommodations and Support',
      materials:     'Materials',
      procedure:     'Procedure',
      purpose:       'Purpose',
      warmup:        'Sample warm-up question',
      objLink:       'Objective Link',
      teacherScript: 'Teacher instructions (script)',
      studentActions:'Student actions and expected responses',
      examples:      `Contextualized examples using ${city} landmarks`,
      diffLabel:     'Differentiated Instructions',
      forAll:        'For All Learners',
      forSupport:    'For Learners Who Need Support',
      forAdvanced:   'For Advanced Learners (Enrichment)',
      forRemediation: 'For Learners Who Need Reinforcement (Remediation)',
      guiding:       'Guiding Questions',
      closing:       'Closing discussion',
      exit:          'Exit ticket',
      realLife:      'Real-life connection',
      session:       'SESSION',
      synthesis:     'Synthesis and Reflection',
      primaryMat:    'Primary Materials',
      refMat:        'Reference Materials',
      emergency:     'Emergency Alternatives',
      otherAreas:    'Other Learning Areas',
      specialTopics: 'Special Topics / Career Awareness',
      values:        'Values Integration',
      tech:          'Technology (Future Integration)',
      descLabel:     'Description',
      sampleTasks:   'Sample tasks or questions',
      admin:         'Administration',
      howUsed:       'How results are used',
      rubric:        'Rubric or scoring guide',
      accom:         'Accommodation for diverse learners',
    };

    const lang = isFilipino
      ? 'FILIPINO/TAGALOG. Lahat ng salita, subheading, at paliwanag ay sa Filipino. Bawal ang Ingles maliban sa ALL CAPS section keys at teknikal na termino.'
      : 'ENGLISH only. No Filipino/Tagalog words anywhere except ALL CAPS section keys.';

    const noProjector = !classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv');
    const aiNote = isFilipino
      ? '3-4 pangungusap sa FILIPINO tungkol sa paggamit ng AI, pagsusuri ng guro, at pagsunod sa DO 3 s.2026 Annex A.'
      : '3-4 sentences about AI assistance, teacher review, and DO 3 s.2026 Annex A compliance.';

    // Shared lesson header for every prompt
    const lessonHeader = `LESSON: ${lessonName} | AREA: ${learningArea} | TEACHER: ${teacherName}
GRADE: ${gradeSection} | SESSIONS: ${sessions} | CITY: ${city}
COMPETENCY: ${competency}
CLASSROOM: ${classroomDetails}
${noProjector ? 'NOTE: NO projector or TV — use board, chalk, cartolina, flashcards only.' : ''}`;

    // ── System prompt (shared by all 4 calls) ─────────────────────────────────
    const systemPrompt = `You are an expert DepEd Philippines ILAW lesson plan writer. Always follow these rules:
• Write in ${lang}
• Use bullet points (•) only — absolutely no numbered lists anywhere.
• Every teacher instruction must be a word-for-word script — never write "discuss", "explain", or "ask students about X" as placeholders.
• Every example must name a real, specific place, price, or event from ${city} — never generic.
• Label every Bloom's question: [KNOWLEDGE] [COMPREHENSION] [APPLICATION] [ANALYSIS] [EVALUATION].
• A substitute teacher with no subject knowledge must be able to run every session using only this document.
• CRITICAL: Write the section for EVERY session — never skip, merge, or abbreviate any session.
• CRITICAL FORMAT RULE: Every ALL-CAPS section key (e.g. REFERENCES, FLOW, PRE_LESSON) must appear on its OWN line, alone, with nothing else on that line. Never put a section key and content on the same line. Do not append a trailing colon directly to the ALL-CAPS key line.`;

    // ── CALL A: Header sections (References → Learner Context) ────────────────
    // FIX #2: Learning objectives no longer use Cognitive/Psychomotor/Affective format.
    // Per DO 016 s.2026 Section 7(a)(ii): objectives unpack, cluster, or sequence
    // competencies into clear, focused, manageable learning objectives — plain statements only.
    const promptA = `Write SECTION A of an ILAW lesson plan. Output ONLY these 5 sections in order, fully written, no placeholders.
Each section key must be on its OWN line alone — never inline with content. Do not append a colon to the main section key lines.

${lessonHeader}

REFERENCES
Write 4-6 real DepEd references — full author, year, title, publisher, ISBN where available, page numbers, MELC code.

DECLARATION_AI
${aiNote}

LEARNING_COMPETENCY
Full MELC text and code. Content Standard. Performance Standard.

LEARNING_OBJECTIVES
Write separately for EVERY session listed in SESSIONS above.
Format per session:
**${L.session} N — "Title" (duration):**
• [Clear, focused learning objective — a plain statement of what learners will be able to do, using an action verb. One per bullet. Do NOT label as Cognitive, Psychomotor, or Affective.]
• [Second objective if needed]
• [Third objective if needed]

LEARNER_CONTEXT
**${L.strengths}:** • 4 specific bullets on what this class already knows relevant to ${lessonName}
**${L.interests}:** • 4 bullets tied to real ${city} youth culture, landmarks, or events
**${L.barriers}:** • 5 specific learning barriers this topic typically causes
**${L.support}:** • 5 concrete strategies, one matched to each barrier above`;

    // ── CALL B: PRE_LESSON for all sessions ───────────────────────────────────
    const promptB = `Write SECTION B of an ILAW lesson plan. Output ONLY the PRE_LESSON section, fully written for EVERY session. Never skip any session.
The section key PRE_LESSON must be on its OWN line alone. Do not append a colon to the main section key line.

${lessonHeader}

PRE_LESSON
Write a complete entry for EVERY session listed in SESSIONS above. Use this exact structure for each:

**${L.session} N — "Warm-Up Activity Title" (time)**
**${L.materials}:** • list every physical item needed (paper, markers, calculator, specific handout, etc.)
**${L.procedure}:**
• [Word-for-word teacher line 1] → Expected student response
• [Word-for-word teacher line 2] → Expected student response
• [Word-for-word teacher line 3] → Expected student response
• [Word-for-word teacher line 4] → Expected student response
• [Word-for-word teacher line 5] → Expected student response
**${L.purpose}:** One sentence: what prior knowledge this activates and why it matters for today's session.
**${L.warmup}:** Write the full question using a specific ${city} place, person, or event. Then write the expected complete student answer.`;

    // ── CALL C: FLOW + LEARNING_RESOURCES + OPPORTUNITIES_FOR_INTEGRATION ─────
    // FIX #3: Removed the rigid 3-part structure mandate. The FLOW is now shaped by
    // the Learning Design Principles from DO 016 s.2026 Annex B — the AI decides the
    // instructional sequence based on the content and context, not a fixed template.
    const promptC = `Write SECTION C of an ILAW lesson plan. Output ONLY these 3 sections in order, fully written. Never skip any session.
Each section key must be on its OWN line alone — never inline with content. Do not append a colon to the main section key lines.

${lessonHeader}

FLOW
Write the complete lesson flow for EVERY session listed in SESSIONS above. For each session, design a coherent instructional sequence guided by these Learning Design Principles (DO 016 s.2026 Annex B):
• Clear Goals — learners know the purpose of each activity
• Scaffolding — new concepts build on prior knowledge with appropriate support
• Active Learning — learners do something meaningful with the content
• Checks for Understanding — teacher assesses learner progress mid-session
• Differentiation — different access points for diverse learners
• Connection to Real Life — content linked to ${city} contexts, events, or careers

NOT all principles need to appear in every activity. Shape the flow based on what the lesson content and learners actually need. You decide the structure — you may use phases, named activities, or a continuous narrative. What matters is clarity and completeness for a substitute teacher.

For EACH session write:
**${L.session} N — "Session Title" (total duration)**

Name and describe each activity or phase with:
**${L.teacherScript}:** Word-for-word teacher lines. Include real ${city} examples with specific names, places, or amounts. Include board instructions where needed.
**${L.studentActions}:** What students write, say, calculate, or produce at each stage.
**${L.examples}:**
• Example 1: Fully worked problem using a real ${city} street, institution, or price — show complete solution.
• Example 2: Fully worked problem using a different real ${city} context — show complete solution.
**${L.diffLabel}:**
• **${L.forAll}:** Exact universal instruction for all students.
• **${L.forSupport}:** Specific scaffold explicitly tied to this task (e.g., structured breakdown, graphic template).
• **${L.forAdvanced}:** Genuine higher-order challenge using complex variables or localized optimization.
**${L.guiding}:**
• [KNOWLEDGE] Full question
• [COMPREHENSION] Full question
• [APPLICATION] Full question
• [ANALYSIS] Full question
• [EVALUATION] Full question
**${L.synthesis}:**
• **${L.closing}:** Write 3 full discussion questions with expected student responses.
• **${L.exit}:** Write the exact exit ticket question + scoring guide (complete vs incomplete).
• **${L.realLife}:** 2-3 sentences connecting this lesson to something real and current in ${city}.

LEARNING_RESOURCES
**${L.primaryMat}:** • List 3 distinct resources (e.g., DepEd Learner's Materials, Teacher's Guides, or official worktexts) detailing authors, specific module chapters, and exact page numbers relative to ${learningArea}.
**${L.emergency}:** • Provide 3 comprehensive backup strategies (e.g., direct chalkboard structural modeling, peer paired card structures, localized concrete visual manipulatives) to run the exact activities listed above if all technology or printed resources fail.

OPPORTUNITIES_FOR_INTEGRATION
**${L.otherAreas}:** • Provide 2 explicit subject-to-subject links showing how ${lessonName} shares underlying conceptual mechanics with other Grade 10 subjects (e.g., Physics vector mechanics, Araling Panlipunan zoning layouts, or MAPEH composition patterns).
**${L.specialTopics}:** • Connect this specific topic to 2 real public offices, agencies, or commercial enterprises operating in ${city} where local professionals rely on these exact skills daily.
**${L.values}:** • Identify 2 explicit moments in this lesson flow where Filipino core values (e.g., Maka-Diyos, Makatao, Makakalikasan, Makabansa) are actively reinforced through teamwork, data integrity, or precise problem solving.
**${L.tech}:** • Detail 2 accessible digital tool solutions or online platforms (e.g., GeoGebra, Desmos, or specialized educational web apps) complete with absolute URLs that can enhance learning outside of regular classroom hours.`;

    // ── CALL D: Assessment + Extended Learning + Reflections ─────────────────
    // FIX #1: WAYS_FORWARD renamed to EXTENDED_LEARNING so the tag name matches the
    // content purpose and aligns with the buildDocx.ts canonical key.
    // FIX #4: REFLECTIONS section removed from the AI prompt since buildDocx.ts
    // generates blank per-session reflection templates from session count.
    // Removing it here prevents unused AI output and saves tokens.
    const promptD = `Write SECTION D of an ILAW lesson plan. Output ONLY these 2 sections in order, fully written. Never skip any session.
Each section key must be on its OWN line alone — never inline with content. Do not append a colon to the main section key lines.

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
**${L.howUsed}:** Scores 1-2: [exact teacher remedial/scaffold intervention action]. Scores 3-4: [exact enrichment or extension action].
**${L.rubric}:**
• 4 — [Full mastery: specific, measurable, and observable mathematical accuracy and conceptual behavior]
• 3 — [Proficiency: what they can do with minor calculation or step errors]
• 2 — [Developing: what partial concept understanding looks like with structural support]
• 1 — [Beginning: what a non-understanding or fundamentally flawed response looks like]
**${L.accom}:**
• For reading difficulty: [specific localized structural support or visual scaffolding strategy]
• For absent students: [specific actionable makeup path or modular self-paced task option]
• For early finishers: [specific challenging task or context optimization extension]

EXTENDED_LEARNING
**${L.forAll}:** • Provide 2 clear tasks deeply rooted in the daily lifestyle, household situations, or neighborhood environments of ${city} to apply this concept.
**${L.forRemediation}:** • Provide 2 structured, step-by-step reinforcement review exercises designed to isolate and break down core conceptual bottlenecks.
**${L.forAdvanced}:** • Provide 2 high-level creative synthesis tasks targeting real audiences, community contributions, or functional designs inside ${city}.`;

    // ── isSkippable: which errors allow fallback to next provider ─────────────
    const isSkippable = (err: any, msg = err?.message ?? '') =>
      err?.status === 429 || err?.status === 413 ||
      msg.includes('429') || msg.includes('413') ||
      msg.includes('rate_limit') || msg.includes('Request too large') ||
      msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') ||
      msg.includes('limit: 0') || msg.includes('model_not_found') ||
      msg.includes('does not exist') || msg.includes('decommissioned');

    // ── callAI: tries all providers in order, returns text or throws ──────────
    async function callAI(userPrompt: string, callLabel: string): Promise<string> {
      let result: string | null = null;
      let callError: any = null;

      // Groq
      if (!result && hasGroq) {
        const PREFERRED = [
          'meta-llama/llama-4-scout-17b-16e-instruct',
          'llama-3.3-70b-versatile',
          'llama-3.1-70b-versatile',
          'compound-beta',
        ];
        let GROQ_MODELS: string[] = PREFERRED;
        try {
          const r = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${GROQ_KEYS[0]}` },
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
          }
        } catch { console.warn(`[${callLabel}] Groq model list fetch failed, using defaults`); }

        outerGroq:
        for (const apiKey of GROQ_KEYS) {
          const groqClient = new Groq({ apiKey });
          for (const model of GROQ_MODELS) {
            try {
              console.log(`[${callLabel}] Groq key ...${apiKey.slice(-4)} | model: ${model}`);
              const c = await groqClient.chat.completions.create({
                model, max_tokens: 8192, temperature: 0.7,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
              });
              const text = c.choices[0]?.message?.content ?? '';
              if (text) {
                console.log(`[${callLabel}] Groq success: ${model} | finish: ${c.choices[0].finish_reason} | chars: ${text.length}`);
                result = text;
                break outerGroq;
              }
            } catch (err: any) {
              console.warn(`[${callLabel}] Groq key ...${apiKey.slice(-4)} | ${model} failed:`, err?.message);
              callError = err;
              if (!isSkippable(err)) throw err;
            }
          }
          console.log(`[${callLabel}] Groq key ...${apiKey.slice(-4)} exhausted, trying next key...`);
        }
      }

      // ── Helper: call any OpenAI-compatible REST endpoint ───────────────────
      // Logs the failure reason clearly and returns null on any error so the
      // next provider is always attempted rather than silently skipping.
      async function tryProvider(
        label: string,
        url: string,
        authHeader: string,
        model: string,
        extraHeaders: Record<string, string> = {},
      ): Promise<string | null> {
        try {
          console.log(`[${callLabel}] Trying ${label} (${model})...`);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              ...extraHeaders,
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.7,
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.warn(`[${callLabel}] ${label} returned ${response.status}: ${errText.slice(0, 200)}`);
            return null;
          }

          const data = await response.json();
          const text: string = data.choices?.[0]?.message?.content ?? '';
          if (!text) {
            console.warn(`[${callLabel}] ${label} returned empty content`);
            return null;
          }
          console.log(`[${callLabel}] ${label} success! Chars: ${text.length}`);
          return text;
        } catch (err: any) {
          console.error(`[${callLabel}] ${label} exception: ${err?.message}`);
          return null;
        }
      }

      // OpenRouter — try multiple models in order so if one is rate-limited
      // the next one is attempted automatically.
      if (!result && hasOpenRouter) {
        const orModels = [
          'google/gemini-2.5-flash',
          'google/gemini-2.5-pro',
          'meta-llama/llama-3.3-70b-instruct',
          'mistralai/mistral-large',
        ];
        for (const model of orModels) {
          const text = await tryProvider(
            `OpenRouter/${model}`,
            'https://openrouter.ai/api/v1/chat/completions',
            `Bearer ${process.env.OPENROUTER_API_KEY}`,
            model,
            { 'HTTP-Referer': 'https://ilaw.vercel.app', 'X-Title': 'ILAW Lesson Plan Generator' },
          );
          if (text) { result = text; break; }
        }
      }

      // Mistral — try both large and smaller model as fallback
      if (!result && hasMistral) {
        const mistralModels = ['mistral-large-latest', 'mistral-small-latest'];
        for (const model of mistralModels) {
          const text = await tryProvider(
            `Mistral/${model}`,
            'https://api.mistral.ai/v1/chat/completions',
            `Bearer ${process.env.MISTRAL_API_KEY}`,
            model,
          );
          if (text) { result = text; break; }
        }
      }

      // Cerebras — try both available models
      if (!result && hasCerebras) {
        const cerebrasModels = ['llama-3.3-70b', 'llama3.3-70b'];
        for (const model of cerebrasModels) {
          const text = await tryProvider(
            `Cerebras/${model}`,
            'https://api.cerebras.ai/v1/chat/completions',
            `Bearer ${process.env.CEREBRAS_API_KEY}`,
            model,
          );
          if (text) { result = text; break; }
        }
      }

      if (!result) {
        const wait = callError?.message?.match(/try again in (.+?)\./)?.[1];
        throw new Error(
          wait
            ? `All models rate limited on ${callLabel}. Try again in ${wait}.`
            : `All models currently unavailable on ${callLabel}. Please try again in a few minutes.`
        );
      }
      return result;
    }

    // ── callAIWithRetry: wraps callAI with one automatic retry after a delay ──
    // When all providers are rate-limited simultaneously, a short wait is usually
    // enough for at least one provider's window to reset. The retry runs silently
    // so the user just sees a longer loading time instead of an error.
    async function callAIWithRetry(
      userPrompt: string,
      callLabel: string,
      retryDelayMs = 20000,   // 20 seconds — keeps total under Vercel's 60s free-plan limit
      maxRetries = 2,
    ): Promise<string> {
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await callAI(userPrompt, callLabel);
        } catch (err: any) {
          lastError = err;
          const isRateLimit =
            err?.message?.includes('rate limit') ||
            err?.message?.includes('rate_limit') ||
            err?.message?.includes('Try again in') ||
            err?.message?.includes('currently unavailable');

          if (isRateLimit && attempt < maxRetries) {
            // Parse the suggested wait time from the error message if available,
            // but cap it at 60s so we don't block the serverless function too long.
            const waitMatch = err?.message?.match(/(\d+)m(\d+(?:\.\d+)?)?s?/);
            const waitMs = waitMatch
              ? Math.min((parseInt(waitMatch[1]) * 60 + parseFloat(waitMatch[2] ?? '0')) * 1000, 60000)
              : retryDelayMs;

            console.warn(`[${callLabel}] All providers rate-limited. Retrying in ${Math.round(waitMs / 1000)}s... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          } else {
            throw err;
          }
        }
      }
      throw lastError ?? new Error(`All retries exhausted for ${callLabel}`);
    }

    // ── Run all 4 calls in PARALLEL ───────────────────────────────────────────
    console.log('Starting 4 parallel calls: A(Header) B(PreLesson) C(Flow+Resources+Integration) D(Assessment+ExtendedLearning)');
    const [partA, partB, partC, partD] = await Promise.all([
      callAIWithRetry(promptA, 'A-HEADER'),
      callAIWithRetry(promptB, 'B-PRELESSON'),
      callAIWithRetry(promptC, 'C-FLOW'),
      callAIWithRetry(promptD, 'D-ASSESSMENT'),
    ]);

    console.log(`A: ${partA.length} | B: ${partB.length} | C: ${partC.length} | D: ${partD.length}`);
    const combinedContent = [partA, partB, partC, partD].join('\n\n');
    console.log('Total content length:', combinedContent.length);

    // ── Normalize AI output so section keys are always clean standalone lines ──
    // Mistral and OpenRouter sometimes wrap keys with --- separators, ## headers,
    // bold markers (**KEY**), or inline colons. This strip pass ensures the
    // buildDocx parser can find every section key reliably regardless of provider.
    const ALL_SECTION_KEYS = [
      'REFERENCES', 'DECLARATION_AI', 'LEARNING_COMPETENCY', 'LEARNING_OBJECTIVES',
      'LEARNER_CONTEXT', 'PRE_LESSON', 'FLOW', 'LEARNING_RESOURCES',
      'OPPORTUNITIES_FOR_INTEGRATION', 'FORMATIVE_ASSESSMENT', 'EXTENDED_LEARNING',
      'WAYS_FORWARD', 'REFLECTIONS',
    ];

    function normalizeContent(raw: string): string {
      let text = raw;

      // 1. Remove horizontal rule lines (--- or *** or ===) that Mistral adds between sections
      text = text.replace(/^[-*=]{3,}\s*$/gm, '');

      // 2. Strip markdown heading markers from section keys: ## FLOW → FLOW
      text = text.replace(/^#{1,4}\s+([\w_]+)/gm, '$1');

      // 3. Strip bold markers from standalone section keys: **FLOW** → FLOW
      //    Only when the key is the only content on the line
      text = text.replace(/^\*{1,2}([A-Z][A-Z_]{3,})\*{1,2}\s*:?\s*$/gm, '$1');

      // 4. Remove trailing colon from a standalone ALL-CAPS key line: "FLOW:" → "FLOW"
      //    (only when the key is alone on the line — colon is fine inside content lines)
      for (const key of ALL_SECTION_KEYS) {
        // Matches the key optionally surrounded by ** and/or followed by :
        const pattern = new RegExp(`^\\*{0,2}${key}\\*{0,2}:?\\s*$`, 'gm');
        text = text.replace(pattern, key);
      }

      // 5. If a key appears inline at start of a line followed by content on same line,
      //    split it onto its own line: "FLOW\nsome content" is already fine;
      //    "FLOW: some content" → "FLOW\nsome content"
      for (const key of ALL_SECTION_KEYS) {
        const pattern = new RegExp(`^(${key}):\\s+(?=\\S)`, 'gm');
        text = text.replace(pattern, '$1\n');
      }

      // 6. Handle title-cased variants Mistral uses for these two long keys
      //    e.g. "Learning Resources:" → "LEARNING_RESOURCES"
      //    e.g. "Opportunities for Integration and Contextualization:" → "OPPORTUNITIES_FOR_INTEGRATION"
      text = text.replace(
        /^\*{0,2}Learning Resources\*{0,2}:?\s*$/gim,
        'LEARNING_RESOURCES'
      );
      text = text.replace(
        /^\*{0,2}Opportunities for [Ii]ntegration(?: and [Cc]ontextualization)?\*{0,2}:?\s*$/gim,
        'OPPORTUNITIES_FOR_INTEGRATION'
      );

      // 7. Collapse runs of 3+ blank lines down to 2
      text = text.replace(/\n{3,}/g, '\n\n');

      return text;
    }

    const content = normalizeContent(combinedContent);
    console.log('Normalized content length:', content.length);

    // ── Debug: log which sections were found after normalization ─────────────
    // FIX #1: WAYS_FORWARD replaced by EXTENDED_LEARNING in tag list.
    // FIX #4: REFLECTIONS removed from expected tag list (generated by buildDocx, not AI).
    const ALL_TAGS = [
      'REFERENCES', 'DECLARATION_AI', 'LEARNING_COMPETENCY', 'LEARNING_OBJECTIVES',
      'LEARNER_CONTEXT', 'PRE_LESSON', 'FLOW', 'LEARNING_RESOURCES',
      'OPPORTUNITIES_FOR_INTEGRATION', 'FORMATIVE_ASSESSMENT', 'EXTENDED_LEARNING',
    ];

    // Check for tags both with and without colons since our regex parser catches both variations
    const foundTags = ALL_TAGS.filter(tag => content.includes(`${tag}:`) || content.includes(`${tag}\n`));
    const missingTags = ALL_TAGS.filter(tag => !content.includes(`${tag}:`) && !content.includes(`${tag}\n`));

    console.log('Sections FOUND:', foundTags.join(', '));
    if (missingTags.length > 0) console.warn('Sections MISSING:', missingTags.join(', '));

    return NextResponse.json({ content });

  } catch (error: any) {
    console.error('ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown server error' }, { status: 500 });
  }
}