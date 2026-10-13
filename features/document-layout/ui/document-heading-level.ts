/**
 * Semantic level of a published authored heading.
 *
 * Authored headings keep their visual size (keyed on `data-heading-level`, the authored level) and their
 * outline depth (table of contents, Markdown); only the rendered element moves below the heading the
 * body sits under: the document title (`1`) demotes authored H1 → `h2`, H2 → `h3`, H3 → `h4`, capped at
 * `h6`. A body without a title heading (`0`) keeps the authored element, so its H1 is the page's `h1`.
 */
export type DocumentHeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/** The heading level the authored body sits under: 0 none, 1 the document title, 2 a section label… */
export type DocumentHeadingParentLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const DOCUMENT_TITLE_HEADING_LEVEL = 1 satisfies DocumentHeadingParentLevel;

export function documentHeadingTag(
  authoredLevel: number,
  parentLevel: DocumentHeadingParentLevel = 0,
): DocumentHeadingTag {
  const authored = Number.isFinite(authoredLevel) ? Math.max(1, Math.trunc(authoredLevel)) : 1;
  return `h${Math.min(6, authored + parentLevel)}` as DocumentHeadingTag;
}
