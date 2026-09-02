import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { isSelectionInsideInlineMath } from './math-selection';

const BLOCK_MATH = /^\$\$([^$\n]+)\$\$$/;
const INLINE_MATH = /(?:^|[^$\\])\$([^$\n]+)\$$/;

function isInCodeContext(view: EditorView): boolean {
  const $from = view.state.selection.$from;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type.name === 'codeBlock') {
      return true;
    }
  }
  return $from.marks().some((mark) => mark.type.name === 'code');
}

function isInTable(view: EditorView): boolean {
  const $from = view.state.selection.$from;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === 'tableCell' || name === 'tableHeader') {
      return true;
    }
  }
  return false;
}

function textblockContext(view: EditorView): { depth: number; position: number; text: string } | null {
  const $from = view.state.selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.isTextblock) {
      const position = $from.before(depth);
      return {
        depth,
        position,
        text: view.state.doc.textBetween($from.start(depth), view.state.selection.from, '\0', '\0'),
      };
    }
  }
  return null;
}

export const TiptapMathInput = Extension.create({
  name: 'tiptapMathInput',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tiptapMathInput'),
        props: {
          handleTextInput: (view, _from, to, text) => {
            if (
              text !== '$' ||
              view.composing ||
              isInCodeContext(view) ||
              isSelectionInsideInlineMath(view.state.selection)
            ) {
              return false;
            }
            const context = textblockContext(view);
            if (!context) {
              return false;
            }
            const source = context.text + text;
            const atTextblockEnd =
              view.state.selection.empty && view.state.selection.from === view.state.selection.$from.end(context.depth);
            const blockMatch = atTextblockEnd && !isInTable(view) ? source.match(BLOCK_MATH) : null;
            if (blockMatch?.[1]?.trim()) {
              const math = view.state.schema.nodes.math;
              const targetNode = view.state.doc.nodeAt(context.position);
              const targetText = targetNode?.isTextblock
                ? targetNode.textBetween(0, targetNode.content.size, '\0', '\0')
                : null;
              if (!math || !targetNode || targetText !== context.text) {
                return false;
              }
              view.dispatch(
                view.state.tr.replaceWith(
                  context.position,
                  context.position + targetNode.nodeSize,
                  math.create({ latex: blockMatch[1].trim() }),
                ),
              );
              return true;
            }

            const inlineMatch = source.match(INLINE_MATH);
            const latex = inlineMatch?.[1]?.trim();
            const inline = view.state.schema.nodes.mathInline;
            if (!inlineMatch || !latex || !inline) {
              return false;
            }
            const prefixLength = inlineMatch[0].startsWith('$') ? 0 : 1;
            const matchStart = source.length - inlineMatch[0].length + prefixLength;
            const replaceFrom = view.state.selection.from - context.text.length + matchStart;
            view.dispatch(
              view.state.tr.replaceWith(replaceFrom, to, inline.create(null, view.state.schema.text(latex))),
            );
            return true;
          },
        },
      }),
    ];
  },
});
