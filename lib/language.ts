// lib/language.ts
// Single source of truth for "is this a Filipino-medium subject" detection.
// Used by buildDocx.ts (for template label language) AND every
// /api/generate/* route (for the actual AI generation language instruction).
// These two were previously implemented as separate copy-pasted regexes
// that drifted out of sync — the routes' copy was missing "VE" (Values
// Education, ESP's MATATAG-curriculum rename), which is what caused AI
// content to generate in English even when the docx labels were correctly
// Filipino. Keeping this in one place means a fix here fixes both.
export function isFilipinoPH(learningArea: string): boolean {
  return /\b(araling\s*panlipunan|\bap\b|filipino|edukasyon\s*sa\s*pagpapakatao|\besp\b|values\s*education|\bve\b|mother\s*tongue|\bmtb(-mle)?\b|\bepp\b|gmrc)\b/i.test(learningArea);
}