/*
 * Pure text normalisers for matching scanned bills against records. No DB or AI imports.
 * Bills mix Arabic and French and may print digits as Arabic-Indic (٠-٩) or Persian (۰-۹).
 */

/** Legal-form words dropped before comparing names. Compared after accents and punctuation are removed. */
const LEGAL_SUFFIXES = new Set([
  'sarl', 'eurl', 'spa', 'snc', 'sas', 'ste', 'societe', 'cie',
  'شركة', 'شذمم', 'ذمم',
]);

/** Arabic-Indic (U+0660..0669) and Persian (U+06F0..06F9) digits become ASCII 0-9. */
export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/** Digits only, after digit conversion. "000 123-456" becomes "000123456". */
export function digitsOnly(s: string): string {
  return toLatinDigits(s).replace(/\D/g, '');
}

/** Base form for any text: ASCII digits, no Arabic diacritics or tatweel, no Latin accents, lowercase, single spaces. */
export function normalizeText(s: string): string {
  return toLatinDigits(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // Latin accents and Arabic harakat and marks, all combining marks
    .replace(/ـ/g, '') // tatweel
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Business name for comparison: base form, punctuation removed, legal-form words dropped. */
export function normalizeName(s: string): string {
  const cleaned = normalizeText(s).replace(/\./g, '').replace(/[,;:'"()\-_/&]+/g, ' ');
  return cleaned
    .split(' ')
    .filter((w) => w.length > 0 && !LEGAL_SUFFIXES.has(w))
    .join(' ');
}

/** Identifier comparison (NIF, NIS, RC, article, invoice and order numbers): letters and digits only, lowercase. */
export function normalizeCode(s: string): string {
  return normalizeText(s).replace(/[^\p{L}\p{N}]/gu, '');
}

/** Tokens of a normalised name, for similarity scoring. */
export function nameTokens(s: string): string[] {
  return normalizeName(s).split(' ').filter((w) => w.length > 0);
}
