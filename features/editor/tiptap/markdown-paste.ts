import { Extension, type JSONContent } from '@tiptap/core';
import { Fragment, Slice, type Schema } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Children, isValidElement, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ElementProps = { children?: ReactNode; href?: string; className?: string; checked?: boolean; type?: string };
const children = (value: ReactNode): ReactNode[] => Children.toArray(value);
const propsOf = (value: ReactNode): ElementProps => (isValidElement<ElementProps>(value) ? value.props : {});
const tag = (value: ReactNode): string => (isValidElement(value) && typeof value.type === 'string' ? value.type : '');
const textOf = (value: ReactNode): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : children(propsOf(value).children).map(textOf).join('');

/** Reuse the installed CommonMark/GFM pipeline; raw HTML is never interpreted. */
export function markdownBlocks(text: string, schema: Schema): JSONContent[] | null {
  const tree = Markdown({ children: text, remarkPlugins: [remarkGfm], skipHtml: false });
  let recognized = false;
  let unsupported = false;
  const inline = (value: ReactNode, marks: NonNullable<JSONContent['marks']> = []): JSONContent[] => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value) ? [{ type: 'text', text: String(value), ...(marks.length ? { marks } : {}) }] : [];
    }
    const type = tag(value);
    if (type === 'img') {
      unsupported = true;
      return [];
    }
    if (type === 'input') {
      return [];
    }
    if (type === 'br') {
      return schema.nodes.hardBreak ? [{ type: 'hardBreak' }] : [{ type: 'text', text: '\n' }];
    }
    const mark = ({ strong: 'bold', em: 'italic', code: 'code', del: 'strike', a: 'link' } as Record<string, string>)[
      type
    ];
    let nextMarks = marks;
    if (mark && schema.marks[mark]) {
      recognized = true;
      nextMarks = [
        ...marks,
        { type: mark, ...(mark === 'link' ? { attrs: { href: propsOf(value).href ?? '' } } : {}) },
      ];
    }
    return children(propsOf(value).children).flatMap((child) => inline(child, nextMarks));
  };
  const block = (
    type: string,
    content: JSONContent[] = [],
    attrs?: Record<string, unknown>,
    nested: JSONContent[] = [],
  ): JSONContent => ({
    type: 'blockContainer',
    attrs: { id: crypto.randomUUID() },
    content: [
      { type, ...(attrs ? { attrs } : {}), ...(content.length ? { content } : {}) },
      ...(nested.length ? [{ type: 'blockGroup', content: nested }] : []),
    ],
  });
  const convert = (value: ReactNode): JSONContent[] => {
    const type = tag(value);
    const parts = children(propsOf(value).children);
    if (!type) {
      return typeof value === 'string' && value.trim() ? [block('paragraph', inline(value))] : parts.flatMap(convert);
    }
    if (type === 'ul' || type === 'ol') {
      recognized = true;
      return parts
        .filter((part) => tag(part) === 'li')
        .map((item, index) => {
          const body = children(propsOf(item).children);
          const checkbox = body
            .flatMap((part) => (tag(part) === 'p' ? children(propsOf(part).children) : [part]))
            .find((part) => tag(part) === 'input');
          const loose = body.some((part) => tag(part) === 'p');
          const blockTags = new Set(['p', 'ul', 'ol', 'pre', 'blockquote', 'table']);
          const meaningful = body.filter((part, index) => {
            if (tag(part) || textOf(part).trim()) {
              return true;
            }
            if (loose) {
              return false;
            }
            return (
              !textOf(part).includes('\n') ||
              ![body[index - 1], body[index + 1]].some((neighbor) => blockTags.has(tag(neighbor)))
            );
          });
          const firstParagraph = meaningful.find((part) => tag(part) === 'p');
          const inlineParts = firstParagraph
            ? [firstParagraph]
            : meaningful.filter((part) => !['ul', 'ol', 'pre', 'blockquote', 'table'].includes(tag(part)));
          const nested = meaningful
            .filter((part) => !inlineParts.includes(part) && tag(part) !== 'input')
            .flatMap(convert);
          const content = inlineParts.flatMap((part) => inline(part));
          // GFM places a separator space after the checkbox.
          if (checkbox && content[0]?.text?.startsWith(' ')) {
            content[0].text = content[0].text.slice(1);
          }
          return block(
            checkbox ? 'checkListItem' : type === 'ol' ? 'numberedListItem' : 'bulletListItem',
            content.filter((node) => node.text !== ''),
            checkbox
              ? { checked: propsOf(checkbox).checked === true }
              : type === 'ol'
                ? { start: Number((propsOf(value) as { start?: number }).start ?? 1) + index }
                : undefined,
            nested,
          );
        });
    }
    if (/^h[1-6]$/.test(type)) {
      recognized = true;
      return [
        block(
          'heading',
          parts.flatMap((part) => inline(part)),
          { level: Math.min(3, Number(type[1])) },
        ),
      ];
    }
    if (type === 'blockquote') {
      recognized = true;
      return parts
        .filter((part) => tag(part) || textOf(part).trim())
        .flatMap((part) => (tag(part) === 'p' ? [block('quote', inline(part))] : convert(part)));
    }
    if (type === 'pre') {
      recognized = true;
      const code = parts.find((part) => tag(part) === 'code');
      const source = textOf(code).replace(/\n$/, '');
      return [
        block('codeBlock', source ? [{ type: 'text', text: source }] : [], {
          language: propsOf(code).className?.replace(/^language-/, '') ?? 'plaintext',
        }),
      ];
    }
    if (type === 'hr') {
      recognized = true;
      return [block('divider')];
    }
    if (type === 'table' && !schema.nodes.table) {
      unsupported = true;
      return [];
    }
    if (type === 'table' && schema.nodes.table) {
      recognized = true;
      const rows = parts.flatMap((part) => children(propsOf(part).children)).filter((part) => tag(part) === 'tr');
      return [
        block(
          'table',
          rows.map((row) => ({
            type: 'tableRow',
            content: children(propsOf(row).children)
              .filter((cell) => ['td', 'th'].includes(tag(cell)))
              .map((cell) => ({
                type: tag(cell) === 'th' ? 'tableHeader' : 'tableCell',
                content: [{ type: 'tableParagraph', content: inline(cell) }],
              })),
          })),
        ),
      ];
    }
    return [block('paragraph', inline(value))];
  };
  const result = children(propsOf(tree).children).flatMap(convert);
  if (unsupported || !recognized || result.length === 0) {
    return null;
  }
  // Schema validation fails closed before dispatch; unsupported constructs stay plain text.
  try {
    result.forEach((node) => schema.nodeFromJSON(node).check());
  } catch {
    return null;
  }
  return result;
}

export function createMarkdownPasteExtension(canChangeStructure: () => boolean) {
  return Extension.create({
    name: 'markdownPaste',
    priority: 900,
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handlePaste: (view, event) => {
              if (
                !view.editable ||
                view.composing ||
                !canChangeStructure() ||
                view.state.selection.$from.parent.type.spec.code
              ) {
                return false;
              }
              const data = event.clipboardData;
              if (!data || data.getData('text/html')) {
                return false;
              }
              const blocks = markdownBlocks(data.getData('text/plain'), view.state.schema);
              if (!blocks) {
                return false;
              }
              const fragment = Fragment.fromArray(blocks.map((node) => view.state.schema.nodeFromJSON(node)));
              view.dispatch(
                view.state.tr
                  .replaceSelection(new Slice(fragment, 0, 0))
                  .setMeta('paste', true)
                  .setMeta('uiEvent', 'paste')
                  .scrollIntoView(),
              );
              return true;
            },
          },
        }),
      ];
    },
  });
}
