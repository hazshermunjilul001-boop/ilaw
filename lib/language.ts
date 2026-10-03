export type LanguageMode = 'auto' | 'filipino' | 'english';
export type OutputLanguage = Exclude<LanguageMode, 'auto'>;

// Filipino-medium subject labels are useful signals in Auto mode, but they are
// no longer the only way to request Filipino output.
const FILIPINO_SUBJECT_RE = /\b(araling\s*panlipunan|\bap\b|filipino|tagalog|edukasyon\s*sa\s*pagpapakatao|\besp\b|values\s*education|\bve\b|mother\s*tongue|\bmtb(-mle)?\b|\bepp\b|gmrc)\b/i;

// A compact, deterministic fallback for Auto mode. Requiring multiple distinct
// signals (or a clear Filipino curriculum phrase) avoids switching to Filipino
// because of a single ambiguous short word in otherwise English input.
const FILIPINO_SIGNALS = new Set([
  'ang', 'ng', 'mga', 'sa', 'ay', 'ito', 'iyon', 'nito', 'dito', 'doon',
  'hindi', 'dahil', 'upang', 'kung', 'kapag', 'habang', 'ngunit', 'pero',
  'para', 'mula', 'tungkol', 'bawat', 'sila', 'siya', 'kami', 'tayo', 'natin',
  'namin', 'kanila', 'niya', 'nang', 'mayroon', 'kailangan', 'guro', 'klase',
  'paaralan', 'mag-aaral', 'magaaral', 'pag-aaral', 'pagkatuto', 'aralin',
  'layunin', 'kakayahan', 'gawain', 'pagtataya', 'pag-unawa', 'pagsusuri',
  'mahalaga', 'kahalagahan', 'ipaliwanag', 'maipaliwanag', 'naipaliwanag',
  'naipapaliwanag', 'natutukoy', 'tukuyin', 'isulat', 'sagutin', 'halimbawa',
  'ginagamit', 'batay', 'wikang', 'wika', 'kasaysayan', 'panitikan',
]);

const CLEAR_FILIPINO_PHRASE_RE = /\b(mga\s+mag[- ]aaral|mag[- ]aaral|layunin\s+ng|sa\s+pagkatuto|pag-unawa|naipapaliwanag|naipaliwanag|maipaliwanag|paano\s+at\s+bakit|gamit\s+ang|batay\s+sa)\b/i;

/** Legacy subject detector retained for callers and external compatibility. */
export function isFilipinoPH(learningArea: string = ''): boolean {
  return FILIPINO_SUBJECT_RE.test(learningArea || '');
}

/** Detect whether substantive free-text lesson inputs are predominantly Filipino. */
export function detectFilipinoInput(samples: Array<string | null | undefined>): boolean {
  const text = samples.filter(Boolean).join('\n').trim();
  if (!text) return false;

  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = normalized.match(/[\p{L}]+(?:[-'][\p{L}]+)*/gu) ?? [];
  if (tokens.length < 3) return false;

  const distinctSignals = new Set(tokens.filter(token => FILIPINO_SIGNALS.has(token)));
  const signalCount = tokens.filter(token => FILIPINO_SIGNALS.has(token)).length;
  const signalRatio = signalCount / tokens.length;

  if (CLEAR_FILIPINO_PHRASE_RE.test(normalized)) return true;
  if (distinctSignals.size >= 3 && signalRatio >= 0.07) return true;
  if (tokens.length <= 8 && distinctSignals.size >= 2) return true;
  return false;
}

/**
 * Resolve one output language for every generated section and both file
 * templates. Explicit user choices win; Auto follows a Filipino-medium subject
 * or the language of the teacher's substantive lesson text, and otherwise uses
 * English.
 */
export function resolveOutputLanguage(
  learningArea: string = '',
  requestedMode: unknown = 'auto',
  languageSamples: Array<string | null | undefined> = [],
): OutputLanguage {
  if (requestedMode === 'filipino' || requestedMode === 'english') return requestedMode;
  if (isFilipinoPH(learningArea)) return 'filipino';
  return detectFilipinoInput([learningArea, ...languageSamples]) ? 'filipino' : 'english';
}

/** Clear instructions shared by all AI generation paths. */
export function outputLanguageRules(language: OutputLanguage): string {
  if (language === 'filipino') {
    return 'Write ALL generated lesson-plan or slide text in natural, complete Filipino/Tagalog. Translate descriptive source material supplied in English into Filipino; do not leave ordinary sentences or headings in English. Keep proper names, numbers, curriculum codes, and official publication titles unchanged when necessary. Preserve the meaning of the supplied competency and standards while expressing their explanatory text in Filipino.';
  }
  return 'Write ALL generated lesson-plan or slide text in clear English. Translate descriptive source material supplied in Filipino/Tagalog into English. Keep proper names, numbers, curriculum codes, and official publication titles unchanged when necessary.';
}
