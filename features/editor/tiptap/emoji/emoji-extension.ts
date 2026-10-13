import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  InputRule,
  isFirefox,
  mergeAttributes,
  Node,
  PasteRule,
} from '@tiptap/core';
import { DOMSerializer, type DOMOutputSpec, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import {
  emojiTextForName,
  getTiptapEmojiData,
  requestTiptapEmojiData,
  subscribeTiptapEmojiData,
  type TiptapEmojiData,
} from './emoji-runtime';

export { emojiTextForName };

export interface GeulTiptapEmojiOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

export const EmojiSuggestionPluginKey = new PluginKey('emojiSuggestion');
const inputRegex = /:([a-zA-Z0-9_+-]+):$/;
const pasteRegex = /(^|\s):([a-zA-Z0-9_+-]+):/g;
const emojiCandidate = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

function emojiDomSpec(name: string, attributes: Record<string, unknown>, data: TiptapEmojiData | null): DOMOutputSpec {
  const item = data?.find(name);
  if (!item) {
    return ['span', attributes, `:${name}:`];
  }
  // Geul strips Tiptap's third-party fallback images, so an item always renders its Unicode text.
  return ['span', attributes, item.emoji || `:${item.shortcodes[0]}:`];
}

function documentHasEmoji(doc: ProseMirrorNode, typeName: string): boolean {
  let found = false;
  doc.descendants((node) => {
    found ||= node.type.name === typeName;
    return !found;
  });
  return found;
}

/**
 * Schema- and behaviour-compatible replacement for `@tiptap/extension-emoji` without its bundled
 * data set. The data loads on demand (editor focus, `:` suggestion, picker, or an Emoji node in the
 * document); shortcode and Unicode conversion apply once it has loaded.
 */
export const GeulTiptapEmoji = Node.create<GeulTiptapEmojiOptions>({
  name: 'emoji',
  inline: true,
  group: 'inline',
  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: ':',
        pluginKey: EmojiSuggestionPluginKey,
        items: () => {
          requestTiptapEmojiData();
          return [];
        },
        command: ({ editor, range, props }) => {
          const nodeAfter = editor.view.state.selection.$to.nodeAfter;
          if (nodeAfter?.text?.startsWith(' ')) {
            range.to += 1;
          }
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: this.name, attrs: props },
              { type: 'text', text: ' ' },
            ])
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 2).marks());
              return true;
            })
            .run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          return Boolean(type && $from.parent.type.contentMatch.matchType(type));
        },
      },
    };
  },

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.dataset.name,
        renderHTML: (attributes) => ({ 'data-name': attributes.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return emojiDomSpec(
      String(node.attrs.name),
      mergeAttributes(HTMLAttributes, this.options.HTMLAttributes, { 'data-type': this.name }),
      getTiptapEmojiData(),
    );
  },

  // Same DOM as renderHTML; it redraws once if the node exists before the data has loaded.
  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const name = String(node.attrs.name);
      const attributes = mergeAttributes(HTMLAttributes, this.options.HTMLAttributes, { 'data-type': this.name });
      const { dom } = DOMSerializer.renderSpec(document, emojiDomSpec(name, attributes, getTiptapEmojiData()));
      let unsubscribe: (() => void) | undefined;
      if (!getTiptapEmojiData()) {
        requestTiptapEmojiData();
        unsubscribe = subscribeTiptapEmojiData(() => {
          unsubscribe?.();
          unsubscribe = undefined;
          const { dom: loaded } = DOMSerializer.renderSpec(
            document,
            emojiDomSpec(name, attributes, getTiptapEmojiData()),
          );
          dom.textContent = loaded.textContent;
        });
      }
      return {
        dom,
        update: (updated) => updated.type === node.type && updated.attrs.name === node.attrs.name,
        destroy: () => unsubscribe?.(),
      };
    };
  },

  renderText({ node }) {
    return emojiTextForName(String(node.attrs.name)) || `:${node.attrs.name}:`;
  },

  renderMarkdown: (node) => (node.attrs?.name ? `:${node.attrs.name}:` : ''),

  addCommands() {
    return {
      setEmoji:
        (shortcode: string) =>
        ({ chain }) => {
          const emojiItem = getTiptapEmojiData()?.find(shortcode);
          if (!emojiItem) {
            requestTiptapEmojiData();
            return false;
          }
          chain()
            .insertContent({ type: this.name, attrs: { name: emojiItem.name } })
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 1).marks());
              return true;
            })
            .run();
          return true;
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: inputRegex,
        handler: ({ range, match, chain }) => {
          const name = match[1]!;
          if (!getTiptapEmojiData()?.find(name)) {
            requestTiptapEmojiData();
            return;
          }
          chain()
            .insertContentAt(range, { type: this.name, attrs: { name } })
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 1).marks());
              return true;
            })
            .run();
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: pasteRegex,
        handler: ({ range, match, chain }) => {
          const prefix = match[1] || '';
          const name = match[2]!;
          if (!getTiptapEmojiData()?.find(name)) {
            requestTiptapEmojiData();
            return;
          }
          chain()
            .insertContentAt(
              { from: range.from + prefix.length, to: range.to },
              { type: this.name, attrs: { name } },
              { updateSelection: false },
            )
            .command(({ tr, state }) => {
              tr.setStoredMarks(state.doc.resolve(state.selection.to - 1).marks());
              return true;
            })
            .run();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({ editor: this.editor, ...this.options.suggestion }),
      new Plugin({
        key: new PluginKey('emoji'),
        view: (view) => {
          if (view.hasFocus() || documentHasEmoji(view.state.doc, this.name)) {
            requestTiptapEmojiData();
          }
          return {};
        },
        props: {
          handleDOMEvents: {
            focus: () => {
              requestTiptapEmojiData();
              return false;
            },
          },
          // Firefox cannot move the cursor past emoji nodes at paragraph boundaries using arrow keys.
          // See: https://github.com/ProseMirror/prosemirror/issues/1220
          handleKeyDown: (view, event) => {
            if (!isFirefox()) {
              return false;
            }
            const isLeft = event.key === 'ArrowLeft';
            const isRight = event.key === 'ArrowRight';
            if ((!isLeft && !isRight) || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
              return false;
            }
            const { state } = view;
            const { selection } = state;
            if (!selection.empty || !(selection instanceof TextSelection)) {
              return false;
            }
            const $pos = selection.$from;
            if (isLeft) {
              const nodeBefore = $pos.nodeBefore;
              if (!nodeBefore || nodeBefore.type !== this.type) {
                return false;
              }
              const newPos = $pos.pos - nodeBefore.nodeSize;
              if (newPos >= $pos.start()) {
                view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, newPos)));
                return true;
              }
            } else {
              const nodeAfter = $pos.nodeAfter;
              if (!nodeAfter || nodeAfter.type !== this.type) {
                return false;
              }
              const newPos = $pos.pos + nodeAfter.nodeSize;
              if (newPos <= $pos.end()) {
                view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, newPos)));
                return true;
              }
            }
            return false;
          },
          // Double click does not select an Emoji node by default.
          handleDoubleClickOn: (_view, pos, node) => {
            if (node.type !== this.type) {
              return false;
            }
            this.editor.commands.setTextSelection({ from: pos, to: pos + node.nodeSize });
            return true;
          },
        },
        // Replace Unicode Emoji text with Emoji nodes on any change.
        appendTransaction: (transactions, oldState, newState) => {
          if (this.editor.view.composing) {
            return;
          }
          const docChanges =
            transactions.some((transaction) => transaction.docChanged) && !oldState.doc.eq(newState.doc);
          if (!docChanges) {
            return;
          }
          const data = getTiptapEmojiData();
          const { tr } = newState;
          const transform = combineTransactionSteps(oldState.doc, [...transactions]);
          const changes = getChangedRanges(transform);
          changes.forEach(({ newRange }) => {
            if (newState.doc.resolve(newRange.from).parent.type.spec.code) {
              return;
            }
            const textNodes = findChildrenInRange(newState.doc, newRange, (node) => node.isText);
            textNodes.forEach(({ node, pos }) => {
              if (!node.text) {
                return;
              }
              if (!data) {
                if (emojiCandidate.test(node.text)) {
                  requestTiptapEmojiData();
                }
                return;
              }
              const matches = [...node.text.matchAll(data.regex())];
              matches.forEach((match) => {
                if (match.index === undefined) {
                  return;
                }
                const emoji = match[0];
                const name = data.shortcodeFor(emoji);
                if (!name) {
                  return;
                }
                const from = tr.mapping.map(pos + match.index);
                if (newState.doc.resolve(from).parent.type.spec.code) {
                  return;
                }
                const to = from + emoji.length;
                tr.replaceRangeWith(from, to, this.type.create({ name }));
                tr.setStoredMarks(newState.doc.resolve(from).marks());
              });
            });
          });
          if (!tr.steps.length) {
            return;
          }
          return tr;
        },
      }),
    ];
  },
});
