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

function isFilipinoPH(learningArea: string): boolean {
  return /araling panlipunan|filipino|edukasyon sa pagpapakatao|esp|mapeh|mother tongue|mtb|epp/i.test(learningArea);
}

interface TemplateLabels {
  docTitle: string; lessonName: string; learningArea: string; designedBy: string;
  gradeSection: string; noOfSessions: string; references: string; referencesDesc: string;
  aiDeclaration: string; aiDeclarationDesc: string; aiDeclarationLink: string;
  intentionsBanner: string; intentionsDesc: string; learningExpBanner: string;
  learningExpDesc: string; assessmentBanner: string; assessmentDesc: string;
  waysForwardBanner: string; waysForwardDesc: string; competencyLabel: string;
  competencyDesc: string; objectivesLabel: string; objectivesDesc: string;
  learnerContextLabel: string; learnerContextDesc: string; preLessonLabel: string;
  preLessonDesc: string; flowLabel: string; flowDesc: string; resourcesLabel: string;
  resourcesDesc: string; integrationLabel: string; integrationDesc: string;
  formativeLabel: string; formativeDesc: string; extendedLabel: string; extendedDesc: string;
  reflectionsLabel: string; reflectionsDesc: string;
  afterSession: string; notesToShare: string; coachHelp: string;
}

const ENGLISH_LABELS: TemplateLabels = {
  docTitle: 'Lesson Plan Template',
  lessonName: 'Name of Lesson', learningArea: 'Learning Area/s',
  designedBy: 'Designed by Teacher/s',
  gradeSection: 'Designed for which Grade Level and Section',
  noOfSessions: 'No. of Sessions', references: 'References',
  referencesDesc: '(books, websites, toolkits, etc.)',
  aiDeclaration: 'Declaration of AI use',
  aiDeclarationDesc: 'Cite how AI was used in the formulation of the lesson plan.',
  aiDeclarationLink: 'See DO 3 s.2026 Annex A.',
  intentionsBanner: 'Intentions.',
  intentionsDesc: 'Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson – keep it clear and simple. Remember: Understanding your learners\' evolving context and designing around it help ensure that your lessons connect with and are relevant to them.',
  learningExpBanner: 'Learning Experience.',
  learningExpDesc: 'A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, or understanding in a purposeful way.',
  assessmentBanner: 'Assessment.',
  assessmentDesc: 'Assessments reveal what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction.',
  waysForwardBanner: 'Ways Forward.',
  waysForwardDesc: 'Meaningful learning can also happen beyond the classroom – for both the learners and the teacher. Pause and reflect on what happened today.',
  competencyLabel: 'Learning Competency:',
  competencyDesc: 'Write the competency/ies from the curriculum that we are targeting, and the content or performance standards applicable to the sessions.',
  objectivesLabel: 'Learning Objectives:',
  objectivesDesc: 'Write the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions.',
  learnerContextLabel: 'Learner Context:',
  learnerContextDesc: 'Write your observations of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning.',
  preLessonLabel: 'Pre-Lesson:',
  preLessonDesc: 'Describe how you will help the learners get ready for the lesson.',
  flowLabel: 'Flow:',
  flowDesc: 'Describe the activities that you can implement in 1 or more sessions to meet the learning objectives.\n\nApply the Learning Design Principles by thinking about how to:\n• make the objectives clear for the learners\n• guide learners before letting them try the task on their own\n• check the state of the learners\' well-being, understanding, and mastery over the lesson\n• connect today\'s new concepts to past competencies\n• encourage collaboration among learners\n• invite learners to reflect on why this matters to them\n• ensure inclusion for learners\' varied abilities, learning styles, and contexts',
  resourcesLabel: 'Learning Resources:',
  resourcesDesc: 'List down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.\n\nInclude options and alternatives in case of emergencies.',
  integrationLabel: 'Opportunities for integration:',
  integrationDesc: 'Write down any possibilities to meaningfully integrate another learning area, special topic, or technology. Write N/A if none.',
  formativeLabel: 'Formative Assessment:',
  formativeDesc: 'Create a task, activity or questions to evaluate learning and provide feedback. Include ways for learners to ask for guidance or support.\n\nRemember to provide appropriate accommodations so all learners can demonstrate their understanding (e.g., varied response formats, small group options, visual or auditory supports)',
  extendedLabel: 'Extended learning opportunities:',
  extendedDesc: 'Suggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.',
  reflectionsLabel: 'Reflections:',
  reflectionsDesc: 'Think about what you need to change for the next session based on what happened today. Is there something the learners are interested in exploring?\n\nAre there some things you would like to share with your co-teachers, parents, or school leaders about your classroom experience? What would you like your instructional coach to help you with?',
  afterSession: 'After Session', notesToShare: 'Notes to share with co-teachers, parents, or school leaders:',
  coachHelp: 'I would like my instructional coach to help me with:',
};

const FILIPINO_LABELS: TemplateLabels = {
  docTitle: 'Template ng Plano sa Aralin',
  lessonName: 'Pangalan ng Aralin', learningArea: 'Larangang Pampagkatuto',
  designedBy: 'Dinisenyo ng Guro/s', gradeSection: 'Dinisenyo para sa Antas at Seksyon',
  noOfSessions: 'Bilang ng Sesyon', references: 'Mga Sanggunian',
  referencesDesc: '(mga libro, website, toolkit, atbp.)',
  aiDeclaration: 'Deklarasyon ng Paggamit ng AI',
  aiDeclarationDesc: 'Ipaliwanag kung paano ginamit ang AI sa pagbuo ng plano sa aralin.',
  aiDeclarationLink: 'Tingnan ang DO 3 s.2026 Annex A.',
  intentionsBanner: 'Mga Layunin.',
  intentionsDesc: 'Ang makabuluhang karanasan sa pagkatuto ay nakasalalay sa kung paano natin ito binabalangkas. Magsimula sa pamamagitan ng pagpapasya kung ano ang nais mong matutunan ng mga mag-aaral bago matapos ang aralin – panatilihin itong malinaw at simple.',
  learningExpBanner: 'Karanasan sa Pagkatuto.',
  learningExpDesc: 'Ang karanasan sa pagkatuto ay parang isang maingat na dinisenyo na paglalakbay. Ang bawat aktibidad at interaksyon ay nagtatayo tungo sa makabuluhang pag-unawa at paglago.',
  assessmentBanner: 'Pagtatasa.',
  assessmentDesc: 'Inihahayag ng mga pagtatasa kung ano ang natamo ng mga mag-aaral at kung ano pa ang kailangan nilang tulong.',
  waysForwardBanner: 'Mga Susunod na Hakbang.',
  waysForwardDesc: 'Ang makabuluhang pagkatuto ay maaari ring mangyari sa labas ng silid-aralan. Huminto at pagnilayan kung ano ang nangyari ngayon.',
  competencyLabel: 'Kakayahang Pampagkatuto:',
  competencyDesc: 'Isulat ang kakayahan/mga kakayahan mula sa kurikulum na aming tinutukoy, at ang mga pamantayan ng nilalaman o pagganap na naaangkop sa mga sesyon.',
  objectivesLabel: 'Mga Layunin sa Pagkatuto:',
  objectivesDesc: 'Isulat ang mas maliliit na kaalaman, kasanayan, o gawain mula sa kakayahan na pag-aaralan ng mga mag-aaral at maipakikita sa pagtatapos ng mga sesyon.',
  learnerContextLabel: 'Konteksto ng Mag-aaral:',
  learnerContextDesc: 'Isulat ang iyong mga obserbasyon tungkol sa iyong mga mag-aaral at kung paano sila tumutugon sa mga karanasan sa pagkatuto. Isama ang mga kalakasan, interes, at posibleng hadlang.',
  preLessonLabel: 'Bago ang Aralin:',
  preLessonDesc: 'Ilarawan kung paano mo tutulungan ang mga mag-aaral na maghanda para sa aralin.',
  flowLabel: 'Daloy:',
  flowDesc: 'Ilarawan ang mga aktibidad na maaari mong ipatupad sa 1 o higit pang sesyon upang matugunan ang mga layunin sa pagkatuto.\n\nIlapat ang mga Prinsipyo sa Disenyo ng Pagkatuto:\n• gawing malinaw ang mga layunin para sa mga mag-aaral\n• gabayan ang mga mag-aaral bago hayaan silang subukan ang gawain nang mag-isa\n• suriin ang kalagayan ng kagalingan, pag-unawa, at kahusayan ng mga mag-aaral\n• ikonekta ang mga bagong konsepto sa mga nakaraang kakayahan\n• hikayatin ang pakikipagtulungan sa pagitan ng mga mag-aaral\n• anyayahan ang mga mag-aaral na pagnilayan kung bakit ito mahalaga\n• tiyaking kasama ang lahat para sa iba-ibang kakayahan at estilo ng pagkatuto',
  resourcesLabel: 'Mga Kagamitan sa Pagkatuto:',
  resourcesDesc: 'Ilista ang mga kagamitan na tutulong sa iyo na maabot ang iyong mga layunin. Tiyakin na available at inklusibo. Isama ang mga alternatibo para sa emergency.',
  integrationLabel: 'Mga Pagkakataon para sa Integrasyon:',
  integrationDesc: 'Isulat ang anumang posibilidad na ikonekta sa ibang larangan ng pagkatuto, espesyal na paksa, o teknolohiya. N/A kung wala.',
  formativeLabel: 'Formative na Pagtatasa:',
  formativeDesc: 'Lumikha ng gawain o katanungan upang suriin ang pagkatuto at magbigay ng feedback. Isama ang mga paraan para sa mga mag-aaral na humingi ng gabay.\n\nMagbigay ng angkop na akomodasyon upang maipakita ng lahat ang kanilang pag-unawa.',
  extendedLabel: 'Mga Karagdagang Pagkakataon sa Pagkatuto:',
  extendedDesc: 'Magmungkahi ng iba pang karanasan sa pagkatuto sa labas ng silid-aralan upang palakasin ang natutunan, palawakin ang pagkamausisa, o magbigay ng suporta.',
  reflectionsLabel: 'Mga Pagninilay:',
  reflectionsDesc: 'Pag-isipan kung ano ang kailangan mong baguhin para sa susunod na sesyon. Mayroon bang nais ibahagi sa mga katrabaho, magulang, o mga lider ng paaralan?',
  afterSession: 'Pagkatapos ng Sesyon',
  notesToShare: 'Mga tala para ibahagi sa mga katrabahong guro, magulang, o mga lider ng paaralan:',
  coachHelp: 'Nais kong tulungan ako ng aking instructional coach sa:',
};

// ── Paragraph helpers ──────────────────────────────────────────────

function p(text: string, bold = false, size = 20, color = '000000', italics = false): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text, bold, size, font: 'Arial', color, italics })],
  });
}

function emptyP(): Paragraph {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '', size: 20 })] });
}

function parseBold(text: string): TextRun[] {
  const cleaned = text.replace(/^\*+|\*+$/g, '').trim();
  const runs: TextRun[] = [];
  const parts = cleaned.split(/\*\*(.*?)\*\*/g);
  parts.forEach((part, i) => {
    if (part === '') return;
    const safeText = part.replace(/\*/g, '');
    if (!safeText) return;
    runs.push(new TextRun({
      text: safeText,
      bold: i % 2 === 1,
      size: 20,
      font: 'Arial',
      color: i % 2 === 1 ? DARK_BLUE : '000000',
    }));
  });
  if (runs.length === 0) {
    const safe = text.replace(/\*/g, '');
    if (safe) runs.push(new TextRun({ text: safe, size: 20, font: 'Arial' }));
  }
  return runs;
}

function bul(text: string): Paragraph {
  const clean = text.replace(/^[\u2022\-\*•]+\s*/, '').replace(/\*/g, '').trim();
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text: clean, size: 20, font: 'Arial' })],
  });
}

// ── Subheading detector ────────────────────────────────────────────

function isSubheadingLine(trimmed: string): boolean {
  if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) return true;
  if (/^(Cognitive|Psychomotor|Affective|Materials|Procedure|Purpose|Objective Link|Guiding Questions):?$/i.test(trimmed)) return true;
  if (/^(Detailed teacher instructions|Student actions and expected responses|Contextualized example problems):?$/i.test(trimmed)) return true;
  if (/^(Differentiated Instructions|Synthesis and Reflection|Closing discussion|Exit ticket|Real-life connection):?$/i.test(trimmed)) return true;
  if (/^(For All Learners|For Learners Who Need Support|For Advanced Learners):?$/i.test(trimmed)) return true;
  if (/^(For All Learners \(Remediation\)|For Advanced Learners \(Enrichment\)|For Learners Who Need Reinforcement):?$/i.test(trimmed)) return true;
  if (/^(Strengths and Prior Knowledge|Interests and Engagement Hooks|Possible Barriers to Learning|Accommodations and Support):?$/i.test(trimmed)) return true;
  if (/^(Primary Materials|Reference Materials|Emergency Alternatives):?$/i.test(trimmed)) return true;
  if (/^(Other Learning Areas|Special Topics|Career Awareness|Values Integration):?$/i.test(trimmed)) return true;
  if (/^(Special Topics \/ Career Awareness|Technology \(Future Integration\)|Technology):?$/i.test(trimmed)) return true;
  if (/^(Description|Administration|How results are used|Rubric or scoring guide|Accommodation for diverse learners):?$/i.test(trimmed)) return true;
  if (/^(Sample warm-up question|Sample tasks or questions):?$/i.test(trimmed)) return true;
  
  if (/^(Kognitibo|Sikolohikal|Psikomotor|Pandama|Pagpapahalaga):?$/i.test(trimmed)) return true;
  if (/^(Mga Kagamitan|Mga Hakbang|Layunin ng Aktibidad|Mga Gabay na Tanong|Kaugnay na Layunin):?$/i.test(trimmed)) return true;
  if (/^(Mga tagubilin para sa guro|Mga aksyon ng mag-aaral at inaasahang tugon|Mga halimbawang kontekstwalisado):?$/i.test(trimmed)) return true;
  if (/^(Mga Naka-differentiate na Tagubilin|Buod at Repleksyon|Pangwakas na talakayan|Koneksyon sa tunay na buhay):?$/i.test(trimmed)) return true;
  if (/^Para sa (Lahat ng Mag-aaral|Mga Mag-aaral na Nangangailangan ng Tulong|mga Advanced na Mag-aaral):?$/i.test(trimmed)) return true;
  if (/^Para sa (Mga Nangangailangan ng Remedyasyon|mga Advanced na Mag-aaral \(Pagpapayaman\)):?$/i.test(trimmed)) return true;
  if (/^(Mga Kalakasan at Nakaraang Kaalaman|Mga Interes at Pakikipag-ugnayan|Mga Hadlang sa Pagkatuto|Mga Angkop na Tulong at Suporta):?$/i.test(trimmed)) return true;
  if (/^(Pangunahing Kagamitan|Mga Sanggunian|Mga Alternatibo sa Emerhensya):?$/i.test(trimmed)) return true;
  if (/^(Iba pang Larangang Pang-aralan|Mga Espesyal na Paksa|Kamalayan sa Karera|Integrasyon ng mga Pagpapahalaga|Teknolohiya):?$/i.test(trimmed)) return true;
  if (/^(Mga Espesyal na Paksa \/ Kamalayan sa Karera|Teknolohiya \(Hinaharap na Integrasyon\)):?$/i.test(trimmed)) return true;
  if (/^(Paglalarawan|Paraan ng pagbibigay|Paano gagamitin ang mga resulta|Rubrika o gabay sa pagmamarka):?$/i.test(trimmed)) return true;
  if (/^(Mga angkop na tulong para sa iba't ibang mag-aaral|Halimbawa ng tanong para sa warm-up|Halimbawa ng mga tanong o gawain):?$/i.test(trimmed)) return true;
  if (/^(SESSION|SESYON|PART|BAHAGI)\s+\d+/i.test(trimmed)) return true;
  if (/^(Para sa Lahat ng Mag-aaral|Para sa Mga Nangangailangan ng Remedyasyon|Para sa mga Advanced na Mag-aaral \(Pagpapayaman\)):?$/i.test(trimmed)) return true;
  if (/^(Para sa Mga Mag-aaral na Nangangailangan ng Tulong|Para sa mga Advanced na Mag-aaral):?$/i.test(trimmed)) return true;
  if (/^(For All Learners|For Learners Who Need Reinforcement \(Remediation\)|For Advanced Learners \(Enrichment\)):?$/i.test(trimmed)) return true;
  return false;
}

// ── Convert AI text → Paragraphs ─────────────────────────────────

function toParas(text: string): Paragraph[] {
  if (!text || !text.trim()) return [emptyP()];
  const lines = text.split('\n');
  const result: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { result.push(emptyP()); continue; }
    const trimmed = line.trim();

    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      result.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 40 },
        children: parseBold(trimmed.replace(/^\d+[\.\)]\s+/, '')),
      }));
      continue;
    }

    if (/^[-•*]\s+/.test(trimmed)) {
      result.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 40 },
        children: parseBold(trimmed.replace(/^[-•*]\s+/, '')),
      }));
      continue;
    }

    if (isSubheadingLine(trimmed)) {
      const clean = trimmed.replace(/\*\*/g, '').replace(/\*/g, '').replace(/:$/, '').trim();
      result.push(new Paragraph({
        spacing: { after: 60, before: 100 },
        children: [new TextRun({ text: clean + ':', bold: true, size: 20, font: 'Arial', color: DARK_BLUE })],
      }));
      continue;
    }

    const runs = parseBold(trimmed);
    if (runs.length > 0) {
      result.push(new Paragraph({ spacing: { after: 60 }, children: runs }));
    }
  }

  return result.length > 0 ? result : [emptyP()];
}

// ── Table helpers ──────────────────────────────────────────────────

function row2(labelParas: Paragraph[], contentParas: Paragraph[]): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: thinB, width: { size: LABEL_W, type: WidthType.DXA },
        shading: { fill: LABEL_BG, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        verticalAlign: VerticalAlign.TOP, children: labelParas,
      }),
      new TableCell({
        borders: thinB, width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        verticalAlign: VerticalAlign.TOP, children: contentParas,
      }),
    ],
  });
}

function banner(boldText: string, subtitle = ''): TableRow {
  return new TableRow({
    children: [new TableCell({
      columnSpan: 2, borders: fullB, width: { size: W, type: WidthType.DXA },
      shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [new Paragraph({
        children: [
          new TextRun({ text: boldText, bold: true, size: 28, font: 'Arial' }),
          subtitle ? new TextRun({ text: '     ' + subtitle, size: 17, font: 'Arial', color: '333333' }) : new TextRun(''),
        ],
      })],
    })],
  });
}

function labelCell(title: string, desc: string): Paragraph[] {
  const lines = desc.split('\n');
  const paras: Paragraph[] = [p(title, false, 19, '000000', true), emptyP()];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('•')) {
      paras.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 30 },
        children: [new TextRun({ text: t.replace(/^•\s*/, ''), size: 17, font: 'Arial', color: '444444', italics: true })],
      }));
    } else {
      paras.push(p(t, false, 17, '444444', true));
    }
  }
  return paras;
}

// ── Parse AI output sections ───────────────────────────────────────

function parseSection(content: string, tag: string): string {
  const ALL_TAGS = [
    'REFERENCES', 'DECLARATION_AI', 'LEARNING_COMPETENCY',
    'LEARNING_OBJECTIVES', 'LEARNER_CONTEXT', 'PRE_LESSON',
    'FLOW', 'LEARNING_RESOURCES', 'OPPORTUNITIES_FOR_INTEGRATION',
    'FORMATIVE_ASSESSMENT', 'EXTENDED_LEARNING', 'REFLECTIONS',
  ];

  function normalize(s: string): string {
    let clean = s
      .replace(/[#*:]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[\s\-]+/g, '_');
    
    // Tugisin ang mga shorthand text styles mula sa LLM stream
    if (clean === 'RESOURCES' || clean === 'LEARNING_RESOURCE') return 'LEARNING_RESOURCES';
    if (clean === 'INTEGRATION' || clean === 'OPPORTUNITIES_FOR_INTEGRATION_TECHNOLOGY' || clean === 'OPPORTUNITY_FOR_INTEGRATION') return 'OPPORTUNITIES_FOR_INTEGRATION';
    if (clean === 'WAYS_FORWARD' || clean === 'EXTENDED_LEARNING_OPPORTUNITIES') return 'EXTENDED_LEARNING';
    return clean;
  }

  const tagNorm = normalize(tag);
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  
  let startLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (normalize(lines[i]) === tagNorm) {
      startLine = i;
      break;
    }
  }

  if (startLine !== -1) {
    const result: string[] = [];
    for (let i = startLine + 1; i < lines.length; i++) {
      const currentLineNorm = normalize(lines[i]);
      const currentRawUpper = lines[i].trim().toUpperCase();
      
      // Strict matching guardrails laban sa tag-leakage
      if (ALL_TAGS.map(t => normalize(t)).includes(currentLineNorm) && currentLineNorm !== tagNorm) {
        break;
      }
      if (tagNorm === 'FORMATIVE_ASSESSMENT' && (currentRawUpper.includes('WAYS FORWARD') || currentRawUpper.includes('WAYS_FORWARD') || currentLineNorm === 'EXTENDED_LEARNING')) {
        break;
      }
      if (/^##\s+(SESSION|SESYON)\s+\d+/i.test(lines[i].trim()) && tagNorm === 'PRE_LESSON') {
        break;
      }
      result.push(lines[i]);
    }
    return result.join('\n').trim();
  }

  // Backup regex fallback pass
  const inlineTagRe = new RegExp(`^[#* ]*${tagNorm.replace(/_/g, '[_ \\-]')}\\s*:\\s*(.*)$`, 'im');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(inlineTagRe);
    if (!m) continue;
    const inlineRemainder = (m[1] ?? '').trim();
    const result: string[] = inlineRemainder ? [inlineRemainder] : [];
    for (let j = i + 1; j < lines.length; j++) {
      const nextLineNorm = normalize(lines[j]);
      const nextRawUpper = lines[j].trim().toUpperCase();

      if (ALL_TAGS.map(t => normalize(t)).includes(nextLineNorm)) break;
      if (tagNorm === 'FORMATIVE_ASSESSMENT' && (nextRawUpper.includes('WAYS FORWARD') || nextRawUpper.includes('WAYS_FORWARD') || nextLineNorm === 'EXTENDED_LEARNING')) {
        break;
      }

      result.push(lines[j]);
    }
    return result.join('\n').trim();
  }

  return '';
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
  const isFilipino = isFilipinoPH(learningArea);
  const L = isFilipino ? FILIPINO_LABELS : ENGLISH_LABELS;
  
  const get = (key: string) => {
    const text = parseSection(aiContent, key);
    return text ? toParas(text) : [emptyP()];
  };

  const sessionCount = parseInt(noOfSessions) || 3;
  const reflectionLines: Paragraph[] = [];
  for (let i = 1; i <= sessionCount; i++) {
    reflectionLines.push(p(`${L.afterSession} ${i}:`, true));
    reflectionLines.push(emptyP(), emptyP(), emptyP());
  }
  reflectionLines.push(p(L.notesToShare, true));
  reflectionLines.push(emptyP(), emptyP());
  reflectionLines.push(p(L.coachHelp, true));
  reflectionLines.push(emptyP(), emptyP());

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '\u2022',
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
            level: 0, format: LevelFormat.DECIMAL, text: '%1.',
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

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: L.docTitle, bold: true, size: 24, font: 'Arial' })],
        }),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            row2([p(L.lessonName, true)], [p(lessonName)]),
            row2([p(L.learningArea, true)], [p(learningArea)]),
            row2([p(L.designedBy, true)], [p(teacherName)]),
            row2([p(L.gradeSection, true)], [p(gradeSection)]),
            row2([p(L.noOfSessions, true)], [p(noOfSessions)]),
            row2(
              [p(L.references, true), p(L.referencesDesc, false, 17, '555555', true)],
              parseSection(aiContent, 'REFERENCES') ? get('REFERENCES') : [bul('DepEd Learner\'s Module'), bul('DepEd Teacher\'s Guide'), bul('K–12 MELC Curriculum Guide')]
            ),
            row2(
              [p(L.aiDeclaration, true), emptyP(), p(L.aiDeclarationDesc, false, 17, '555555', true), p(L.aiDeclarationLink, false, 17, '1155CC', true)],
              get('DECLARATION_AI'),
            ),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(L.intentionsBanner, L.intentionsDesc),
            row2(labelCell(L.competencyLabel, L.competencyDesc), get('LEARNING_COMPETENCY')),
            row2(labelCell(L.objectivesLabel, L.objectivesDesc), get('LEARNING_OBJECTIVES')),
            row2(labelCell(L.learnerContextLabel, L.learnerContextDesc), get('LEARNER_CONTEXT')),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(L.learningExpBanner, L.learningExpDesc),
            row2(labelCell(L.preLessonLabel, L.preLessonDesc), get('PRE_LESSON')),
            row2(labelCell(L.flowLabel, L.flowDesc), get('FLOW')),
            row2(labelCell(L.resourcesLabel, L.resourcesDesc), get('LEARNING_RESOURCES')),
            row2(labelCell(L.integrationLabel, L.integrationDesc), get('OPPORTUNITIES_FOR_INTEGRATION')),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(L.assessmentBanner, L.assessmentDesc),
            row2(labelCell(L.formativeLabel, L.formativeDesc), get('FORMATIVE_ASSESSMENT')),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            banner(L.waysForwardBanner, L.waysForwardDesc),
            row2(labelCell(L.extendedLabel, L.extendedDesc), get('EXTENDED_LEARNING')), // <--- NAITAMA NA SA EXTENDED_LEARNING MULA WAYS_FORWARD
            row2(labelCell(L.reflectionsLabel, L.reflectionsDesc), reflectionLines),
          ],
        }),

      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${lessonName.replace(/[^a-z0-9]/gi, '_')}_${isFilipino ? 'Plano_sa_Aralin' : 'ILAW'}.docx`;
  saveAs(blob, filename);
}