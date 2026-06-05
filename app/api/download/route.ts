// app/api/download/route.ts
// Runs on the server only — buildDocx uses the `docx` Node.js package
// which cannot run in the browser. page.tsx fetches this endpoint and
// receives a .docx binary blob to trigger the browser download.

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildDocxBuffer } from '../../../lib/buildDocx';

export async function POST(req: Request) {
  try {
    const { content, teacherName, lessonName, learningArea, gradeSection, sessions } =
      await req.json();

    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    const buffer = await buildDocxBuffer(content, teacherName, lessonName, learningArea, gradeSection, sessions);

    const safeName = lessonName
      ? lessonName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
      : 'ILAW_Lesson_Plan';

    // Convert Buffer to Uint8Array — Vercel's strict TypeScript rejects Buffer
    // as a Response BodyInit directly, but Uint8Array is always accepted.
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('DOWNLOAD ROUTE ERROR:', error?.message);
    return NextResponse.json({ error: error?.message || 'Failed to generate DOCX' }, { status: 500 });
  }
}