import type { CSSProperties, ReactNode } from 'react';

/** Public counterpart of Tiptap's blockContainer / nested blockGroup geometry. */
export function PublicDocumentBlock({
  id,
  kind,
  start,
  children,
  nested,
  measure,
}: {
  id: string;
  kind: string;
  start?: number;
  /** Breakout width inside a reading measure; omitted blocks keep the text measure. */
  measure?: 'standard' | 'wide';
  children: ReactNode;
  nested?: ReactNode;
}) {
  return (
    <div
      data-document-block={kind}
      data-document-measure={measure}
      data-id={id}
      style={start === undefined ? undefined : { counterSet: `document-numbered-list ${start}` }}
    >
      {children}
      {nested ? <PublicDocumentChildren>{nested}</PublicDocumentChildren> : null}
    </div>
  );
}

/** The nested block group. List items render it inside their `<li>` so child lists stay part of the item. */
export function PublicDocumentChildren({ children }: { children: ReactNode }) {
  return <div data-document-children="">{children}</div>;
}

export function isPublicListItemKind(kind: string) {
  return kind === 'bullet-list-item' || kind === 'numbered-list-item';
}

interface ListItemPresentation {
  'data-text-color'?: string;
  'data-bg-color'?: string;
}

/**
 * One published list item. Its children stay inside the `<li>` (one list item in the outline), while the
 * authored background and alignment cover only the item's own text, as in the editor: the text color
 * stays on the `<li>` for the marker and `[data-document-children]` resets it for the nested blocks.
 */
export function PublicListItem({
  presentation,
  textAlign,
  nested,
  children,
}: {
  presentation: ListItemPresentation;
  textAlign: CSSProperties['textAlign'];
  nested?: ReactNode;
  children: ReactNode;
}) {
  if (!nested) {
    return (
      <li {...presentation} style={{ textAlign }}>
        {children}
      </li>
    );
  }
  return (
    <li data-text-color={presentation['data-text-color']}>
      <div data-list-item-content="" data-bg-color={presentation['data-bg-color']} style={{ textAlign }}>
        {children}
      </div>
      <PublicDocumentChildren>{nested}</PublicDocumentChildren>
    </li>
  );
}
