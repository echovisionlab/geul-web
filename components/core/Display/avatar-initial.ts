const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
const letterOrNumber = /[\p{L}\p{N}]/u;

/**
 * Derives the Avatar fallback initial from a display name.
 * Uses the first letter or number grapheme (so emoji sequences and combining marks stay whole),
 * uppercases it with locale-independent rules so server and client output match, and returns
 * null for a blank name so Avatar shows its shared person glyph.
 */
export function avatarInitial(name: string | null | undefined): string | null {
  const text = name?.trim();
  if (!text) {
    return null;
  }
  const graphemes = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), (part) => part.segment)
    : Array.from(text);
  const first = graphemes.find((grapheme) => letterOrNumber.test(grapheme)) ?? graphemes[0];
  const upper = first.toUpperCase();
  // Expanding case mappings such as ß → SS would turn one initial into two letters.
  return Array.from(upper).length > Array.from(first).length ? first : upper;
}
