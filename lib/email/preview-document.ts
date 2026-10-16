/**
 * The renderer owns the complete email document, including fonts and direction.
 * Keep preview srcDoc byte-for-byte identical to its delivery HTML.
 * Iframe isolation belongs to the consuming view.
 */
export function buildEmailPreviewSrcDoc(html: string, _locale: string | null | undefined): string {
  void _locale;
  return html;
}
