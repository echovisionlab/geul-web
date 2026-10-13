/**
 * Marks the ancestor shared by the outline layout and document chrome that lives outside it (a title,
 * a full-bleed hero, overlaid document controls). Inside it, `--_table-of-contents-inset-start` and
 * `--_table-of-contents-inset-end` hold the inline space the outline reserves (0 without an outline),
 * so that chrome can align with the reserved document box instead of repeating Core geometry.
 */
export const tableOfContentsScope = { 'data-table-of-contents-scope': '' } as const;
