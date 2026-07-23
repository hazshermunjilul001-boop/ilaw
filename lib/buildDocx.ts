import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
  LevelFormat, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';

// ── LANDSCAPE LAYOUT ─────────────────────────────────────────────────────
// Page is now landscape Letter (11in x 8.5in) instead of portrait. Content
// tables that used to be 2 columns (label + one content cell) are now
// N+1 columns for session-based fields: one label column plus one column
// per session, so each session's content sits in its own dedicated column
// instead of being stacked one-after-another in a single cell.
// NOTE: the `docx` library swaps width/height internally whenever
// orientation is LANDSCAPE, so these must be given in *portrait* order
// (width = short edge, height = long edge) — the library flips them to
// produce the actual landscape page. Passing already-swapped values here
// double-swaps and silently renders portrait again.
const PAGE_W_LANDSCAPE = 12240; // 8.5in (short edge)
const PAGE_H_LANDSCAPE = 15840; // 11in (long edge)
const PAGE_MARGIN = 1080;       // 0.75in

const LANDSCAPE_W = 12960; // total table width used by every table on the page
const LABEL_W = 2000;
const CONTENT_W = LANDSCAPE_W - LABEL_W; // used by plain 2-column (lesson-wide) rows

// Width of each session column for a given session count. Floors at 900
// twips (~0.63in) so columns stay legible even with many sessions, though
// very high session counts (7+) will make columns tight regardless.
function sessionColWidth(sessionCount: number): number {
  const n = Math.max(1, sessionCount);
  return Math.max(900, Math.floor((LANDSCAPE_W - LABEL_W) / n));
}

const DARK_BLUE = '1F3864';
const WHITE = 'FFFFFF';
const LABEL_BG = 'EEEEEE';
const GRAY_BG = 'D9D9D9';

const solid = (sz = 5, color = '000000') => ({ style: BorderStyle.SINGLE, size: sz, color });
const fullB = { top: solid(6), bottom: solid(6), left: solid(6), right: solid(6) };
const thinB = { top: solid(3, 'AAAAAA'), bottom: solid(3, 'AAAAAA'), left: solid(3, 'AAAAAA'), right: solid(3, 'AAAAAA') };

function isFilipinoPH(learningArea: string): boolean {
  // NOTE: DepEd's MATATAG curriculum renamed some subjects — most notably
  // Edukasyon sa Pagpapakatao (ESP) to "Values Education (VE)". The original
  // regex only matched "esp" and missed "VE", so subjects like "VE 8" fell
  // through to English labels even though they should use Filipino ones.
  // \b word boundaries are used around short abbreviations (ap, esp, ve,
  // mtb, epp) so they don't accidentally match inside unrelated words.
  return /\b(araling\s*panlipunan|\bap\b|filipino|edukasyon\s*sa\s*pagpapakatao|\besp\b|values\s*education|\bve\b|mother\s*tongue|\bmtb(-mle)?\b|\bepp\b|gmrc)\b/i.test(learningArea);
}

interface TemplateLabels {
  docTitle: string; lessonName: string; learningArea: string; designedBy: string;
  gradeSection: string; noOfSessions: string; references: string; referencesDesc: string;
  aiDeclaration: string; aiDeclarationDesc: string; aiDeclarationLink: string;

  // ── ILAW Banner labels (must match DO 016 s.2026 ILAW acronym exactly) ──
  intentionsBanner: string; intentionsDesc: string;
  learningExpBanner: string; learningExpDesc: string;
  // FIX #7: "Assessing Learning" (not just "Assessment") — matches the "A" in ILAW
  assessingLearningBanner: string; assessingLearningDesc: string;
  waysForwardBanner: string; waysForwardDesc: string;

  // ── Intentions sub-labels ──
  competencyLabel: string; competencyDesc: string;
  // FIX #2: objectivesDesc updated — no longer references Cognitive/Psychomotor/Affective
  objectivesLabel: string; objectivesDesc: string;
  learnerContextLabel: string; learnerContextDesc: string;

  // ── Learning Experience sub-labels ──
  preLessonLabel: string; preLessonDesc: string;
  flowLabel: string; flowDesc: string;
  resourcesLabel: string; resourcesDesc: string;
  // FIX #5: "integration and contextualization" (not just "integration")
  integrationLabel: string; integrationDesc: string;

  // ── Assessing Learning sub-labels ──
  formativeLabel: string; formativeDesc: string;

  // ── Ways Forward sub-labels ──
  extendedLabel: string; extendedDesc: string;
  reflectionsLabel: string; reflectionsDesc: string;
  afterSession: string; notesToShare: string; coachHelp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH LABELS
// ─────────────────────────────────────────────────────────────────────────────
const ENGLISH_LABELS: TemplateLabels = {
  docTitle: 'Lesson Plan',

  lessonName: 'Lesson Title',
  learningArea: 'Learning Area/s',
  designedBy: 'Name of Teacher/s',
  gradeSection: 'Grade Level and Section',
  noOfSessions: 'No. of Sessions',
  references: 'References',
  referencesDesc: '(books, websites, toolkits, etc.)',
  aiDeclaration: 'Declaration of AI use',
  aiDeclarationDesc: 'Cite how AI was used in the formulation of the lesson plan.',
  aiDeclarationLink: 'See DO 003 s.2026 Annex A.',

  // ── ILAW Banners ──────────────────────────────────────────────────────────
  intentionsBanner: 'Intentions',
  intentionsDesc: 'Meaningful learning experiences are anchored in how we frame them. Start by deciding what you want learners to master by the end of the lesson – keep it clear and simple. Remember: Understanding your learners\' evolving context and designing around it ensures that your lessons connect with and are relevant to them.',

  learningExpBanner: 'Learning Experience',
  learningExpDesc: 'A learning experience is like a thoughtfully designed journey. Each activity and interaction builds towards meaningful understanding and growth. Identify activities and interactions to help learners gain knowledge, skills, or understanding in a purposeful and coherent way.',

  // FIX #7: Banner is now "Assessing Learning" to match the "A" in ILAW
  assessingLearningBanner: 'Assessing Learning',
  assessingLearningDesc: 'Assessments reveal what learners have gained and what they still need help with. These are helpful in providing you with information to guide your future instruction throughout the entire session.',

  waysForwardBanner: 'Ways Forward',
  waysForwardDesc: 'Meaningful learning can also happen beyond the classroom – for both the learners and the teacher. Pause and reflect on what happened today.',

  // ── Intentions sub-labels ─────────────────────────────────────────────────
  competencyLabel: 'Learning Competency and Curriculum Standards:',
  competencyDesc: 'Write the competency/ies from the curriculum that we are targeting, and the content or performance standards applicable to the sessions.',

  // FIX #2: Objectives description no longer references the old DLP
  // Cognitive/Psychomotor/Affective three-domain format (repealed by DO 016 s.2026).
  // Now aligned with Section 7(a)(ii): clear, focused, manageable learning objectives.
  objectivesLabel: 'Learning Objectives:',
  objectivesDesc: 'Write the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions.',

  learnerContextLabel: 'Learner Context:',
  learnerContextDesc: 'Write your observations of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning.',

  // ── Learning Experience sub-labels ───────────────────────────────────────
  preLessonLabel: 'Pre-Lesson:',
  preLessonDesc: 'Describe how you will help the learners get ready for the lesson.',

  flowLabel: 'Flow:',
  // FIX #3: Flow description now references Learning Design Principles (DO 016 Table 1)
  // instead of implying a rigid 3-part structure. Instruction is responsive, not fixed.
  flowDesc: 'Describe the activities that you can implement in 1 or more sessions to meet your intentions.\n\nApply the Learning Design Principles, use the prompts below as a guide. Note, not all principles are expected in every lesson:\n• make the objectives clear for the learners\n• guide learners before letting them try the task on their own\n• check the state of the learners\' well-being, understanding, and mastery over the lesson\n• connect today\'s new concepts to past competencies\n• encourage collaboration among learners\n• invite learners to reflect on why this matters to them\n• ensure inclusion for learners\' varied abilities, learning styles, and contexts',

  resourcesLabel: 'Learning Resources:',
  resourcesDesc: 'List down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.\n\nInclude options and alternatives in case of emergencies.',

  // FIX #5: Label now reads "integration and contextualization" per DO 016 Section 7(b)(iv)
  integrationLabel: 'Opportunities for integration and contextualization:',
  integrationDesc: 'Write down any possibilities to meaningfully connect lessons within and across learning areas, integrate contextualized and human-centered uses of technology, and incorporate relevant real-life, cultural, or community-based contexts. Write N/A if none.',

  // ── Assessing Learning sub-labels ─────────────────────────────────────────
  formativeLabel: 'Formative Assessment:',
  formativeDesc: 'Create a task, activity or questions to assess learning and provide feedback every now and then. Include ways for learners to ask for guidance or support throughout each session.\n\nRemember to provide appropriate accommodations so all learners can demonstrate their understanding (e.g., varied response formats, small group options, visual or auditory supports)',

  // ── Ways Forward sub-labels ───────────────────────────────────────────────
  extendedLabel: 'Extended learning opportunities:',
  extendedDesc: 'Suggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.',

  reflectionsLabel: 'Reflections:',
  reflectionsDesc: 'Think about what you need to change for the next session based on what happened today. Is there something the learners are interested in exploring?\n\nAre there some things you would like to share with your co-teachers, parents, or school leaders about your classroom experience? What would you like your instructional coach to help you with?\n\nReflections may be written in brief notes, bullets, or annotations.',

  afterSession: 'After Session',
  notesToShare: 'Notes to share with co-teachers, parents, or school leaders:',
  coachHelp: 'I would like my instructional coach to help me with:',
};

// ─────────────────────────────────────────────────────────────────────────────
// FILIPINO LABELS
// ─────────────────────────────────────────────────────────────────────────────
const FILIPINO_LABELS: TemplateLabels = {
  docTitle: 'Plano sa Aralin',

  lessonName: 'Pamagat ng Aralin',
  learningArea: 'Larangang Pampagkatuto',
  designedBy: 'Pangalan ng Guro/s',
  gradeSection: 'Antas at Seksyon',
  noOfSessions: 'Bilang ng Sesyon',
  references: 'Mga Sanggunian',
  referencesDesc: '(mga libro, website, toolkit, atbp.)',
  aiDeclaration: 'Deklarasyon ng Paggamit ng AI',
  aiDeclarationDesc: 'Ipaliwanag kung paano ginamit ang AI sa pagbuo ng plano sa aralin.',
  aiDeclarationLink: 'Tingnan ang DO 003 s.2026 Annex A.',

  // ── ILAW Banners ──────────────────────────────────────────────────────────
  intentionsBanner: 'Mga Layunin',
  intentionsDesc: 'Ang makabuluhang karanasan sa pagkatuto ay nakasalalay sa kung paano natin ito binabalangkas. Magsimula sa pamamagitan ng pagpapasya kung ano ang nais mong matutunan ng mga mag-aaral bago matapos ang aralin – panatilihin itong malinaw at simple. Tandaan: Ang pag-unawa sa nagbabagong konteksto ng iyong mga mag-aaral at ang pagdidisenyo sa paligid nito ay nagtitiyak na ang iyong mga aralin ay may koneksyon at may kaugnayan sa kanila.',

  learningExpBanner: 'Karanasan sa Pagkatuto',
  learningExpDesc: 'Ang karanasan sa pagkatuto ay parang isang maingat na dinisenyo na paglalakbay. Ang bawat aktibidad at interaksyon ay nagtatayo tungo sa makabuluhang pag-unawa at paglago. Tukuyin ang mga aktibidad at interaksyon upang matulungan ang mga mag-aaral na makakuha ng kaalaman, kasanayan, o pag-unawa sa isang may layunin at magkakaugnay na paraan.',

  // FIX #7: "Pagtatatasa ng Pagkatuto" to match "Assessing Learning" concept
  assessingLearningBanner: 'Pagtatatasa ng Pagkatuto',
  assessingLearningDesc: 'Inihahayag ng mga pagtatasa kung ano ang natamo ng mga mag-aaral at kung ano pa ang kailangan nilang tulong. Kapaki-pakinabang ang mga ito sa pagbibigay sa iyo ng impormasyon upang gabayan ang iyong susunod na pagtuturo sa buong sesyon.',

  waysForwardBanner: 'Mga Susunod na Hakbang',
  waysForwardDesc: 'Ang makabuluhang pagkatuto ay maaari ring mangyari sa labas ng silid-aralan – para sa parehong mga mag-aaral at guro. Huminto at pagnilayan kung ano ang nangyari ngayon.',

  // ── Intentions sub-labels ─────────────────────────────────────────────────
  competencyLabel: 'Kakayahang Pampagkatuto at Pamantayan ng Kurikulum:',
  competencyDesc: 'Isulat ang kakayahan/mga kakayahan mula sa kurikulum na aming tinutukoy, at ang mga pamantayan ng nilalaman o pagganap na naaangkop sa mga sesyon.',

  // FIX #2: No Cognitive/Psychomotor/Affective — plain, focused objectives per DO 016
  objectivesLabel: 'Mga Layunin sa Pagkatuto:',
  objectivesDesc: 'Isulat ang mas maliliit na kaalaman, kasanayan, o gawain mula sa kakayahan na pag-aaralan ng mga mag-aaral at maipakikita sa pagtatapos ng mga sesyon.',

  learnerContextLabel: 'Konteksto ng Mag-aaral:',
  learnerContextDesc: 'Isulat ang iyong mga obserbasyon tungkol sa iyong mga mag-aaral at kung paano sila tumutugon sa mga karanasan sa pagkatuto kamakailan. Isama ang mga kalakasan, interes, at posibleng hadlang sa pagkatuto.',

  // ── Learning Experience sub-labels ───────────────────────────────────────
  preLessonLabel: 'Bago ang Aralin:',
  preLessonDesc: 'Ilarawan kung paano mo tutulungan ang mga mag-aaral na maghanda para sa aralin.',

  flowLabel: 'Daloy:',
  // FIX #3: Principles-based description, not rigid structure
  flowDesc: 'Ilarawan ang mga aktibidad na maaari mong ipatupad sa 1 o higit pang sesyon upang matugunan ang iyong mga layunin.\n\nIlapat ang mga Prinsipyo sa Disenyo ng Pagkatuto, gamitin ang mga prompt sa ibaba bilang gabay. Tandaan, hindi lahat ng prinsipyo ay inaasahan sa bawat aralin:\n• gawing malinaw ang mga layunin para sa mga mag-aaral\n• gabayan ang mga mag-aaral bago hayaan silang subukan ang gawain nang mag-isa\n• suriin ang kalagayan ng kagalingan, pag-unawa, at kahusayan ng mga mag-aaral sa buong aralin\n• ikonekta ang mga bagong konsepto sa mga nakaraang kakayahan\n• hikayatin ang pakikipagtulungan sa pagitan ng mga mag-aaral\n• anyayahan ang mga mag-aaral na pagnilayan kung bakit ito mahalaga sa kanila\n• tiyaking kasama ang lahat para sa iba-ibang kakayahan, estilo ng pagkatuto, at konteksto',

  resourcesLabel: 'Mga Kagamitan sa Pagkatuto:',
  resourcesDesc: 'Ilista ang mga kagamitan na tutulong sa iyo na maabot ang iyong mga layunin. Tiyakin na available at inklusibo ang mga ito.\n\nIsama ang mga alternatibo para sa mga emergency.',

  // FIX #5: "integrasyon at kontekstwalisasyon" per DO 016 Section 7(b)(iv)
  integrationLabel: 'Mga Pagkakataon para sa Integrasyon at Kontekstwalisasyon:',
  integrationDesc: 'Isulat ang anumang posibilidad na makabuluhang maikonekta ang mga aralin sa iba pang larangang pampagkatuto, maisama ang kontekstwalisadong paggamit ng teknolohiya, at maisama ang mga kaugnay na tunay na buhay, kultural, o kontekstong pangkomunidad. N/A kung wala.',

  // ── Assessing Learning sub-labels ─────────────────────────────────────────
  formativeLabel: 'Formative na Pagtatasa:',
  formativeDesc: 'Lumikha ng gawain, aktibidad, o mga katanungan upang suriin ang pagkatuto at magbigay ng feedback sa bawat pagkakataon. Isama ang mga paraan para sa mga mag-aaral na humingi ng gabay o suporta sa buong sesyon.\n\nMagbigay ng angkop na akomodasyon upang maipakita ng lahat ang kanilang pag-unawa (hal., iba-ibang format ng tugon, opsyon sa maliit na grupo, visual o auditory na suporta)',

  // ── Ways Forward sub-labels ───────────────────────────────────────────────
  extendedLabel: 'Mga Karagdagang Pagkakataon sa Pagkatuto:',
  extendedDesc: 'Magmungkahi ng iba pang karanasan sa pagkatuto sa labas ng silid-aralan o oras ng klase na maaaring i-access ng mga mag-aaral upang palakasin ang natutunan, palawakin ang kanilang pagkamausisa, o magbigay ng suporta sa kanilang mga lugar ng kahirapan.',

  reflectionsLabel: 'Mga Pagninilay:',
  reflectionsDesc: 'Pag-isipan kung ano ang kailangan mong baguhin para sa susunod na sesyon batay sa nangyari ngayon. Mayroon bang bagay na interesado ang mga mag-aaral na tuklasin?\n\nMayroon bang mga bagay na nais mong ibahagi sa iyong mga katrabahong guro, magulang, o mga lider ng paaralan tungkol sa iyong karanasan sa silid-aralan? Ano ang nais mong tulungan sa iyo ng iyong instructional coach?\n\nMaaaring isulat ang mga pagninilay sa maikling tala, mga bullet, o mga anotasyon.',

  afterSession: 'Pagkatapos ng Sesyon',
  notesToShare: 'Mga tala para ibahagi sa mga katrabahong guro, magulang, o mga lider ng paaralan:',
  coachHelp: 'Nais kong tulungan ako ng aking instructional coach sa:',
};

// ─────────────────────────────────────────────────────────────────────────────
// Paragraph helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Subheading detector
// FIX #2: Removed Cognitive / Psychomotor / Affective from the list since those
// are from the old DLP format (DO 42 s.2016) which is repealed by DO 016 s.2026.
// ─────────────────────────────────────────────────────────────────────────────

function isSubheadingLine(trimmed: string): boolean {
  // FIX #2: Cognitive/Psychomotor/Affective intentionally removed
  if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) return true;
  if (/^(Materials|Procedure|Purpose|Objective Link|Guiding Questions):?$/i.test(trimmed)) return true;
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
  if (/^(Learning Design Principle Applied|Evidence of Learning):?$/i.test(trimmed)) return true;

  // Filipino subheadings — FIX #2: Kognitibo/Sikolohikal/Pandama removed
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

// ─────────────────────────────────────────────────────────────────────────────
// Convert AI text → Paragraphs
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Table helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// spanCount = total columns the banner should cover (1 label + N sessions
// for session-based tables, or 2 for the plain metadata table).
function banner(boldText: string, subtitle = '', spanCount = 2): TableRow {
  return new TableRow({
    children: [new TableCell({
      columnSpan: spanCount, borders: fullB, width: { size: LANDSCAPE_W, type: WidthType.DXA },
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

// ── Session-column table helpers ─────────────────────────────────────────
// These support the new landscape layout: a header row naming each session,
// a row that puts each session's content in its own column, a fallback row
// for lesson-wide content (no per-session split found) that spans all the
// session columns as one merged cell, and a dispatcher that picks between
// the two automatically based on whether session markers were found.

// Splits a field's raw AI text on "## SESSION n" / "## SESYON n" markers.
// Returns null if no markers are found (i.e. the field is lesson-wide, not
// per-session — e.g. Learning Competency, Learner Context), so the caller
// can fall back to a single merged cell instead of guessing.
function splitBySession(text: string, sessionCount: number): string[] | null {
  if (!text || !text.trim()) return null;
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const marker = /^#{0,4}\s*(SESSION|SESYON)\s+(\d+)/i;

  const markerHits: { idx: number; num: number }[] = [];
  lines.forEach((line, i) => {
    const m = line.trim().match(marker);
    if (m) markerHits.push({ idx: i, num: parseInt(m[2], 10) });
  });

  if (markerHits.length === 0) return null;

  const sessions: string[] = new Array(sessionCount).fill('');
  for (let k = 0; k < markerHits.length; k++) {
    const start = markerHits[k].idx + 1;
    const end = k + 1 < markerHits.length ? markerHits[k + 1].idx : lines.length;
    const num = markerHits[k].num;
    if (num >= 1 && num <= sessionCount) {
      sessions[num - 1] = lines.slice(start, end).join('\n').trim();
    }
  }
  return sessions;
}

function sessionHeaderRow(sessionCount: number, sessionWord: string): TableRow {
  const colW = sessionColWidth(sessionCount);
  const cells: TableCell[] = [
    new TableCell({
      borders: thinB, width: { size: LABEL_W, type: WidthType.DXA },
      shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: [emptyP()],
    }),
  ];
  for (let i = 1; i <= sessionCount; i++) {
    cells.push(new TableCell({
      borders: thinB, width: { size: colW, type: WidthType.DXA },
      shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${sessionWord} ${i}`, bold: true, size: 19, font: 'Arial' })],
      })],
    }));
  }
  return new TableRow({ children: cells });
}

function rowPerSession(labelParas: Paragraph[], sessionTexts: string[]): TableRow {
  const colW = sessionColWidth(sessionTexts.length);
  const cells: TableCell[] = [
    new TableCell({
      borders: thinB, width: { size: LABEL_W, type: WidthType.DXA },
      shading: { fill: LABEL_BG, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      verticalAlign: VerticalAlign.TOP, children: labelParas,
    }),
  ];
  for (const text of sessionTexts) {
    cells.push(new TableCell({
      borders: thinB, width: { size: colW, type: WidthType.DXA },
      shading: { fill: WHITE, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      verticalAlign: VerticalAlign.TOP,
      children: text.trim() ? toParas(text) : [emptyP()],
    }));
  }
  return new TableRow({ children: cells });
}

function rowSpanAll(labelParas: Paragraph[], contentParas: Paragraph[], sessionCount: number): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: thinB, width: { size: LABEL_W, type: WidthType.DXA },
        shading: { fill: LABEL_BG, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        verticalAlign: VerticalAlign.TOP, children: labelParas,
      }),
      new TableCell({
        columnSpan: sessionCount,
        borders: thinB, width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        verticalAlign: VerticalAlign.TOP, children: contentParas,
      }),
    ],
  });
}

// Picks per-session columns if the field's raw text has session markers,
// otherwise falls back to one merged cell spanning all session columns.
// This means any field works correctly whether or not the AI happened to
// break it out by session — no per-field hardcoding required.
function sessionAwareRow(labelParas: Paragraph[], rawText: string, sessionCount: number): TableRow {
  const perSession = splitBySession(rawText, sessionCount);
  if (perSession) return rowPerSession(labelParas, perSession);
  return rowSpanAll(labelParas, rawText.trim() ? toParas(rawText) : [emptyP()], sessionCount);
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

// ─────────────────────────────────────────────────────────────────────────────
// Parse AI output sections
// FIX #1: WAYS_FORWARD normalizes to EXTENDED_LEARNING (consistent with
// route.ts promptD output tag — both should now use EXTENDED_LEARNING).
// ─────────────────────────────────────────────────────────────────────────────

function parseSection(content: string, tag: string): string {
  const ALL_TAGS = [
    'REFERENCES', 'DECLARATION_AI', 'LEARNING_COMPETENCY',
    'LEARNING_OBJECTIVES', 'LEARNER_CONTEXT', 'PRE_LESSON',
    'FLOW', 'LEARNING_RESOURCES', 'OPPORTUNITIES_FOR_INTEGRATION',
    'FORMATIVE_ASSESSMENT', 'EXTENDED_LEARNING', 'REFLECTIONS',
  ];

  function normalize(s: string): string {
    // Strip heading markers, bold markers, trailing colons, and leading dashes
    // so Mistral/OpenRouter formatting quirks don't break tag detection.
    let clean = s
      .replace(/^#{1,4}\s*/, '')          // ## headings
      .replace(/\*{1,2}/g, '')             // **bold** markers
      .replace(/:+$/, '')                   // trailing colon(s)
      .replace(/^[-–—]+\s*/, '')           // leading dash separators
      .trim()
      .toUpperCase()
      .replace(/[\s\-]+/g, '_');

    // Alias resolution — keeps backward-compat if old or variant tags appear
    if (clean === 'RESOURCES' || clean === 'LEARNING_RESOURCE') return 'LEARNING_RESOURCES';
    if (clean === 'REFERENCE') return 'REFERENCES';
    if (
      clean === 'INTEGRATION' ||
      clean === 'OPPORTUNITIES_FOR_INTEGRATION_TECHNOLOGY' ||
      clean === 'OPPORTUNITY_FOR_INTEGRATION' ||
      clean === 'OPPORTUNITIES_FOR_INTEGRATION_AND_CONTEXTUALIZATION' ||
      clean === 'INTEGRATION_AND_CONTEXTUALIZATION'
    ) return 'OPPORTUNITIES_FOR_INTEGRATION';
    // FIX #1: Both WAYS_FORWARD and EXTENDED_LEARNING_OPPORTUNITIES map to EXTENDED_LEARNING
    if (
      clean === 'WAYS_FORWARD' ||
      clean === 'EXTENDED_LEARNING_OPPORTUNITIES'
    ) return 'EXTENDED_LEARNING';
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

      if (ALL_TAGS.map(t => normalize(t)).includes(currentLineNorm) && currentLineNorm !== tagNorm) {
        break;
      }
      if (
        tagNorm === 'FORMATIVE_ASSESSMENT' &&
        (
          currentRawUpper.includes('WAYS FORWARD') ||
          currentRawUpper.includes('WAYS_FORWARD') ||
          currentLineNorm === 'EXTENDED_LEARNING'
        )
      ) {
        break;
      }
      // NOTE: a prior version broke PRE_LESSON parsing as soon as it saw a
      // "## SESSION n" line, meant as a safety net against content bleeding
      // in from a missing FLOW tag. That safety net was discarding every
      // legitimate per-session Pre-Lesson block (PRE_LESSON is organized by
      // session just like FLOW), so it's been removed — the ALL_TAGS check
      // above already stops parsing at the next real section tag.
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
      if (
        tagNorm === 'FORMATIVE_ASSESSMENT' &&
        (
          nextRawUpper.includes('WAYS FORWARD') ||
          nextRawUpper.includes('WAYS_FORWARD') ||
          nextLineNorm === 'EXTENDED_LEARNING'
        )
      ) {
        break;
      }

      result.push(lines[j]);
    }
    return result.join('\n').trim();
  }

  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared document builder — used by both buildDocx (browser) and
// buildDocxBuffer (server). Landscape orientation; session-based fields get
// one column per session via sessionAwareRow, lesson-wide fields (Learning
// Competency, Learner Context, References, Declaration) stay single-cell.
// ─────────────────────────────────────────────────────────────────────────────

function buildLessonPlanDoc(
  aiContent: string,
  teacherName: string,
  lessonName: string,
  learningArea: string,
  gradeSection: string,
  noOfSessions: string,
): { doc: Document; isFilipino: boolean } {
  const isFilipino = isFilipinoPH(learningArea);
  const L = isFilipino ? FILIPINO_LABELS : ENGLISH_LABELS;
  const sessionWord = isFilipino ? 'Sesyon' : 'Session';
  const sessionCount = Math.max(1, parseInt(noOfSessions) || 3);
  const spanCount = 1 + sessionCount; // label column + one column per session

  const raw = (key: string) => parseSection(aiContent, key);
  const get = (key: string) => {
    const text = raw(key);
    return text ? toParas(text) : [emptyP()];
  };

  // FIX #4: Reflections stay as blank writeable per-session templates unless
  // the AI provided its own REFLECTIONS content — kept as one merged cell
  // (not split into session columns) since it's a handwritten practice log,
  // not generated content that maps cleanly to per-session markers.
  const reflectionText = raw('REFLECTIONS');
  const reflectionLines: Paragraph[] = [];
  if (reflectionText) {
    reflectionLines.push(...toParas(reflectionText));
  } else {
    for (let i = 1; i <= sessionCount; i++) {
      reflectionLines.push(p(`${L.afterSession} ${i}:`, true));
      reflectionLines.push(emptyP(), emptyP(), emptyP());
    }
    reflectionLines.push(p(L.notesToShare, true));
    reflectionLines.push(emptyP(), emptyP());
    reflectionLines.push(p(L.coachHelp, true));
    reflectionLines.push(emptyP(), emptyP());
  }

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
          size: {
            width: PAGE_W_LANDSCAPE,
            height: PAGE_H_LANDSCAPE,
            orientation: PageOrientation.LANDSCAPE,
          },
          margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
        },
      },
      children: [

        // ── Document title ──────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: L.docTitle, bold: true, size: 24, font: 'Arial' })],
        }),

        // ── Header table: lesson metadata (plain 2-column, lesson-wide) ──────
        new Table({
          width: { size: LANDSCAPE_W, type: WidthType.DXA },
          columnWidths: [LABEL_W, CONTENT_W],
          rows: [
            row2([p(L.lessonName, true)], [p(lessonName)]),
            row2([p(L.learningArea, true)], [p(learningArea)]),
            row2([p(L.designedBy, true)], [p(teacherName)]),
            row2([p(L.gradeSection, true)], [p(gradeSection)]),
            row2([p(L.noOfSessions, true)], [p(noOfSessions)]),
            row2(
              [p(L.references, true), p(L.referencesDesc, false, 17, '555555', true)],
              raw('REFERENCES')
                ? get('REFERENCES')
                : [bul('DepEd Learner\'s Module'), bul('DepEd Teacher\'s Guide'), bul('K–12 MELC Curriculum Guide')]
            ),
            row2(
              [
                p(L.aiDeclaration, true),
                emptyP(),
                p(L.aiDeclarationDesc, false, 17, '555555', true),
                p(L.aiDeclarationLink, false, 17, '1155CC', true),
              ],
              get('DECLARATION_AI'),
            ),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── I: INTENTIONS ───────────────────────────────────────────────────
        // Learning Competency / Learner Context are lesson-wide (sessionAwareRow
        // falls back to a merged cell automatically); Learning Objectives gets
        // its own column per session if the AI content has session markers.
        new Table({
          width: { size: LANDSCAPE_W, type: WidthType.DXA },
          rows: [
            banner(L.intentionsBanner, L.intentionsDesc, spanCount),
            sessionAwareRow(labelCell(L.competencyLabel, L.competencyDesc), raw('LEARNING_COMPETENCY'), sessionCount),
            sessionHeaderRow(sessionCount, sessionWord),
            sessionAwareRow(labelCell(L.objectivesLabel, L.objectivesDesc), raw('LEARNING_OBJECTIVES'), sessionCount),
            sessionAwareRow(labelCell(L.learnerContextLabel, L.learnerContextDesc), raw('LEARNER_CONTEXT'), sessionCount),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── L: LEARNING EXPERIENCE ──────────────────────────────────────────
        new Table({
          width: { size: LANDSCAPE_W, type: WidthType.DXA },
          rows: [
            banner(L.learningExpBanner, L.learningExpDesc, spanCount),
            sessionHeaderRow(sessionCount, sessionWord),
            sessionAwareRow(labelCell(L.preLessonLabel, L.preLessonDesc), raw('PRE_LESSON'), sessionCount),
            sessionAwareRow(labelCell(L.flowLabel, L.flowDesc), raw('FLOW'), sessionCount),
            sessionAwareRow(labelCell(L.resourcesLabel, L.resourcesDesc), raw('LEARNING_RESOURCES'), sessionCount),
            sessionAwareRow(labelCell(L.integrationLabel, L.integrationDesc), raw('OPPORTUNITIES_FOR_INTEGRATION'), sessionCount),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── A: ASSESSING LEARNING ────────────────────────────────────────────
        new Table({
          width: { size: LANDSCAPE_W, type: WidthType.DXA },
          rows: [
            banner(L.assessingLearningBanner, L.assessingLearningDesc, spanCount),
            sessionHeaderRow(sessionCount, sessionWord),
            sessionAwareRow(labelCell(L.formativeLabel, L.formativeDesc), raw('FORMATIVE_ASSESSMENT'), sessionCount),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── W: WAYS FORWARD ─────────────────────────────────────────────────
        new Table({
          width: { size: LANDSCAPE_W, type: WidthType.DXA },
          rows: [
            banner(L.waysForwardBanner, L.waysForwardDesc, spanCount),
            sessionHeaderRow(sessionCount, sessionWord),
            sessionAwareRow(labelCell(L.extendedLabel, L.extendedDesc), raw('EXTENDED_LEARNING'), sessionCount),
            // Reflections stays merged across all session columns (see note above)
            rowSpanAll(labelCell(L.reflectionsLabel, L.reflectionsDesc), reflectionLines, sessionCount),
          ],
        }),

      ],
    }],
  });

  return { doc, isFilipino };
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser export — triggers a download via file-saver.
// ─────────────────────────────────────────────────────────────────────────────

export async function buildDocx(
  aiContent: string,
  teacherName: string,
  lessonName: string,
  learningArea = '',
  gradeSection = '',
  noOfSessions = '',
) {
  const { doc, isFilipino } = buildLessonPlanDoc(
    aiContent, teacherName, lessonName, learningArea, gradeSection, noOfSessions,
  );
  const blob = await Packer.toBlob(doc);
  const filename = `${lessonName.replace(/[^a-z0-9]/gi, '_')}_${isFilipino ? 'Plano_sa_Aralin' : 'ILAW'}.docx`;
  saveAs(blob, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side export — returns a Buffer instead of triggering a browser download.
// Used by /api/download/route.ts so the `docx` package never runs in the browser.
// ─────────────────────────────────────────────────────────────────────────────

export async function buildDocxBuffer(
  aiContent: string,
  teacherName: string,
  lessonName: string,
  learningArea = '',
  gradeSection = '',
  noOfSessions = '',
): Promise<Uint8Array> {
  const { doc } = buildLessonPlanDoc(
    aiContent, teacherName, lessonName, learningArea, gradeSection, noOfSessions,
  );
  return new Uint8Array(await Packer.toBuffer(doc));
}