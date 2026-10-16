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

// Interpret only explicit break tags; other pasted HTML remains inert text.
function remarkInlineBreaks() {
  return (tree: { children?: unknown[] }) => {
    const visit = (node: { children?: unknown[]; type?: string; value?: string }) => {
      if (!node.children) {
        return;
      }
      node.children = node.children.flatMap<unknown>((child) => {
        const value = child as { children?: unknown[]; type?: string; value?: string };
        if (value.type === 'html' && /^(?:<br\s*\/?>\s*)+$/iu.test(value.value ?? '')) {
          return Array.from((value.value ?? '').matchAll(/<br\s*\/?>/giu), () => ({ type: 'break' }));
        }
        visit(value);
        return value;
      });
    };
    visit(tree);
  };
}

/** Reuse the installed CommonMark/GFM pipeline; only explicit br tags are interpreted. */
export function markdownBlocks(text: string, schema: Schema): JSONContent[] | null {
  const tree = Markdown({ children: text, remarkPlugins: [remarkGfm, remarkInlineBreaks], skipHtml: false });
  let unsupported = false;
  const inline = (value: ReactNode, marks: NonNullable<JSONContent['marks']> = []): JSONContent[] => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value)
        .split(/\r\n|\r|\n/)
        .flatMap((text, index) => [
          ...(index ? [{ type: 'hardBreak' }] : []),
          ...(text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : []),
        ]);
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
      nextMarks = [
        ...marks,
        { type: mark, ...(mark === 'link' ? { attrs: { href: propsOf(value).href ?? '' } } : {}) },
      ];
    }
    return inlineSequence(children(propsOf(value).children), nextMarks);
  };
  const inlineSequence = (parts: ReactNode[], marks: NonNullable<JSONContent['marks']> = []) =>
    parts.flatMap((child, index) =>
      inline(typeof child === 'string' && tag(parts[index - 1]) === 'br' ? child.replace(/^\n/, '') : child, marks),
    );
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
          const content = inlineSequence(inlineParts);
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
      return [block('heading', inline(value), { level: Math.min(3, Number(type[1])) })];
    }
    if (type === 'blockquote') {
      return parts
        .filter((part) => tag(part) || textOf(part).trim())
        .flatMap((part) => (tag(part) === 'p' ? [block('quote', inline(part))] : convert(part)));
    }
    if (type === 'pre') {
      const code = parts.find((part) => tag(part) === 'code');
      const source = textOf(code).replace(/\n$/, '');
      return [
        block('codeBlock', source ? [{ type: 'text', text: source }] : [], {
          language: propsOf(code).className?.replace(/^language-/, '') ?? 'plaintext',
        }),
      ];
    }
    if (type === 'hr') {
      return [block('divider')];
    }
    if (type === 'table' && !schema.nodes.table) {
      unsupported = true;
      return [];
    }
    if (type === 'table' && schema.nodes.table) {
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
  if (unsupported || result.length === 0) {
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

/** Plain fallback preserves literal unsupported Markdown and the same newline policy. */
export function plainTextBlocks(text: string): JSONContent[] {
  return text
    .replace(/\r\n|\r/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => ({
      type: 'blockContainer',
      attrs: { id: crypto.randomUUID() },
      content: [
        {
          type: 'paragraph',
          content: paragraph
            .split('\n')
            .flatMap((line, index) => [
              ...(index ? [{ type: 'hardBreak' }] : []),
              ...(line ? [{ type: 'text', text: line }] : []),
            ]),
        },
      ],
    }));
}

function pasteSlice(blocks: JSONContent[], schema: Schema, inlineContext: boolean): Slice {
  const paragraph = blocks.length === 1 ? blocks[0]?.content?.[0] : undefined;
  // Keep the destination heading/list kind when inserting a single paragraph.
  if (inlineContext && paragraph?.type === 'paragraph') {
    return new Slice(Fragment.fromArray((paragraph.content ?? []).map((node) => schema.nodeFromJSON(node))), 0, 0);
  }
  const fragment = Fragment.fromArray(blocks.map((node) => schema.nodeFromJSON(node)));
  return blocks[0]?.content?.[0]?.type === 'paragraph' ? Slice.maxOpen(fragment) : new Slice(fragment, 0, 0);
}

export function createMarkdownPasteExtension(canChangeStructure: () => boolean) {
  return Extension.create({
    name: 'markdownPaste',
    priority: 900,
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            clipboardTextParser: (text, $context) => {
              return pasteSlice(plainTextBlocks(text), $context.doc.type.schema, $context.parent.inlineContent);
            },
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
              const text = data.getData('text/plain');
              const blocks = markdownBlocks(text, view.state.schema) ?? plainTextBlocks(text);
              if (!blocks.length) {
                return false;
              }
              view.dispatch(
                view.state.tr
                  .replaceSelection(
                    pasteSlice(blocks, view.state.schema, view.state.selection.$from.parent.inlineContent),
                  )
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
