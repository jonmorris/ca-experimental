/**
 * Fuzzy matching, shared by the command palette and the not-found page.
 *
 * Both answer the same question from different inputs — the palette from what
 * you typed, the 404 page from the URL you landed on — so they rank with the
 * same function rather than two that drift apart.
 */

/** Subsequence match, so "sfm" finds "Siap Faji Mergers". */
export function score(haystack, needle) {
  const text = haystack.toLowerCase();
  const query = needle.toLowerCase();
  if (!query) return 0;

  const exact = text.indexOf(query);
  if (exact === 0) return 1000;
  if (exact > 0) return 700 - exact;

  let index = 0;
  let hits = 0;
  let streak = 0;
  let best = 0;
  for (const char of query) {
    const found = text.indexOf(char, index);
    if (found === -1) return -1;
    streak = found === index ? streak + 1 : 1;
    best = Math.max(best, streak);
    hits += 1;
    index = found + 1;
  }
  return hits * 8 + best * 12 - index;
}

/**
 * The score a whole-substring hit earns. Anything below this matched only as a
 * scattered subsequence, which is the right bar for a palette the reader is
 * actively typing into and much too loose for a guess made on their behalf.
 */
export const SUBSTRING_MATCH = 700;

/** The best `limit` items by label, dropping anything that does not match. */
export function rank(items, query, limit = 6, minScore = 0) {
  if (!query) return items.slice(0, limit);
  return items
    .map((item) => ({ item, value: score(item.label, query) }))
    .filter((entry) => entry.value > 0 && entry.value >= minScore)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((entry) => entry.item);
}
