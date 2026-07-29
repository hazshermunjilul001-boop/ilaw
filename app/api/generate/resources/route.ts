// app/api/generate/resources/route.ts
// PART C: LEARNING_RESOURCES + OPPORTUNITIES_FOR_INTEGRATION

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { callAI } from '../../../../lib/callAI';
import { isFilipinoPH } from '../../../../lib/language';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      lessonName, learningArea, gradeSection, schoolCity,
      apiKey, apiKey2, geminiKey, openrouterKey,
    } = body;

    const city = schoolCity?.trim() || 'their city';
    const isFilipino = isFilipinoPH(learningArea);

    const lang = isFilipino
      ? 'FILIPINO/TAGALOG ONLY. Write entirely in Filipino.'
      : 'STRICT ENGLISH ONLY. Do NOT translate to Tagalog or Bisaya.';

    const L = isFilipino ? {
      primaryMat: 'Pangunahing Kagamitan', emergency: 'Mga Alternatibo sa Emerhensya',
      otherAreas: 'Iba pang Larangang Pang-aralan', specialTopics: 'Mga Espesyal na Paksa',
      values: 'Integrasyon ng mga Pagpapahalaga', tech: 'Teknolohiya',
    } : {
      primaryMat: 'Primary Materials', emergency: 'Emergency Alternatives',
      otherAreas: 'Other Learning Areas', specialTopics: 'Special Topics / Career Awareness',
      values: 'Values Integration', tech: 'Technology (Future Integration)',
    };

    const systemPrompt = `You are an expert DepEd ILAW lesson plan writer.
• Write in ${lang}
• Use bullet points (•) only — no numbered lists.
• Each section key must be on its OWN line alone.`;

    const prompt = `Write LEARNING_RESOURCES and OPPORTUNITIES_FOR_INTEGRATION for this lesson:

LESSON: ${lessonName} | AREA: ${learningArea} | GRADE: ${gradeSection} | CITY: ${city}

LEARNING_RESOURCES
**${L.primaryMat}:** • List 3 resources with authors, chapters, and page numbers.
**${L.emergency}:** • 3 backup strategies if technology/printing fails.

OPPORTUNITIES_FOR_INTEGRATION
**${L.otherAreas}:** • 2 links to other Grade 10 subjects.
**${L.specialTopics}:** • 2 real ${city} offices/enterprises where these skills are used.
**${L.values}:** • 2 moments where Filipino values are reinforced.
**${L.tech}:** • 2 digital tools with URLs for learning outside class.`;

    const result = await callAI(systemPrompt, prompt, apiKey, 'C-RESOURCES', 1500, apiKey2, geminiKey, openrouterKey);
    
    return NextResponse.json({ content: result });
  } catch (error: any) {
    console.error('RESOURCES ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}