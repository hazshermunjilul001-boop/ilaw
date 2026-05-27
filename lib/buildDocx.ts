import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
  LevelFormat,
} from 'docx';
import { saveAs } from 'file-saver';

const W = 9360;
const LABEL_W = 2800;
const CONTENT_W = W - LABEL_W;
const DARK_BLUE = '1F3864';
const WHITE = 'FFFFFF';
const LABEL_BG = 'EEEEEE';
const GRAY_BG = 'D9D9D9';

const solid = (sz = 5, color = '000000') => ({ style: BorderStyle.SINGLE, size: sz, color });
const fullB = { top: solid(6), bottom: solid(6), left: solid(6), right: solid(6) };
const thinB = { top: solid(3, 'AAAAAA'), bottom: solid(3, 'AAAAAA'), left: solid(3, 'AAAAAA'), right: solid(3, 'AAAAAA') };
const noneB = { top: solid(0, 'FFFFFF'), bottom: solid(0, 'FFFFFF'), left: solid(0, 'FFFFFF'), right: solid(0, 'FFFFFF') };

// ── Paragraph helpers ──────────────────────────────────────────────

function p(text: string, bold = false, size = 20, color = '000000', italic = false): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text, bold, size, font: 'Arial', color, italics })],
  });
}

function emptyP(): Paragraph {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '', size: 20 })] });
}

// Converts a line of AI text into a Paragraph with mixed bold/normal runs
// Lines starting with ** or containing **text** get bold treatment
function richPara(line: string, defaultSize = 20): Paragraph {
  const runs: TextRun[] = [];
  // Split on **...**
  const parts = line.split(/\*\*(.*?)\*\*/g);
  parts.forEach((part, i) => {
    if (part === '') return;
    runs.push(new TextRun({ text: part, bold: i % 2 === 1, size: defaultSize, font: 'Arial' }));
  });
  if (runs.length === 0) runs.push(new TextRun({ text: line, size: defaultSize, font: 'Arial' }));
  return new Paragraph({ spacing: { after: 60 }, children: runs });
}

// Bullet paragraph using proper numbering
function bul(text: string, size = 20): Paragraph {
  // Strip leading bullet chars from AI output
  const clean = text.replace(/^[\u2022\-\*•]\s*/, '').trim();
  // Handle inline bold within bullet text
  const runs: TextRun[] = [];
  const parts = clean.split(/\*\*(.*?)\*\*/g);
  parts.forEach((part, i) => {
    if (part === '') return;
    runs.push(new TextRun({ text: part, bold: i % 2 === 1, size, font: 'Arial' }));
  });
  if (runs.length === 0) runs.push(new TextRun({ text: clean, size, font: 'Arial' }));
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 40 },
    children: runs,
  });
}

// ── Convert AI section text → array of Paragraphs ─────────────────

function toParas(text: string): Paragraph[] {
  if (!text || !text.trim()) return [emptyP()];
  const lines = text.split('\n');
  const result: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      result.push(emptyP());
      continue;
    }
    const trimmed = line.trim();

    // Numbered step: "1. text" or "1) text"
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      const clean = trimmed.replace(/^\d+[\.\)]\s+/, '');
      result.push(new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        spacing: { after: 40 },
        children: parseBold(clean),
      }));
      continue;
    }

    // Bullet line
    if (/^[-•*]\s+/.test(trimmed)) {
      const clean = trimmed.replace(/^[-•*]\s+/, '');
      result.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 40 },
        children: parseBold(clean),
      }));
      continue;
    }

    // ── SUBHEADING PATTERNS ──────────────────────────────────────
    // Matches any of these as a dark blue bold subheading (no bullet):
    //   **Text:** or **Text**
    //   Cognitive / Psychomotor / Affective (with or without colon)
    //   For All Learners / For Learners Who Need Support / For Advanced Learners
    //   Session N / Part N / Materials / Procedure / Purpose / Guiding Questions
    //   Any line that is entirely bold (**...**)
    const isSubheading =
      /^\*\*[^*]+\*\*:?\s*$/.test(trimmed) ||
      /^(Cognitive|Psychomotor|Affective):?$/i.test(trimmed) ||
      /^\*\*(Cognitive|Psychomotor|Affective)\*\*:?$/i.test(trimmed) ||
      /^\*\*(For All Learners|For Learners Who Need|For Advanced Learners|For Learners Who Want)[^*]*\*\*:?$/i.test(trimmed) ||
      /^\*\*(SESSION|PART|Materials|Procedure|Purpose|Objective Link|Guiding Questions|Strengths|Interests|Possible Barriers|Accommodations|Primary Materials|Reference Materials|Emergency|Other Learning|Special Topics|Values Integration|Technology|Remediation|Enrichment)[^*]*\*\*:?$/i.test(trimmed) ||
      /^(For All Learners|For Learners Who Need Support|For Advanced Learners|For Learners Who Want to Go Deeper):?$/i.test(trimmed) ||
      /^(Materials|Procedure|Purpose|Guiding Questions|Objective Link):?$/i.test(trimmed) ||
      /^(Strengths and Prior Knowledge|Interests and Engagement Hooks|Possible Barriers to Learning|Accommodations and Support):?$/i.test(trimmed) ||
      /^(Primary Materials|Reference Materials|Emergency Alternatives):?$/i.test(trimmed) ||
      /^(Other Learning Areas|Special Topics|Values Integration|Career Awareness|Technology):?$/i.test(trimmed);

    if (isSubheading) {
      const clean = trimmed.replace(/\*\*/g, '').replace(/:$/, '');
      result.push(new Paragraph({
        spacing: { after: 60, before: 100 },
        children: [new TextRun({
          text: clean + ':',
          bold: true,
          size: 20,
          font: 'Arial',
          color: '1F3864',
        })],
      }));
      continue;
    }

    // Mixed bold/normal line (default)
    result.push(new Paragraph({
      spacing: { after: 60 },
      children: parseBold(trimmed),
    }));
  }

  return result.length > 0 ? result : [emptyP()];
}

function parseBold(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/\*\*(.*?)\*\*/g);
  parts.forEach((part, i) => {
    if (part === '') return;
    runs.push(new TextRun({
      text: part,
      bold: i % 2 === 1,
      size: 20,
      font: 'Arial',
      color: i % 2 === 1 ? '1F3864' : '000000',
    }));
  });
  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: 20, font: 'Arial' }));
  }
  return runs;
}

// ── Table helpers ──────────────────────────────────────────────────

function row2(labelParas: Paragraph[], contentParas: Paragraph[]): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: thinB,
        width: { size: LABEL_W, type: WidthType.DXA },
        shading: { fill: LABEL_BG, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        verticalAlign: VerticalAlign.TOP,
        children: labelParas,
      }),
      new TableCell({
        borders: thinB,
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        verticalAlign: VerticalAlign.TOP,
        children: contentParas,
      }),
    ],
  });
}

function rowFull(paras: Paragraph[], bg = GRAY_BG): TableRow {
  return new TableRow({
    children: [new TableCell({
      columnSpan: 2,
      borders: fullB,
      width: { size: W, type: WidthType.DXA },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: paras,
    })],
  });
}

function banner(bold: string, subtitle = ''): TableRow {
  return new TableRow({
    children: [new TableCell({
      columnSpan: 2,
      borders: fullB,
      width: { size: W, type: WidthType.DXA },
      shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: bold, bold: true, size: 28, font: 'Arial' }),
            subtitle ? new TextRun({ text: '     ' + subtitle, size: 18, font: 'Arial', color: '333333' }) : new TextRun(''),
          ],
        }),
      ],
    })],
  });
}

function labelCell(title: string, desc: string): Paragraph[] {
  return [
    p(title, false, 19, '000000', true),
    emptyP(),
    p(desc, false, 17, '444444', true),
  ];
}

// ── Parse AI output ────────────────────────────────────────────────

function parseSection(content: string, key: string): string {
  // Match KEY: ... up to next ALL_CAPS_KEY: or end
  const regex = new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_]{3,}:|$)`);
  const match = content.match(regex);
  if (!match) return '';
  return match[1].trim();
}

// ── Main export ────────────────────────────────────────────────────

export async function buildDocx(
  aiContent: string,
  teacherName: string,
  lessonName: string,
  learningArea = '',
  gradeSection = '',
  noOfSessions = '',
) {
  const get = (key: string) => toParas(parseSection(aiContent, key));

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 560, hanging: 280 } },
              run: { font: 'Arial', size: 20 },
            },
          }],
        },
        {
          reference: 'numbers',
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 560, hanging: 280 } },
              run: { font: 'Arial', size: 20 },
            },
          }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [

        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Lesson Plan Template', bold: true, size: 24, font: 'Arial' })],
        }),

        // ── TOP INFO TABLE ──
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            row2([p('Name of Lesson', true)], [p(lessonName)]),
            row2([p('Learning Area/s', true)], [p(learningArea)]),
            row2([p('Designed by Teacher/s', true)], [p(teacherName)]),
            row2([p('Designed for which Grade Level and Section', true)], [p(gradeSection)]),
            row2([p('No. of Sessions', true)], [p(noOfSessions)]),
            row2(
              [
                p('References', true),
                p('(books, websites, toolkits, etc.)', false, 17, '555555', true),
              ],
              get('REFERENCES') .length > 0 && parseSection(aiContent, 'REFERENCES')
                ? get('REFERENCES')
                : [
                    bul('DepEd Grade 10 Learner\'s Module'),
                    bul('DepEd Teacher\'s Guide'),
                    bul('K–12 MELC Curriculum Guide'),
                  ]
            ),
            row2(
              [
                p('Declaration of AI use', true),
                emptyP(),
                p('Cite how AI was used in the formulation of the lesson plan.', false, 17, '555555', true),
                p('See DO 3 s.2026 Annex A.', false, 17, '1155CC', true),
              ],
              get('DECLARATION_AI'),
            ),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── INTENTIONS ──
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(
              'Intentions.',
              'Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson – keep it clear and simple.'
            ),
            row2(
              labelCell('Learning Competency:', 'Write the competency/ies from the curriculum that we are targeting, and the content or performance standards applicable to the sessions.'),
              get('LEARNING_COMPETENCY'),
            ),
            row2(
              labelCell('Learning Objectives:', 'Write the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions.'),
              get('LEARNING_OBJECTIVES'),
            ),
            row2(
              labelCell('Learner Context:', 'Write your observations of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning.'),
              get('LEARNER_CONTEXT'),
            ),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── LEARNING EXPERIENCE ──
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(
              'Learning Experience.',
              'A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth.'
            ),
            row2(
              labelCell('Pre-Lesson:', 'Describe how you will help the learners get ready for the lesson.'),
              get('PRE_LESSON'),
            ),
            row2(
              labelCell(
                'Flow:',
                'Describe the activities that you can implement in 1 or more sessions to meet the learning objectives.\n\nApply the Learning Design Principles by thinking about how to:\n• make the objectives clear for the learners\n• guide learners before letting them try the task on their own\n• check the state of the learners\' well-being, understanding, and mastery over the lesson\n• connect today\'s new concepts to past competencies\n• encourage collaboration among learners\n• invite learners to reflect on why this matters to them\n• ensure inclusion for learners\' varied abilities, learning styles, and contexts'
              ),
              get('FLOW'),
            ),
            row2(
              labelCell('Learning Resources:', 'List down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.\n\nInclude options and alternatives in case of emergencies.'),
              get('LEARNING_RESOURCES'),
            ),
            row2(
              labelCell('Opportunities for integration:', 'Write down any possibilities to meaningfully integrate another learning area, special topic, or technology. Write N/A if none.'),
              get('OPPORTUNITIES_FOR_INTEGRATION'),
            ),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── ASSESSMENT ──
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(
              'Assessment.',
              'Assessments reveal what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction.'
            ),
            row2(
              labelCell('Formative Assessment:', 'Create a task, activity or questions to evaluate learning and provide feedback. Include ways for learners to ask for guidance or support.\n\nRemember to provide appropriate accommodations so all learners can demonstrate their understanding (e.g., varied response formats, small group options, visual or auditory supports)'),
              get('FORMATIVE_ASSESSMENT'),
            ),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── WAYS FORWARD ──
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(
              'Ways Forward.',
              'Meaningful learning can also happen beyond the classroom – for both the learners and the teacher. Pause and reflect on what happened today.'
            ),
            row2(
              labelCell('Extended learning opportunities:', 'Suggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.'),
              get('EXTENDED_LEARNING'),
            ),
            row2(
              labelCell('Reflections:', 'Think about what you need to change for the next session based on what happened today. Is there something the learners are interested in exploring?\n\nAre there some things you would like to share with your co-teachers, parents, or school leaders about your classroom experience? What would you like your instructional coach to help you with?'),
              [
                p('After Session 1:', true),
                emptyP(), emptyP(), emptyP(),
                p('After Session 2:', true),
                emptyP(), emptyP(), emptyP(),
                p('After Session 3:', true),
                emptyP(), emptyP(), emptyP(),
                p('Notes to share with co-teachers, parents, or school leaders:', true),
                emptyP(), emptyP(),
                p('I would like my instructional coach to help me with:', true),
                emptyP(), emptyP(),
              ],
            ),
          ],
        }),

      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${lessonName.replace(/[^a-z0-9]/gi, '_')}_ILAW.docx`);
}