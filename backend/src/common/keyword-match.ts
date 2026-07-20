// ─────────────────────────────────────────────────────────────────
// Keyword matching — shared by comment / DM / story auto-reply rules.
//
// Two problems this solves over a raw `text.includes(keyword)`:
//   1. Arabic is written many ways for the same word (أ/إ/آ/ا, ة/ه,
//      ى/ي, tatweel ـ, and diacritics). A customer typing "بكم" vs
//      "بِكَم" vs "بكــم" must all match the keyword "بكم".
//   2. The AutoReplyRule.matchType (EXACT / CONTAINS / STARTS_WITH /
//      ENDS_WITH) was stored but never honored — every match behaved
//      like CONTAINS. This applies it properly.
// ─────────────────────────────────────────────────────────────────

export type MatchType = 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH';

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/**
 * Normalizes Arabic (and mixed) text so spelling variants collapse to one
 * canonical form: strips diacritics + tatweel, unifies alef/ya/taa-marbuta,
 * lowercases, and squeezes whitespace. Safe for Latin text too.
 */
export function normalizeArabic(input: string): string {
  if (!input) return '';
  return input
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a rule's raw keyword string on Latin/Arabic commas. */
export function parseKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,،]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Returns true when `text` matches any of `keywords` under `matchType`,
 * comparing on the Arabic-normalized forms of both. An empty keyword list
 * means "no keyword filter" and always matches (callers rely on this for
 * ANY_COMMENT / unfiltered story rules).
 */
export function matchesKeywords(
  text: string,
  keywords: string[],
  matchType: MatchType = 'CONTAINS',
): boolean {
  if (keywords.length === 0) return true;
  const haystack = normalizeArabic(text);
  if (!haystack) return false;

  return keywords.some((kw) => {
    const needle = normalizeArabic(kw);
    if (!needle) return false;
    switch (matchType) {
      case 'EXACT':
        return haystack === needle;
      case 'STARTS_WITH':
        return haystack.startsWith(needle);
      case 'ENDS_WITH':
        return haystack.endsWith(needle);
      case 'CONTAINS':
      default:
        return haystack.includes(needle);
    }
  });
}
