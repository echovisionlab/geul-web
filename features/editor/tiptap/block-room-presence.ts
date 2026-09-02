import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Awareness } from 'y-protocols/awareness';
import type { CollaborationUser } from './collaboration';

const presencePluginKey = new PluginKey<DecorationSet>('blockRoomPresence');
const PRESENCE_META = 'blockRoomPresenceUpdate';
const hexColor = /^#[0-9a-f]{6}$/i;

interface BlockSelectionPoint {
  readonly blockId: string;
  readonly offset: number;
}

interface BlockRoomCursor {
  readonly anchor: BlockSelectionPoint;
  readonly head: BlockSelectionPoint;
}

interface BlockPosition {
  readonly node: ProseMirrorNode;
  readonly position: number;
}

function normalizeUser(user: CollaborationUser): CollaborationUser {
  const name = user.name.trim();
  if (!name || !hexColor.test(user.color)) {
    throw new Error('Typed Block-room presence requires a name and six-digit hex color.');
  }
  return { name, color: user.color.toLowerCase() };
}

function blockPoint(position: ResolvedPos): BlockSelectionPoint | null {
  for (let depth = position.depth; depth > 0; depth -= 1) {
    const node = position.node(depth);
    if (node.type.name !== 'blockContainer' || typeof node.attrs.id !== 'string') {
      continue;
    }
    const start = position.before(depth);
    return {
      blockId: node.attrs.id,
      offset: Math.min(Math.max(position.pos - start - 1, 0), node.content.size),
    };
  }
  if (position.parent.type.name === 'blockGroup') {
    const before = position.nodeBefore;
    if (before?.type.name === 'blockContainer' && typeof before.attrs.id === 'string') {
      return { blockId: before.attrs.id, offset: before.content.size + 1 };
    }
    const after = position.nodeAfter;
    if (after?.type.name === 'blockContainer' && typeof after.attrs.id === 'string') {
      return { blockId: after.attrs.id, offset: -1 };
    }
  }
  return null;
}

function cursorForSelection(selection: Selection): BlockRoomCursor | null {
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === 'blockContainer' &&
    typeof selection.node.attrs.id === 'string'
  ) {
    const point = { blockId: selection.node.attrs.id, offset: 0 };
    return { anchor: point, head: point };
  }
  const anchor = blockPoint(selection.$anchor);
  const head = blockPoint(selection.$head);
  return anchor && head ? { anchor, head } : null;
}

function sameCursor(left: unknown, right: BlockRoomCursor | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  if (!left || typeof left !== 'object') {
    return false;
  }
  const cursor = left as Partial<BlockRoomCursor>;
  return (
    cursor.anchor?.blockId === right.anchor.blockId &&
    cursor.anchor.offset === right.anchor.offset &&
    cursor.head?.blockId === right.head.blockId &&
    cursor.head.offset === right.head.offset
  );
}

function blocksById(document: ProseMirrorNode): ReadonlyMap<string, BlockPosition> {
  const blocks = new Map<string, BlockPosition>();
  document.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && typeof node.attrs.id === 'string') {
      blocks.set(node.attrs.id, { node, position });
      return true;
    }
    return true;
  });
  return blocks;
}

function resolvePoint(blocks: ReadonlyMap<string, BlockPosition>, point: BlockSelectionPoint): number | null {
  const block = blocks.get(point.blockId);
  if (!block || !Number.isSafeInteger(point.offset)) {
    return null;
  }
  return block.position + 1 + Math.min(Math.max(point.offset, -1), block.node.content.size + 1);
}

function cursorDecorations(document: ProseMirrorNode, awareness: Awareness): DecorationSet {
  const blocks = blocksById(document);
  const decorations: Decoration[] = [];
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === awareness.clientID || !state?.geulBlockCursor || !state.user) {
      continue;
    }
    const cursor = state.geulBlockCursor as BlockRoomCursor;
    const anchor = resolvePoint(blocks, cursor.anchor);
    const head = resolvePoint(blocks, cursor.head);
    if (anchor === null || head === null) {
      continue;
    }
    const color =
      typeof state.user.color === 'string' && hexColor.test(state.user.color) ? state.user.color : '#666666';
    const name = typeof state.user.name === 'string' ? state.user.name : '';
    if (anchor !== head) {
      decorations.push(
        Decoration.inline(Math.min(anchor, head), Math.max(anchor, head), {
          class: 'block-room-selection',
          style: `background-color: ${color}33`,
        }),
      );
    }
    decorations.push(
      Decoration.widget(
        head,
        () => {
          const caret = documentNode('span', 'block-room-cursor');
          caret.style.borderLeft = `2px solid ${color}`;
          caret.style.marginLeft = '-1px';
          caret.style.position = 'relative';
          const label = documentNode('span', 'block-room-cursor-label');
          label.style.backgroundColor = color;
          label.style.color = '#ffffff';
          label.style.fontSize = '11px';
          label.style.left = '-2px';
          label.style.padding = '1px 4px';
          label.style.position = 'absolute';
          label.style.top = '-1.4em';
          label.style.whiteSpace = 'nowrap';
          label.textContent = name;
          caret.append(label);
          return caret;
        },
        { key: `block-room-cursor-${clientId}`, side: -1 },
      ),
    );
  }
  return DecorationSet.create(document, decorations);
}

function documentNode(tag: string, className: string): HTMLElement {
  const element = globalThis.document.createElement(tag);
  element.className = className;
  return element;
}

export function createBlockRoomPresenceExtension(awareness: Awareness, localUser: CollaborationUser) {
  const user = normalizeUser(localUser);
  return Extension.create({
    name: 'blockRoomPresence',
    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: presencePluginKey,
          state: {
            init: (_, state) => cursorDecorations(state.doc, awareness),
            apply: (transaction, decorations, _oldState, newState) =>
              transaction.docChanged || transaction.getMeta(PRESENCE_META)
                ? cursorDecorations(newState.doc, awareness)
                : decorations.map(transaction.mapping, transaction.doc),
          },
          props: {
            decorations: (state) => presencePluginKey.getState(state) ?? null,
          },
          view(view) {
            let publishTimer: ReturnType<typeof setTimeout> | null = null;
            let refreshTimer: ReturnType<typeof setTimeout> | null = null;
            const publishNow = () => {
              const cursor = cursorForSelection(view.state.selection);
              const state = awareness.getLocalState() ?? {};
              const currentUser = state.user as Partial<CollaborationUser> | undefined;
              if (
                currentUser?.name === user.name &&
                currentUser.color === user.color &&
                sameCursor(state.geulBlockCursor, cursor)
              ) {
                return;
              }
              awareness.setLocalState({ ...state, user, geulBlockCursor: cursor });
            };
            const publish = () => {
              if (publishTimer !== null) {
                return;
              }
              publishTimer = setTimeout(() => {
                publishTimer = null;
                if (!view.isDestroyed) {
                  publishNow();
                }
              }, 16);
            };
            const refreshNow = () => {
              if (!view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(PRESENCE_META, true).setMeta('addToHistory', false));
              }
            };
            const refresh = () => {
              if (refreshTimer !== null) {
                return;
              }
              refreshTimer = setTimeout(() => {
                refreshTimer = null;
                refreshNow();
              }, 16);
            };
            publishNow();
            awareness.on('change', refresh);
            return {
              update: publish,
              destroy() {
                awareness.off('change', refresh);
                if (publishTimer !== null) {
                  clearTimeout(publishTimer);
                  publishTimer = null;
                  publishNow();
                }
                if (refreshTimer !== null) {
                  clearTimeout(refreshTimer);
                  refreshTimer = null;
                }
                const state = awareness.getLocalState();
                if (state) {
                  awareness.setLocalState({ ...state, user: null, geulBlockCursor: null });
                }
              },
            };
          },
        }),
      ];
    },
  });
}
