// lib/buildPptx.ts
// Server-side only — renders student-facing PowerPoint from structured AI JSON.
// Color theme: dark green #1B5E20 + gold #F9A825 (matches sample template).

import pptxgen from 'pptxgenjs';

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  darkGreen:  '1B5E20',
  midGreen:   '2E7D32',
  lightGreen: '388E3C',
  paleGreen:  'E8F5E9',
  gold:       'F9A825',
  darkGold:   'F57F17',
  white:      'FFFFFF',
  offWhite:   'F9F9F9',
  darkText:   '1A1A1A',
  mutedText:  '555555',
  cardBorder: 'C8E6C9',
  stepBlue:   '1565C0',
  stepPale:   'E3F2FD',
};

const W          = 10;
const H          = 5.625;
const FONT_HEAD  = 'Trebuchet MS';
const FONT_BODY  = 'Calibri';

// ── Shared helpers ────────────────────────────────────────────────────────────

function trunc(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function addHeader(slide: pptxgen.Slide, title: string, badge = '') {
  slide.addShape('rect', { x: 0, y: 0, w: W, h: 0.72, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 } });
  slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: 0.72, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(title.toUpperCase(), {
    x: 0.28, y: 0, w: badge ? 7.5 : 9.5, h: 0.72,
    fontFace: FONT_HEAD, fontSize: 17, bold: true,
    color: C.white, valign: 'middle', align: 'left',
  });
  if (badge) {
    slide.addShape('rect', { x: 7.8, y: 0.11, w: 2.0, h: 0.5, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
    slide.addText(badge, {
      x: 7.8, y: 0.11, w: 2.0, h: 0.5,
      fontFace: FONT_BODY, fontSize: 11, bold: true,
      color: C.darkGreen, valign: 'middle', align: 'center',
    });
  }
}

function addFooter(slide: pptxgen.Slide, lessonName: string, teacherName: string) {
  slide.addShape('rect', { x: 0, y: H - 0.28, w: W, h: 0.28, fill: { color: C.midGreen }, line: { color: C.midGreen, width: 0 } });
  slide.addText(`${trunc(lessonName, 55)}  ·  ${teacherName}`, {
    x: 0.2, y: H - 0.28, w: W - 0.4, h: 0.28,
    fontFace: FONT_BODY, fontSize: 8.5, color: C.white, valign: 'middle', align: 'left',
  });
}

function addCard(
  slide: pptxgen.Slide,
  x: number, y: number, w: number, h: number,
  header: string, lines: string[],
  accentColor = C.midGreen,
  headerBg = C.darkGreen,
) {
  slide.addShape('rect', { x, y, w, h, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1 },
    shadow: { type: 'outer', color: '000000', opacity: 0.07, blur: 4, offset: 2, angle: 135 } });
  slide.addShape('rect', { x, y, w, h: 0.33, fill: { color: headerBg }, line: { color: headerBg, width: 0 } });
  slide.addShape('rect', { x, y, w: 0.07, h, fill: { color: accentColor }, line: { color: accentColor, width: 0 } });
  slide.addText(header, {
    x: x + 0.12, y, w: w - 0.15, h: 0.33,
    fontFace: FONT_HEAD, fontSize: 10.5, bold: true, color: C.white, valign: 'middle',
  });
  if (lines.length) {
    slide.addText(
      lines.map((l, i) => ({ text: trunc(l, 110), options: { bullet: true, breakLine: i < lines.length - 1, fontSize: 10.5, color: C.darkText, fontFace: FONT_BODY } })),
      { x: x + 0.15, y: y + 0.36, w: w - 0.22, h: h - 0.4, valign: 'top', paraSpaceAfter: 3 }
    );
  }
}

// ── Slide builders ────────────────────────────────────────────────────────────

function addCoverSlide(pres: pptxgen, lessonName: string, teacherName: string, learningArea: string, gradeSection: string, sessionCount: number, lessonHook: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.darkGreen };

  slide.addShape('rect', { x: 0, y: 0,        w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: 0, y: H - 0.2,  w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: 7.8, y: 0.2,    w: 2.2, h: H - 0.4, fill: { color: C.midGreen }, line: { color: C.midGreen, width: 0 } });

  slide.addText('TODAY\'S LESSON', { x: 0.5, y: 0.35, w: 7, h: 0.4, fontFace: FONT_BODY, fontSize: 12, bold: true, color: C.gold, charSpacing: 3 });
  slide.addText(trunc(lessonName, 70), { x: 0.5, y: 0.8, w: 7, h: 2.0, fontFace: FONT_HEAD, fontSize: 34, bold: true, color: C.white, valign: 'middle', wrap: true });
  slide.addShape('rect', { x: 0.5, y: 2.95, w: 6.5, h: 0.05, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });

  // Hook text below divider
  if (lessonHook) {
    slide.addText(`💡 ${trunc(lessonHook, 120)}`, {
      x: 0.5, y: 3.1, w: 7, h: 0.8,
      fontFace: FONT_BODY, fontSize: 13, italic: true, color: C.gold, valign: 'top', wrap: true,
    });
  }

  slide.addText([
    { text: `${learningArea}  ·  ${gradeSection}`, options: { breakLine: true, fontSize: 12, color: C.gold, bold: true } },
    { text: `Teacher: ${teacherName}`, options: { breakLine: true, fontSize: 11, color: C.white } },
    { text: `${sessionCount} Session${sessionCount > 1 ? 's' : ''}`, options: { fontSize: 11, color: C.white } },
  ], { x: 0.5, y: 4.1, w: 7, h: 0.9, fontFace: FONT_BODY, valign: 'top' });

  slide.addText('📚\nLET\'S\nLEARN', { x: 7.9, y: 1.5, w: 2.0, h: 2.5, fontFace: FONT_HEAD, fontSize: 18, bold: true, color: C.gold, align: 'center', valign: 'middle' });
}

function addSessionDivider(pres: pptxgen, sessionNum: number, sessionTitle: string, lessonName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.midGreen };
  slide.addShape('rect', { x: 0, y: 0, w: 0.28, h: H, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: W - 0.28, y: 0, w: 0.28, h: H, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(`SESSION ${sessionNum}`, { x: 0.5, y: 0.9, w: W - 1, h: 0.9, fontFace: FONT_HEAD, fontSize: 44, bold: true, charSpacing: 8, color: C.gold, align: 'center' });
  slide.addText(trunc(sessionTitle, 80), { x: 0.5, y: 2.0, w: W - 1, h: 1.1, fontFace: FONT_HEAD, fontSize: 24, color: C.white, align: 'center', valign: 'middle', wrap: true });
  slide.addShape('rect', { x: 2.5, y: 3.25, w: 5, h: 0.05, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(trunc(lessonName, 55), { x: 0.5, y: 3.4, w: W - 1, h: 0.4, fontFace: FONT_BODY, fontSize: 12, italic: true, color: C.white, align: 'center' });
}

function addWarmUpSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `Warm-Up: ${s.warmUpTitle}`, `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Task instruction box
  slide.addShape('rect', { x: 0.3, y: 0.88, w: 9.4, h: 0.85, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1 } });
  slide.addText(`📋  ${trunc(s.warmUpTask, 160)}`, {
    x: 0.5, y: 0.88, w: 9.1, h: 0.85,
    fontFace: FONT_BODY, fontSize: 13, color: C.darkGreen, valign: 'middle', bold: true, wrap: true,
  });

  // Question box
  slide.addShape('rect', { x: 0.3, y: 1.88, w: 9.4, h: 1.5, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1 },
    shadow: { type: 'outer', color: '000000', opacity: 0.07, blur: 4, offset: 2, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 1.88, w: 9.4, h: 0.35, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 } });
  slide.addText('❓ THINK ABOUT THIS:', { x: 0.5, y: 1.88, w: 9.1, h: 0.35, fontFace: FONT_HEAD, fontSize: 11, bold: true, color: C.gold, valign: 'middle' });
  slide.addText(trunc(s.warmUpQuestion, 180), {
    x: 0.5, y: 2.28, w: 9.0, h: 1.05,
    fontFace: FONT_BODY, fontSize: 14, color: C.darkText, valign: 'middle', wrap: true, italic: true,
  });

  // Answer space indicator
  slide.addShape('rect', { x: 0.3, y: 3.5, w: 9.4, h: 1.7, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1, dashType: 'dash' } });
  slide.addText('✏️  Write your answer here...', {
    x: 0.5, y: 3.5, w: 9.0, h: 1.7,
    fontFace: FONT_BODY, fontSize: 13, color: '#BDBDBD', valign: 'middle', italic: true,
  });
}

function addObjectivesSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'By the End of Today...', `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  slide.addText('🎯  Learning Goals', {
    x: 0.3, y: 0.82, w: 9.4, h: 0.38,
    fontFace: FONT_HEAD, fontSize: 14, bold: true, color: C.midGreen,
  });

  const objectives: string[] = s.objectives || [];
  objectives.forEach((obj: string, i: number) => {
    const y = 1.28 + i * 1.12;
    slide.addShape('rect', { x: 0.3, y, w: 9.4, h: 0.95,
      fill: { color: i % 2 === 0 ? C.paleGreen : C.offWhite },
      line: { color: C.cardBorder, width: 1 },
      shadow: { type: 'outer', color: '000000', opacity: 0.06, blur: 3, offset: 1, angle: 135 },
    });
    slide.addShape('rect', { x: 0.3, y, w: 0.55, h: 0.95, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 } });
    slide.addText(`${i + 1}`, { x: 0.3, y, w: 0.55, h: 0.95, fontFace: FONT_HEAD, fontSize: 20, bold: true, color: C.gold, align: 'center', valign: 'middle' });
    slide.addText(trunc(obj, 150), { x: 0.95, y: y + 0.07, w: 8.6, h: 0.82, fontFace: FONT_BODY, fontSize: 13, color: C.darkText, valign: 'middle', wrap: true });
  });
}

function addConceptSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, s.conceptTitle || 'Key Concept', `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Definition box
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 1.55, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 3, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 0.12, h: 1.55, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText('DEFINITION', { x: 0.55, y: 0.88, w: 3, h: 0.32, fontFace: FONT_BODY, fontSize: 10, bold: true, color: C.gold, charSpacing: 2 });
  slide.addText(trunc(s.conceptDefinition || '', 220), {
    x: 0.55, y: 1.22, w: 9.0, h: 1.1,
    fontFace: FONT_BODY, fontSize: 14, color: C.white, valign: 'top', wrap: true, italic: true,
  });

  // Key points
  const points: string[] = s.conceptKeyPoints || [];
  slide.addText('📌  KEY POINTS TO REMEMBER:', {
    x: 0.3, y: 2.55, w: 9.4, h: 0.35,
    fontFace: FONT_HEAD, fontSize: 11, bold: true, color: C.midGreen,
  });

  points.forEach((pt: string, i: number) => {
    const y = 2.95 + i * 0.72;
    const dotColor = [C.darkGreen, C.gold, C.lightGreen][i % 3];
    slide.addShape('ellipse', { x: 0.3, y: y + 0.18, w: 0.28, h: 0.28, fill: { color: dotColor }, line: { color: dotColor, width: 0 } });
    slide.addText(trunc(pt, 130), {
      x: 0.7, y, w: 9.0, h: 0.68,
      fontFace: FONT_BODY, fontSize: 13, color: C.darkText, valign: 'middle', wrap: true,
    });
  });
}

function addExampleSlide(pres: pptxgen, ex: any, exNum: number, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `Example ${exNum}: ${trunc(ex.title || '', 45)}`, `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Problem statement
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 0.82,
    fill: { color: C.stepPale }, line: { color: C.stepBlue, width: 1 } });
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 1.1, h: 0.82, fill: { color: C.stepBlue }, line: { color: C.stepBlue, width: 0 } });
  slide.addText('GIVEN', { x: 0.3, y: 0.85, w: 1.1, h: 0.82, fontFace: FONT_BODY, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle' });
  slide.addText(trunc(ex.problem || '', 160), {
    x: 1.5, y: 0.9, w: 8.1, h: 0.72,
    fontFace: FONT_BODY, fontSize: 13, bold: true, color: C.stepBlue, valign: 'middle', wrap: true,
  });

  // Steps
  const steps: string[] = ex.steps || [];
  slide.addText('SOLUTION:', {
    x: 0.3, y: 1.78, w: 3, h: 0.3,
    fontFace: FONT_HEAD, fontSize: 11, bold: true, color: C.midGreen,
  });

  const stepH = Math.min(0.75, (3.45 / Math.max(steps.length, 1)));
  steps.forEach((step: string, i: number) => {
    const y = 2.12 + i * (stepH + 0.05);
    const rowBg = i % 2 === 0 ? C.paleGreen : C.offWhite;
    slide.addShape('rect', { x: 0.3, y, w: 9.4, h: stepH,
      fill: { color: rowBg }, line: { color: C.cardBorder, width: 0.5 } });
    slide.addShape('rect', { x: 0.3, y, w: 0.5, h: stepH, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 } });
    slide.addText(`${i + 1}`, { x: 0.3, y, w: 0.5, h: stepH, fontFace: FONT_BODY, fontSize: 11, bold: true, color: C.gold, align: 'center', valign: 'middle' });
    slide.addText(trunc(step, 140), {
      x: 0.88, y: y + 0.04, w: 8.7, h: stepH - 0.08,
      fontFace: FONT_BODY, fontSize: 12, color: C.darkText, valign: 'middle', wrap: true,
    });
  });
}

function addTryItSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '✏️  Your Turn!', `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Main problem
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 2.1, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.1, blur: 5, offset: 2, angle: 135 } });
  slide.addText('SOLVE THIS:', { x: 0.55, y: 0.9, w: 4, h: 0.35, fontFace: FONT_BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2 });
  slide.addText(trunc(s.tryItProblem || '', 200), {
    x: 0.55, y: 1.28, w: 9.0, h: 1.55,
    fontFace: FONT_BODY, fontSize: 15, bold: true, color: C.white, valign: 'top', wrap: true,
  });

  // Hint
  if (s.tryItHint) {
    slide.addShape('rect', { x: 0.3, y: 3.1, w: 9.4, h: 0.72, fill: { color: '#FFF8E1' }, line: { color: C.gold, width: 1 } });
    slide.addText(`💡  Hint: ${trunc(s.tryItHint, 130)}`, {
      x: 0.5, y: 3.1, w: 9.1, h: 0.72,
      fontFace: FONT_BODY, fontSize: 12, color: '#5D4037', valign: 'middle', italic: true, wrap: true,
    });
  }

  // Work space
  slide.addShape('rect', { x: 0.3, y: 3.95, w: 9.4, h: 1.33, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1, dashType: 'dash' } });
  slide.addText('Show your solution here:', {
    x: 0.5, y: 3.95, w: 9.0, h: 1.33,
    fontFace: FONT_BODY, fontSize: 12, color: '#BDBDBD', italic: true, valign: 'middle',
  });
}

function addDiscussionSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '💬  Let\'s Discuss', `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  slide.addText('Share your thoughts with the class:', {
    x: 0.3, y: 0.85, w: 9.4, h: 0.38,
    fontFace: FONT_BODY, fontSize: 13, italic: true, color: C.mutedText,
  });

  const questions: string[] = s.discussionQuestions || [];
  const qColors = [C.darkGreen, C.midGreen, C.lightGreen];
  questions.forEach((q: string, i: number) => {
    const y = 1.3 + i * 1.25;
    slide.addShape('rect', { x: 0.3, y, w: 9.4, h: 1.1,
      fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1 },
      shadow: { type: 'outer', color: '000000', opacity: 0.06, blur: 3, offset: 1, angle: 135 } });
    slide.addShape('rect', { x: 0.3, y, w: 0.7, h: 1.1, fill: { color: qColors[i % 3] }, line: { color: qColors[i % 3], width: 0 } });
    slide.addText(`Q${i + 1}`, { x: 0.3, y, w: 0.7, h: 1.1, fontFace: FONT_HEAD, fontSize: 16, bold: true, color: C.gold, align: 'center', valign: 'middle' });
    slide.addText(trunc(q, 160), {
      x: 1.1, y: y + 0.1, w: 8.5, h: 0.9,
      fontFace: FONT_BODY, fontSize: 13, color: C.darkText, valign: 'middle', wrap: true,
    });
  });
}

function addActivitySlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `⚡  Activity: ${trunc(s.activity?.title || 'Class Activity', 40)}`, `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Instruction banner
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 0.7, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1 } });
  slide.addText(`📋  ${trunc(s.activity?.instruction || '', 170)}`, {
    x: 0.5, y: 0.85, w: 9.1, h: 0.7,
    fontFace: FONT_BODY, fontSize: 12.5, color: C.darkGreen, valign: 'middle', bold: true, wrap: true,
  });

  // 3-track cards
  const tracks = [
    { label: 'Track A', sub: 'For Everyone', task: s.activity?.taskA || '', color: C.darkGreen, icon: '🌍' },
    { label: 'Track B', sub: 'Need More Help?', task: s.activity?.taskB || '', color: C.midGreen, icon: '🤝' },
    { label: 'Track C', sub: 'Challenge!', task: s.activity?.taskC || '', color: C.gold, icon: '🚀' },
  ];

  const cardW = 2.95;
  const positions = [0.25, 3.52, 6.79];
  tracks.forEach((track, i) => {
    const x = positions[i];
    const y = 1.7;
    const h = 3.55;
    const hdrColor = track.color;
    const txtColor = i === 2 ? C.darkGreen : C.white;

    slide.addShape('rect', { x, y, w: cardW, h, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1 },
      shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 4, offset: 2, angle: 135 } });
    slide.addShape('rect', { x, y, w: cardW, h: 0.75, fill: { color: hdrColor }, line: { color: hdrColor, width: 0 } });
    slide.addText(`${track.icon} ${track.label}`, {
      x: x + 0.08, y, w: cardW - 0.1, h: 0.42,
      fontFace: FONT_HEAD, fontSize: 13, bold: true, color: txtColor, valign: 'middle',
    });
    slide.addText(track.sub, {
      x: x + 0.08, y: y + 0.42, w: cardW - 0.1, h: 0.33,
      fontFace: FONT_BODY, fontSize: 9.5, italic: true, color: i === 2 ? C.darkGreen : '#C8E6C9', valign: 'middle',
    });
    slide.addText(trunc(track.task, 160), {
      x: x + 0.1, y: y + 0.82, w: cardW - 0.2, h: h - 0.92,
      fontFace: FONT_BODY, fontSize: 11.5, color: C.darkText, valign: 'top', wrap: true, paraSpaceAfter: 4,
    });
  });
}

function addExitTicketSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '🎯  Exit Ticket', `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Before you go instruction
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 0.6, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1 } });
  slide.addText('Before you leave, answer this on a piece of paper and pass it to your teacher.', {
    x: 0.5, y: 0.85, w: 9.1, h: 0.6,
    fontFace: FONT_BODY, fontSize: 12, color: C.darkGreen, valign: 'middle', italic: true,
  });

  // Big question box
  slide.addShape('rect', { x: 0.3, y: 1.6, w: 9.4, h: 2.3, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 3, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 1.6, w: 9.4, h: 0.4, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText('ANSWER THIS:', {
    x: 0.5, y: 1.6, w: 9.1, h: 0.4,
    fontFace: FONT_HEAD, fontSize: 13, bold: true, color: C.darkGreen, valign: 'middle', charSpacing: 2,
  });
  slide.addText(trunc(s.exitTicket || '', 200), {
    x: 0.55, y: 2.08, w: 9.0, h: 1.75,
    fontFace: FONT_BODY, fontSize: 15, bold: true, color: C.white, valign: 'middle', wrap: true,
  });

  // Answer lines
  slide.addShape('rect', { x: 0.3, y: 4.0, w: 9.4, h: 1.27, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1, dashType: 'dash' } });
  slide.addText('My Answer:', {
    x: 0.5, y: 4.0, w: 3, h: 0.35,
    fontFace: FONT_BODY, fontSize: 11, bold: true, color: C.mutedText,
  });
  // Ruled lines
  for (let i = 0; i < 2; i++) {
    slide.addShape('rect', { x: 0.5, y: 4.42 + i * 0.38, w: 9.0, h: 0.02, fill: { color: C.cardBorder }, line: { color: C.cardBorder, width: 0 } });
  }
}

function addRealLifeSlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `🌏  ${trunc(s.realLifeTitle || 'Real-Life Connection', 45)}`, `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  // Fact box (left)
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 5.6, h: 4.42, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.1, blur: 5, offset: 2, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 5.6, h: 0.38, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText('DID YOU KNOW?', { x: 0.45, y: 0.85, w: 5.3, h: 0.38, fontFace: FONT_HEAD, fontSize: 12, bold: true, color: C.darkGreen, valign: 'middle', charSpacing: 2 });
  slide.addText(trunc(s.realLifeFact || '', 280), {
    x: 0.45, y: 1.28, w: 5.3, h: 3.85,
    fontFace: FONT_BODY, fontSize: 13.5, color: C.white, valign: 'top', wrap: true, paraSpaceAfter: 5,
  });

  // Question box (right)
  slide.addShape('rect', { x: 6.15, y: 0.85, w: 3.55, h: 4.42, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1 } });
  slide.addShape('rect', { x: 6.15, y: 0.85, w: 3.55, h: 0.38, fill: { color: C.midGreen }, line: { color: C.midGreen, width: 0 } });
  slide.addText('THINK:', { x: 6.28, y: 0.85, w: 3.3, h: 0.38, fontFace: FONT_HEAD, fontSize: 12, bold: true, color: C.white, valign: 'middle' });
  slide.addText(trunc(s.realLifeQuestion || '', 140), {
    x: 6.28, y: 1.3, w: 3.3, h: 2.5,
    fontFace: FONT_BODY, fontSize: 13, color: C.darkText, valign: 'top', wrap: true, italic: true,
  });
  slide.addShape('rect', { x: 6.28, y: 3.9, w: 3.3, h: 1.0, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1, dashType: 'dash' } });
  slide.addText('My answer:', { x: 6.38, y: 3.92, w: 3.1, h: 0.3, fontFace: FONT_BODY, fontSize: 10, color: C.mutedText });
}

function addSummarySlide(pres: pptxgen, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '📝  What We Learned Today', `Session ${sNum}`);
  addFooter(slide, lessonName, teacherName);

  slide.addText('Great job today! Here are the key takeaways:', {
    x: 0.3, y: 0.85, w: 9.4, h: 0.38,
    fontFace: FONT_BODY, fontSize: 13, italic: true, color: C.mutedText,
  });

  const points: string[] = s.summaryPoints || [];
  const ptColors = [C.darkGreen, C.midGreen, C.lightGreen];
  points.forEach((pt: string, i: number) => {
    const y = 1.35 + i * 1.2;
    slide.addShape('rect', { x: 0.3, y, w: 9.4, h: 1.0,
      fill: { color: i % 2 === 0 ? C.paleGreen : C.offWhite },
      line: { color: C.cardBorder, width: 1 },
      shadow: { type: 'outer', color: '000000', opacity: 0.06, blur: 3, offset: 1, angle: 135 } });
    slide.addShape('rect', { x: 0.3, y, w: 0.55, h: 1.0, fill: { color: ptColors[i % 3] }, line: { color: ptColors[i % 3], width: 0 } });
    slide.addText('✓', { x: 0.3, y, w: 0.55, h: 1.0, fontFace: FONT_HEAD, fontSize: 20, bold: true, color: C.gold, align: 'center', valign: 'middle' });
    slide.addText(trunc(pt, 160), {
      x: 0.95, y: y + 0.1, w: 8.6, h: 0.82,
      fontFace: FONT_BODY, fontSize: 13.5, color: C.darkText, valign: 'middle', wrap: true,
    });
  });
}

function addClosingSlide(pres: pptxgen, lessonName: string, teacherName: string, sessionCount: number) {
  const slide = pres.addSlide();
  slide.background = { color: C.darkGreen };
  slide.addShape('rect', { x: 0, y: 0,       w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: 0, y: H - 0.2, w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText('🎉  Well Done!', { x: 0.5, y: 0.8, w: W - 1, h: 0.9, fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.gold, align: 'center' });
  slide.addText('You have completed all sessions for:', { x: 0.5, y: 1.75, w: W - 1, h: 0.45, fontFace: FONT_BODY, fontSize: 14, color: C.white, align: 'center', italic: true });
  slide.addText(trunc(lessonName, 80), { x: 0.5, y: 2.25, w: W - 1, h: 0.8, fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.white, align: 'center', wrap: true });
  slide.addShape('rect', { x: 3, y: 3.15, w: 4, h: 0.05, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(`${sessionCount} Session${sessionCount > 1 ? 's' : ''}  ·  Teacher: ${teacherName}`, {
    x: 0.5, y: 3.28, w: W - 1, h: 0.4, fontFace: FONT_BODY, fontSize: 13, color: C.white, align: 'center',
  });
  slide.addText('Keep learning. Keep growing. 💚', {
    x: 0.5, y: 4.8, w: W - 1, h: 0.35, fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.gold, align: 'center',
  });
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
// slideData: the parsed JSON from the AI transformation in /api/ppt/route.ts

export async function buildPptxBuffer(
  slideData: any,
  teacherName: string,
  lessonName:  string,
  learningArea = '',
  gradeSection = '',
  sessionCount = 3,
): Promise<Uint8Array> {

  const pres = new pptxgen();
  pres.layout  = 'LAYOUT_16x9';
  pres.author  = teacherName;
  pres.title   = lessonName;
  pres.subject = 'ILAW Lesson Plan Student Presentation';

  const sessions: any[] = slideData.sessions || [];
  const lessonHook: string = slideData.lessonHook || '';

  // ── Slide 1: Cover ──
  addCoverSlide(pres, lessonName, teacherName, learningArea, gradeSection, sessionCount, lessonHook);

  // ── Per-session slides (12 slides per session: 1 divider + 11 content) ──
  for (let i = 0; i < sessionCount; i++) {
    const s   = sessions[i] || {};
    const num = i + 1;

    addSessionDivider(pres, num, s.sessionTitle || `Session ${num}`, lessonName);  // 1
    addObjectivesSlide(pres, s, num, lessonName, teacherName);                      // 2
    addWarmUpSlide(pres, s, num, lessonName, teacherName);                          // 3
    addConceptSlide(pres, s, num, lessonName, teacherName);                         // 4
    addExampleSlide(pres, s.example1 || {}, 1, num, lessonName, teacherName);       // 5
    addExampleSlide(pres, s.example2 || {}, 2, num, lessonName, teacherName);       // 6
    addTryItSlide(pres, s, num, lessonName, teacherName);                           // 7
    addDiscussionSlide(pres, s, num, lessonName, teacherName);                      // 8
    addActivitySlide(pres, s, num, lessonName, teacherName);                        // 9
    addExitTicketSlide(pres, s, num, lessonName, teacherName);                      // 10
    addRealLifeSlide(pres, s, num, lessonName, teacherName);                        // 11
    addSummarySlide(pres, s, num, lessonName, teacherName);                         // 12
  }

  // ── Final closing slide ──
  addClosingSlide(pres, lessonName, teacherName, sessionCount);

  const buf = await pres.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
  return new Uint8Array(buf);
}