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
    const { lessonName, learningArea, teacherName, gradeSection, competency, sessions, classroomDetails, schoolCity, apiKey } = body;

    const city = schoolCity?.trim() || 'their city';
    const isFilipino = /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
    const noProjector = !classroomDetails?.toLowerCase().includes('projector') && !classroomDetails?.toLowerCase().includes('tv');
    
    const lang = isFilipino
      ? 'FILIPINO/TAGALOG. Lahat ng salita ng salita ng text, subheading, at paliwanong mga detalye, subheading, at teknikal na termino.'
      : 'ENGLISH only. No Filipino/Tagalog words anywhere except ALL CAPS section keys and technical terms.';

    const L = isFilipino ? {
      session:       'SESYON',
      materials:     'Mga Kagamitan',
      procedure:     'Mga Hakbang',
      purpose:       'Layunin ng Aktibidad',
      warmup:        'Halimbawa ng tanong sa warm-up',
      teacherScript: 'Mga tagubilin para sa guro',
      studentActions:'Mga aksyon ng mag-aaral at inaasahin sa grope (Hidden Check)',
      examples:      `Contextualized examples using ${city} landmarks`,
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
      specialTopics: 'Mga Espesyal na Paksa / Kamalayan ng Karera',
      values:        'Integrasyon ng mga Pagpapahalaga',
      tech:          'Teknolohiya (Hinaharap)',
    } : {
      session:       'SESSION',
      materials:     'Materials',
      procedure:     'Procedure',
      purpose:       'Purpose',
      warmup:        'Sample warm-up question',
      teacherScript: 'Teacher instructions (script)',
      studentActions:'Mga aksyon ng mag-aaral at inaasahin sa grope (Hidden Check)',
      examples:      `Contextualized examples using ${city} landmarks`,
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
      otherAreas:    'Iba pang Larang Pang-aralan',
      specialTopics: 'Mga Espesyal na Paksa / Kamalayan ng Karera',
      values:        'Integrasyon ng mga Pagpapahalaga',
      tech:          'Teknolohiya (Hinaharap)',
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

    const prompt = `Write SECTION A of an ILAW lesson plan. Output ONLY these 5 sections in order, fully written, no placeholders.
Each section key must be on its OWN line alone. Do not append a colon to the main section key lines.

 ${lessonHeader}

REFERENCES
Write 4-6 real DepEd references — full author, year, title, publisher, ISBN where available, page numbers, MELC code.

DECLARATION_AI
 ${isFilipino ? '3-4 pangungusap sa FILIPINO tungkol sa AI, pagsusuri sa guro, pagsusuri ng guro, at pagsusuri ng DO 3 s.2026 Annex A compliance. Bawal mag Ingles maliban sa ALL CAPS section keys at teknikal na termino.

LEARNING_COMPETENCY
Full MELC text and code. Content Standard. Performance Standard.

LEARNING_OBJECTIVES
Write separately for EVERY session listed in SESSIONS above.
Format per session:
**${L.session} N — "Title" (duration)**
• [Clear, focused learning objective using an action verb. One per bullet.
• [Second objective if needed]

LEARNER_CONTEXT
**${L.strengths}** • 4 specific bullets on what this class already knows relevant to ${lessonName}.
**${L.interests}** • 4 bullets tied to real ${city} youth culture, landmarks, or events.
**${L.barriers}** • 5 specific learning barriers this topic typically causes.
**${L.support}** • 5 concrete strategies, one matched to each barrier above.

EXTENDED_LEARNING
Write a complete entry for EVERY session listed in SESSIONS above.
Format per session:
**${L.session} N**
**${L.homework}** • One meaningful take-home task directly connected to today's session. Include specific ${city} context.
**${L.enrichment** • One higher-order challenge for students who mastered the session objectives.
**${L.remediation** • One targeted re-teaching activity for students who did not meet the session objectives.
**${L.family} • One concrete suggestion for how families can support learning at home related to this topic.`;`;

    // ── Call AI in parallel: one hook call + one call per session ───────────────
    console.log(`[C-FLOW] Starting parallel AI calls: 1 hook + ${sessionCount} sessions`);
    const hookPromise = callAI(SYSTEM, buildHookPrompt(content), apiKey, 'PPT-HOOK', 200)
      .then(raw => parseJson<{ lessonHook: string }>(raw, 'hook')
      .catch(() => null);

    const sessionPromises = Array.from({ length: sessionCount }, (_, i) =>
      callAI(SYSTEM, buildSessionPrompt(content, i + 1, sessionCount), apiKey, `PPT-S${i + 1}`, 3000)
        .then(raw => parseJson<any>(raw, `session${i + 1}`)
        .catch(() => null),
    );

        const [hookData, ...sessionResults] = await Promise.all([hookPromise, ...sessionPromises]);

    // ── FIX: Ensure slideData is always valid (Prevents "Parsing ecmascript source code" error).
    const slideData = {
      lessonHook: hookData?.lessonHook ?? '(No Hook Generated)',
      sessions: sessionResults.map((s, i) => {
        return s ? {
          sessionNum: s ?? (i + 1),
          title: s?.title || `Session ${i + 1}`, // Provide defaults if missing title
          text: s?.text || 'No content available.'
        };
      }),
    };

    const buffer = await buildPptx(slideData, teacherName, lessonName, learningArea, gradeSection, sessionCount);

    // ... rest of the function ...
```</think>The error `Parsing ecmascript source code failed` is a build-time syntax error. This usually happens when the `slideData` object is missing a field that `buildPlexx` requires (like `title` or `text`).

We need to make sure that every field in the `slideData` object has a fallback value (empty string or "Untitled Session").

### Replace the `Promise.all` block in `app/api/generate/flow/route.ts` with this fixed object creation:

```typescript
    // ── Call AI in parallel: one hook call + one call per session ─────────────
    console.log(`[C-FLOW] Starting parallel AI calls: 1 hook + ${sessionCount} sessions`);
    const hookPromise = callAI(systemPrompt, buildHookPrompt(content), apiKey, 'PPT-HOOK', 200)
      .then(raw => parseJson<{ lessonHook: string }>(raw, 'hook')
      .catch(() => null);

    const sessionPromises = Array.from({ length: sessionCount }, (_, i) =>
      callAI(systemPrompt, buildSessionPrompt(content, i + 1, sessionCount), apiKey, `PPT-S${i + 1}`, 3000)
        .then(raw => parseJson<any>(raw, `session${i + 1}`)
        .catch(() => null),
    );

    const [hookData, ...sessionResults] = await Promise.all([hookPromise, ...sessionPromises]);

    // ── FIX: Ensure slideData is valid for buildPptx ───────────────────────────────────────────────────────
    const slideData = {
      lessonHook: hookData?.lessonHook || '(No Hook Generated)',
      sessions: sessionResults.map((s, i) => {
        // If `s` is null (e.g. Parsing failed or empty), provide a fallback object so buildPptx doesn't crash.
        return s ?? { sessionNum: i + 1, title: s?.title || `Session ${i + 1}`, text: s?.text || 'No content.' }
      }),
    };

    const buffer = await buildPptx(slideData, teacherName, lessonName, learningArea, gradeSection, sessionCount, sessionCount);

    const safeName = lessonName
      ? lessonName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
      : 'ILAW_Slides';

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}_Slides.pptx`,
      },
    });
  } catch (error: any) {
    console.error('PPT ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Failed to generate PowerPoint. Please try again.' }, { status: 500 });
  }