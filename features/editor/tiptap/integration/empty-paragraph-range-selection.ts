import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isTextRangeSelection } from './block-mixed-selection';

const EMPTY_PARAGRAPH_RANGE_SELECTED = 'tiptap-empty-paragraph-range-selected';
const emptyParagraphRangeSelectionKey = new PluginKey<DecorationSet>('emptyParagraphRangeSelection');

function emptyParagraphDecorations(state: EditorState): DecorationSet {
  const { selection } = state;
  if (!isTextRangeSelection(selection) || selection.empty) {
    return DecorationSet.empty;
  }
  const decorations: Decoration[] = [];
  state.doc.descendants((node, position) => {
    if (node.type.name !== 'paragraph' || node.content.size !== 0) {
      return true;
    }
    const contentPosition = position + 1;
    if (selection.from <= contentPosition && contentPosition <= selection.to) {
      decorations.push(
        Decoration.node(position, position + node.nodeSize, {
          class: EMPTY_PARAGRAPH_RANGE_SELECTED,
          'data-empty-paragraph-range-selected': 'true',
        }),
      );
    }
    return false;
  });
  return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty;
}

/**
 * Native selections have no glyph to paint for an empty Paragraph. Mark every
 * empty line crossed by a text range so Firefox and Chromium expose the same
 * visible multi-block selection boundary.
 */
export const EmptyParagraphRangeSelection = Extension.create({
  name: 'emptyParagraphRangeSelection',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: emptyParagraphRangeSelectionKey,
        state: {
          init: (_, state) => emptyParagraphDecorations(state),
          apply: (transaction, decorations, _oldState, newState) =>
            transaction.docChanged || transaction.selectionSet
              ? emptyParagraphDecorations(newState)
              : decorations.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations: (state) => emptyParagraphRangeSelectionKey.getState(state) ?? null,
        },
      }),
    ];
  },
});
