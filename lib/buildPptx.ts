// lib/buildPptx.ts
// Server-side only — renders student-facing PowerPoint from structured AI JSON.
// Color theme: dark green #1B5E20 + gold #F9A825 (matches sample template).

import pptxgen from 'pptxgenjs';
import { isFilipinoPH } from './language';

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

// ── Slide text labels (English / Filipino) ──────────────────────────────────
// FIX: this file previously had every label hardcoded in English regardless
// of subject — learningArea was only used to *display* the subject name, never
// to choose label language. That meant a VE/ESP/AP/Filipino lesson whose DOCX
// correctly generated in Filipino would still get an all-English deck. This
// mirrors the ENGLISH_LABELS/FILIPINO_LABELS pattern in buildDocx.ts and
// reuses the same Filipino terminology already used there (e.g. "Sesyon",
// "Bago ang Aralin") so a teacher sees consistent wording across both files.

const ENGLISH_LABELS = {
  todaysLesson:      "TODAY'S LESSON",
  teacherPrefix:      'Teacher: ',
  sessionWord:        'Session',
  cornerBadge:        "📚\nLET'S\nLEARN",
  byEndOfToday:       'By the End of Today...',
  learningGoals:      '🎯  Learning Goals',
  warmUpPrefix:       'Warm-Up: ',
  thinkAboutThis:     '❓ THINK ABOUT THIS:',
  writeAnswerHere:    '✏️  Write your answer here...',
  keyConceptDefault:  'Key Concept',
  definition:         'DEFINITION',
  keyPoints:          '📌  KEY POINTS TO REMEMBER:',
  examplePrefix:      'Example ',
  given:              'GIVEN',
  solution:           'SOLUTION:',
  yourTurn:           '✏️  Your Turn!',
  solveThis:          'SOLVE THIS:',
  hintPrefix:         '💡  Hint: ',
  showSolutionHere:   'Show your solution here:',
  letsDiscuss:        "💬  Let's Discuss",
  shareThoughts:      'Share your thoughts with the class:',
  activityPrefix:     '⚡  Activity: ',
  classActivityDefault: 'Class Activity',
  trackALabel:        'Track A', trackASub: 'For Everyone',
  trackBLabel:        'Track B', trackBSub: 'Need More Help?',
  trackCLabel:        'Track C', trackCSub: 'Challenge!',
  exitTicket:         '🎯  Exit Ticket',
  beforeYouLeave:     'Before you leave, answer this on a piece of paper and pass it to your teacher.',
  answerThis:         'ANSWER THIS:',
  myAnswer:           'My Answer:',
  realLifeDefault:    'Real-Life Connection',
  didYouKnow:         'DID YOU KNOW?',
  think:              'THINK:',
  myAnswerLower:      'My answer:',
  whatWeLearned:      '📝  What We Learned Today',
  greatJob:           'Great job today! Here are the key takeaways:',
  wellDone:           '🎉  Well Done!',
  completedAllSessions: 'You have completed all sessions for:',
  keepLearning:       'Keep learning. Keep growing. 💚',
  isFilipino:         false,
};

const FILIPINO_LABELS: typeof ENGLISH_LABELS = {
  todaysLesson:      'ARALIN NGAYON',
  teacherPrefix:      'Guro: ',
  sessionWord:        'Sesyon',
  cornerBadge:        '📚\nMAG-ARAL\nTAYO',
  byEndOfToday:       'Sa Pagtatapos ng Araw na Ito...',
  learningGoals:      '🎯  Mga Layunin sa Pagkatuto',
  warmUpPrefix:       'Pasiglahan: ',
  thinkAboutThis:     '❓ PAG-ISIPAN ITO:',
  writeAnswerHere:    '✏️  Isulat ang iyong sagot dito...',
  keyConceptDefault:  'Pangunahing Konsepto',
  definition:         'KAHULUGAN',
  keyPoints:          '📌  MGA MAHALAGANG PUNTO NA DAPAT TANDAAN:',
  examplePrefix:      'Halimbawa ',
  given:              'IBINIGAY',
  solution:           'SOLUSYON:',
  yourTurn:           '✏️  Ikaw Naman!',
  solveThis:          'SAGUTIN ITO:',
  hintPrefix:         '💡  Pahiwatig: ',
  showSolutionHere:   'Ipakita ang iyong solusyon dito:',
  letsDiscuss:        '💬  Pag-usapan Natin',
  shareThoughts:      'Ibahagi ang iyong opinyon sa klase:',
  activityPrefix:     '⚡  Gawain: ',
  classActivityDefault: 'Gawaing Pangklase',
  trackALabel:        'Track A', trackASub: 'Para sa Lahat',
  trackBLabel:        'Track B', trackBSub: 'Kailangan ng Tulong?',
  trackCLabel:        'Track C', trackCSub: 'Hamon!',
  exitTicket:         '🎯  Exit Ticket', // kept as-is: standard DepEd pedagogical term, commonly left untranslated
  beforeYouLeave:     'Bago ka umalis, sagutin ito sa isang papel at ipasa sa iyong guro.',
  answerThis:         'SAGUTIN ITO:',
  myAnswer:           'Aking Sagot:',
  realLifeDefault:    'Koneksyon sa Tunay na Buhay',
  didYouKnow:         'ALAM MO BA?',
  think:              'PAG-ISIPAN:',
  myAnswerLower:      'Aking sagot:',
  whatWeLearned:      '📝  Ang Natutunan Natin Ngayon',
  greatJob:           'Magaling! Narito ang mga mahalagang aral:',
  wellDone:           '🎉  Magaling!',
  completedAllSessions: 'Natapos mo na ang lahat ng sesyon para sa:',
  keepLearning:       'Ipagpatuloy ang pag-aaral. Ipagpatuloy ang paglago. 💚',
  isFilipino:         true,
};

type PptxLabels = typeof ENGLISH_LABELS;

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

// ── Slide builders ────────────────────────────────────────────────────────────
// Every builder that shows static (non-AI-generated) text now takes `L` —
// the active label set — instead of hardcoding English strings.

function addCoverSlide(pres: pptxgen, L: PptxLabels, lessonName: string, teacherName: string, learningArea: string, gradeSection: string, sessionCount: number, lessonHook: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.darkGreen };

  slide.addShape('rect', { x: 0, y: 0,        w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: 0, y: H - 0.2,  w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: 7.8, y: 0.2,    w: 2.2, h: H - 0.4, fill: { color: C.midGreen }, line: { color: C.midGreen, width: 0 } });

  slide.addText(L.todaysLesson, { x: 0.5, y: 0.35, w: 7, h: 0.4, fontFace: FONT_BODY, fontSize: 12, bold: true, color: C.gold, charSpacing: 3 });
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
    { text: `${L.teacherPrefix}${teacherName}`, options: { breakLine: true, fontSize: 11, color: C.white } },
    { text: `${sessionCount} ${L.sessionWord}${sessionCount > 1 && !L.isFilipino ? 's' : ''}`, options: { fontSize: 11, color: C.white } },
  ], { x: 0.5, y: 4.1, w: 7, h: 0.9, fontFace: FONT_BODY, valign: 'top' });

  slide.addText(L.cornerBadge, { x: 7.9, y: 1.5, w: 2.0, h: 2.5, fontFace: FONT_HEAD, fontSize: 18, bold: true, color: C.gold, align: 'center', valign: 'middle' });
}

function addSessionDivider(pres: pptxgen, L: PptxLabels, sessionNum: number, sessionTitle: string, lessonName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.midGreen };
  slide.addShape('rect', { x: 0, y: 0, w: 0.28, h: H, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: W - 0.28, y: 0, w: 0.28, h: H, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(`${L.sessionWord.toUpperCase()} ${sessionNum}`, { x: 0.5, y: 0.9, w: W - 1, h: 0.9, fontFace: FONT_HEAD, fontSize: 44, bold: true, charSpacing: 8, color: C.gold, align: 'center' });
  slide.addText(trunc(sessionTitle, 80), { x: 0.5, y: 2.0, w: W - 1, h: 1.1, fontFace: FONT_HEAD, fontSize: 24, color: C.white, align: 'center', valign: 'middle', wrap: true });
  slide.addShape('rect', { x: 2.5, y: 3.25, w: 5, h: 0.05, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(trunc(lessonName, 55), { x: 0.5, y: 3.4, w: W - 1, h: 0.4, fontFace: FONT_BODY, fontSize: 12, italic: true, color: C.white, align: 'center' });
}

function sessionBadge(L: PptxLabels, sNum: number): string {
  return `${L.sessionWord} ${sNum}`;
}

function addWarmUpSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `${L.warmUpPrefix}${s.warmUpTitle}`, sessionBadge(L, sNum));
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
  slide.addText(L.thinkAboutThis, { x: 0.5, y: 1.88, w: 9.1, h: 0.35, fontFace: FONT_HEAD, fontSize: 11, bold: true, color: C.gold, valign: 'middle' });
  slide.addText(trunc(s.warmUpQuestion, 180), {
    x: 0.5, y: 2.28, w: 9.0, h: 1.05,
    fontFace: FONT_BODY, fontSize: 14, color: C.darkText, valign: 'middle', wrap: true, italic: true,
  });

  // Answer space indicator
  slide.addShape('rect', { x: 0.3, y: 3.5, w: 9.4, h: 1.7, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1, dashType: 'dash' } });
  slide.addText(L.writeAnswerHere, {
    x: 0.5, y: 3.5, w: 9.0, h: 1.7,
    fontFace: FONT_BODY, fontSize: 13, color: '#BDBDBD', valign: 'middle', italic: true,
  });
}

function addObjectivesSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, L.byEndOfToday, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  slide.addText(L.learningGoals, {
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

function addConceptSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, s.conceptTitle || L.keyConceptDefault, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  // Definition box
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 1.55, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 3, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 0.12, h: 1.55, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(L.definition, { x: 0.55, y: 0.88, w: 3, h: 0.32, fontFace: FONT_BODY, fontSize: 10, bold: true, color: C.gold, charSpacing: 2 });
  slide.addText(trunc(s.conceptDefinition || '', 220), {
    x: 0.55, y: 1.22, w: 9.0, h: 1.1,
    fontFace: FONT_BODY, fontSize: 14, color: C.white, valign: 'top', wrap: true, italic: true,
  });

  // Key points
  const points: string[] = s.conceptKeyPoints || [];
  slide.addText(L.keyPoints, {
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

function addExampleSlide(pres: pptxgen, L: PptxLabels, ex: any, exNum: number, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `${L.examplePrefix}${exNum}: ${trunc(ex.title || '', 45)}`, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  // Problem statement
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 0.82,
    fill: { color: C.stepPale }, line: { color: C.stepBlue, width: 1 } });
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 1.1, h: 0.82, fill: { color: C.stepBlue }, line: { color: C.stepBlue, width: 0 } });
  slide.addText(L.given, { x: 0.3, y: 0.85, w: 1.1, h: 0.82, fontFace: FONT_BODY, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle' });
  slide.addText(trunc(ex.problem || '', 160), {
    x: 1.5, y: 0.9, w: 8.1, h: 0.72,
    fontFace: FONT_BODY, fontSize: 13, bold: true, color: C.stepBlue, valign: 'middle', wrap: true,
  });

  // Steps
  const steps: string[] = ex.steps || [];
  slide.addText(L.solution, {
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

function addTryItSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, L.yourTurn, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  // Main problem
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 2.1, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.1, blur: 5, offset: 2, angle: 135 } });
  slide.addText(L.solveThis, { x: 0.55, y: 0.9, w: 4, h: 0.35, fontFace: FONT_BODY, fontSize: 11, bold: true, color: C.gold, charSpacing: 2 });
  slide.addText(trunc(s.tryItProblem || '', 200), {
    x: 0.55, y: 1.28, w: 9.0, h: 1.55,
    fontFace: FONT_BODY, fontSize: 15, bold: true, color: C.white, valign: 'top', wrap: true,
  });

  // Hint
  if (s.tryItHint) {
    slide.addShape('rect', { x: 0.3, y: 3.1, w: 9.4, h: 0.72, fill: { color: '#FFF8E1' }, line: { color: C.gold, width: 1 } });
    slide.addText(`${L.hintPrefix}${trunc(s.tryItHint, 130)}`, {
      x: 0.5, y: 3.1, w: 9.1, h: 0.72,
      fontFace: FONT_BODY, fontSize: 12, color: '#5D4037', valign: 'middle', italic: true, wrap: true,
    });
  }

  // Work space
  slide.addShape('rect', { x: 0.3, y: 3.95, w: 9.4, h: 1.33, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1, dashType: 'dash' } });
  slide.addText(L.showSolutionHere, {
    x: 0.5, y: 3.95, w: 9.0, h: 1.33,
    fontFace: FONT_BODY, fontSize: 12, color: '#BDBDBD', italic: true, valign: 'middle',
  });
}

function addDiscussionSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, L.letsDiscuss, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  slide.addText(L.shareThoughts, {
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

function addActivitySlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `${L.activityPrefix}${trunc(s.activity?.title || L.classActivityDefault, 40)}`, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  // Instruction banner
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 0.7, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1 } });
  slide.addText(`📋  ${trunc(s.activity?.instruction || '', 170)}`, {
    x: 0.5, y: 0.85, w: 9.1, h: 0.7,
    fontFace: FONT_BODY, fontSize: 12.5, color: C.darkGreen, valign: 'middle', bold: true, wrap: true,
  });

  // 3-track cards
  const tracks = [
    { label: L.trackALabel, sub: L.trackASub, task: s.activity?.taskA || '', color: C.darkGreen, icon: '🌍' },
    { label: L.trackBLabel, sub: L.trackBSub, task: s.activity?.taskB || '', color: C.midGreen, icon: '🤝' },
    { label: L.trackCLabel, sub: L.trackCSub, task: s.activity?.taskC || '', color: C.gold, icon: '🚀' },
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

function addExitTicketSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, L.exitTicket, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  // Before you go instruction
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 9.4, h: 0.6, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1 } });
  slide.addText(L.beforeYouLeave, {
    x: 0.5, y: 0.85, w: 9.1, h: 0.6,
    fontFace: FONT_BODY, fontSize: 12, color: C.darkGreen, valign: 'middle', italic: true,
  });

  // Big question box
  slide.addShape('rect', { x: 0.3, y: 1.6, w: 9.4, h: 2.3, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 3, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 1.6, w: 9.4, h: 0.4, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(L.answerThis, {
    x: 0.5, y: 1.6, w: 9.1, h: 0.4,
    fontFace: FONT_HEAD, fontSize: 13, bold: true, color: C.darkGreen, valign: 'middle', charSpacing: 2,
  });
  slide.addText(trunc(s.exitTicket || '', 200), {
    x: 0.55, y: 2.08, w: 9.0, h: 1.75,
    fontFace: FONT_BODY, fontSize: 15, bold: true, color: C.white, valign: 'middle', wrap: true,
  });

  // Answer lines
  slide.addShape('rect', { x: 0.3, y: 4.0, w: 9.4, h: 1.27, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1, dashType: 'dash' } });
  slide.addText(L.myAnswer, {
    x: 0.5, y: 4.0, w: 3, h: 0.35,
    fontFace: FONT_BODY, fontSize: 11, bold: true, color: C.mutedText,
  });
  // Ruled lines
  for (let i = 0; i < 2; i++) {
    slide.addShape('rect', { x: 0.5, y: 4.42 + i * 0.38, w: 9.0, h: 0.02, fill: { color: C.cardBorder }, line: { color: C.cardBorder, width: 0 } });
  }
}

function addRealLifeSlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, `🌏  ${trunc(s.realLifeTitle || L.realLifeDefault, 45)}`, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  // Fact box (left)
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 5.6, h: 4.42, fill: { color: C.darkGreen }, line: { color: C.darkGreen, width: 0 },
    shadow: { type: 'outer', color: '000000', opacity: 0.1, blur: 5, offset: 2, angle: 135 } });
  slide.addShape('rect', { x: 0.3, y: 0.85, w: 5.6, h: 0.38, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(L.didYouKnow, { x: 0.45, y: 0.85, w: 5.3, h: 0.38, fontFace: FONT_HEAD, fontSize: 12, bold: true, color: C.darkGreen, valign: 'middle', charSpacing: 2 });
  slide.addText(trunc(s.realLifeFact || '', 280), {
    x: 0.45, y: 1.28, w: 5.3, h: 3.85,
    fontFace: FONT_BODY, fontSize: 13.5, color: C.white, valign: 'top', wrap: true, paraSpaceAfter: 5,
  });

  // Question box (right)
  slide.addShape('rect', { x: 6.15, y: 0.85, w: 3.55, h: 4.42, fill: { color: C.offWhite }, line: { color: C.cardBorder, width: 1 } });
  slide.addShape('rect', { x: 6.15, y: 0.85, w: 3.55, h: 0.38, fill: { color: C.midGreen }, line: { color: C.midGreen, width: 0 } });
  slide.addText(L.think, { x: 6.28, y: 0.85, w: 3.3, h: 0.38, fontFace: FONT_HEAD, fontSize: 12, bold: true, color: C.white, valign: 'middle' });
  slide.addText(trunc(s.realLifeQuestion || '', 140), {
    x: 6.28, y: 1.3, w: 3.3, h: 2.5,
    fontFace: FONT_BODY, fontSize: 13, color: C.darkText, valign: 'top', wrap: true, italic: true,
  });
  slide.addShape('rect', { x: 6.28, y: 3.9, w: 3.3, h: 1.0, fill: { color: C.paleGreen }, line: { color: C.lightGreen, width: 1, dashType: 'dash' } });
  slide.addText(L.myAnswerLower, { x: 6.38, y: 3.92, w: 3.1, h: 0.3, fontFace: FONT_BODY, fontSize: 10, color: C.mutedText });
}

function addSummarySlide(pres: pptxgen, L: PptxLabels, s: any, sNum: number, lessonName: string, teacherName: string) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, L.whatWeLearned, sessionBadge(L, sNum));
  addFooter(slide, lessonName, teacherName);

  slide.addText(L.greatJob, {
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

function addClosingSlide(pres: pptxgen, L: PptxLabels, lessonName: string, teacherName: string, sessionCount: number) {
  const slide = pres.addSlide();
  slide.background = { color: C.darkGreen };
  slide.addShape('rect', { x: 0, y: 0,       w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addShape('rect', { x: 0, y: H - 0.2, w: W, h: 0.2,  fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(L.wellDone, { x: 0.5, y: 0.8, w: W - 1, h: 0.9, fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.gold, align: 'center' });
  slide.addText(L.completedAllSessions, { x: 0.5, y: 1.75, w: W - 1, h: 0.45, fontFace: FONT_BODY, fontSize: 14, color: C.white, align: 'center', italic: true });
  slide.addText(trunc(lessonName, 80), { x: 0.5, y: 2.25, w: W - 1, h: 0.8, fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.white, align: 'center', wrap: true });
  slide.addShape('rect', { x: 3, y: 3.15, w: 4, h: 0.05, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  slide.addText(`${sessionCount} ${L.sessionWord}${sessionCount > 1 && !L.isFilipino ? 's' : ''}  ·  ${L.teacherPrefix}${teacherName}`, {
    x: 0.5, y: 3.28, w: W - 1, h: 0.4, fontFace: FONT_BODY, fontSize: 13, color: C.white, align: 'center',
  });
  slide.addText(L.keepLearning, {
    x: 0.5, y: 4.8, w: W - 1, h: 0.35, fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.gold, align: 'center',
  });
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
// slideData: the parsed JSON from the AI transformation in /api/ppt/route.ts
//
// NOTE: this only fixes the *static* slide chrome (titles, badges, labels).
// The actual slide body text (warmUpTask, objectives, summaryPoints, etc.)
// comes from slideData, which is generated by a separate AI call in
// /api/ppt/route.ts — if that route has its own isFilipino check (likely
// copy-pasted the same way header.ts/flow.ts/assessment.ts did before being
// fixed), it needs the same isFilipinoPH fix or the slide body text will
// still come back in English even though the chrome around it is correct.

export async function buildPptxBuffer(
  slideData: any,
  teacherName: string,
  lessonName:  string,
  learningArea = '',
  gradeSection = '',
  sessionCount = 3,
): Promise<Uint8Array> {

  const L: PptxLabels = isFilipinoPH(learningArea) ? FILIPINO_LABELS : ENGLISH_LABELS;

  const pres = new pptxgen();
  pres.layout  = 'LAYOUT_16x9';
  pres.author  = teacherName;
  pres.title   = lessonName;
  pres.subject = 'ILAW Lesson Plan Student Presentation';

  const sessions: any[] = slideData.sessions || [];
  const lessonHook: string = slideData.lessonHook || '';

  // ── Slide 1: Cover ──
  addCoverSlide(pres, L, lessonName, teacherName, learningArea, gradeSection, sessionCount, lessonHook);

  // ── Per-session slides (12 slides per session: 1 divider + 11 content) ──
  for (let i = 0; i < sessionCount; i++) {
    const s   = sessions[i] || {};
    const num = i + 1;

    addSessionDivider(pres, L, num, s.sessionTitle || `${L.sessionWord} ${num}`, lessonName);  // 1
    addObjectivesSlide(pres, L, s, num, lessonName, teacherName);                      // 2
    addWarmUpSlide(pres, L, s, num, lessonName, teacherName);                          // 3
    addConceptSlide(pres, L, s, num, lessonName, teacherName);                         // 4
    addExampleSlide(pres, L, s.example1 || {}, 1, num, lessonName, teacherName);       // 5
    addExampleSlide(pres, L, s.example2 || {}, 2, num, lessonName, teacherName);       // 6
    addTryItSlide(pres, L, s, num, lessonName, teacherName);                           // 7
    addDiscussionSlide(pres, L, s, num, lessonName, teacherName);                      // 8
    addActivitySlide(pres, L, s, num, lessonName, teacherName);                        // 9
    addExitTicketSlide(pres, L, s, num, lessonName, teacherName);                      // 10
    addRealLifeSlide(pres, L, s, num, lessonName, teacherName);                        // 11
    addSummarySlide(pres, L, s, num, lessonName, teacherName);                         // 12
  }

  // ── Final closing slide ──
  addClosingSlide(pres, L, lessonName, teacherName, sessionCount);

  const buf = await pres.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
  return new Uint8Array(buf);
}