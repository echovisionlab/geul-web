import { relativeBlockPoint, resolveRelativeBlockPoint } from './block-room-text-positions';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Awareness } from 'y-protocols/awareness';
import type { CollaborationUser } from './block-room-presence-types';

const presencePluginKey = new PluginKey<DecorationSet>('blockRoomPresence');
const PRESENCE_META = 'blockRoomPresenceUpdate';
const hexColor = /^#[0-9a-f]{6}$/i;

interface BlockSelectionPoint {
  readonly blockId: string;
  readonly offset: number;
  readonly relative?: number[];
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

function blockPoint(position: ResolvedPos, awareness: Awareness): BlockSelectionPoint | null {
  for (let depth = position.depth; depth > 0; depth -= 1) {
    const node = position.node(depth);
    if (node.type.name !== 'blockContainer' || typeof node.attrs.id !== 'string') {
      continue;
    }
    const start = position.before(depth);
    return {
      blockId: node.attrs.id,
      offset: Math.min(Math.max(position.pos - start - 1, 0), node.content.size),
      relative: relativeBlockPoint(awareness.doc, node.attrs.id, node, position.pos - start - 1),
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

function cursorForSelection(selection: Selection, awareness: Awareness): BlockRoomCursor | null {
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === 'blockContainer' &&
    typeof selection.node.attrs.id === 'string'
  ) {
    const point = { blockId: selection.node.attrs.id, offset: 0 };
    return { anchor: point, head: point };
  }
  const anchor = blockPoint(selection.$anchor, awareness);
  const head = blockPoint(selection.$head, awareness);
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
    JSON.stringify(cursor.anchor.relative) === JSON.stringify(right.anchor.relative) &&
    cursor.head?.blockId === right.head.blockId &&
    cursor.head.offset === right.head.offset &&
    JSON.stringify(cursor.head.relative) === JSON.stringify(right.head.relative)
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

function resolvePoint(
  blocks: ReadonlyMap<string, BlockPosition>,
  point: BlockSelectionPoint | undefined,
  awareness: Awareness,
): number | null {
  if (!point || typeof point.blockId !== 'string') {
    return null;
  }
  const block = blocks.get(point.blockId);
  if (!block || !Number.isSafeInteger(point.offset)) {
    return null;
  }
  if (point.relative !== undefined) {
    const offset = resolveRelativeBlockPoint(awareness.doc, point.blockId, block.node, point.relative);
    return offset === null ? null : block.position + 1 + offset;
  }
  return block.position + 1 + Math.min(Math.max(point.offset, -1), block.node.content.size + 1);
}

function cursorDecorations(
  document: ProseMirrorNode,
  awareness: Awareness,
  blocks: ReadonlyMap<string, BlockPosition>,
  clients?: ReadonlySet<number>,
): DecorationSet {
  const decorations: Decoration[] = [];
  for (const [clientId, state] of awareness.getStates()) {
    if (
      (clients && !clients.has(clientId)) ||
      clientId === awareness.clientID ||
      !state?.geulBlockCursor ||
      !state.user
    ) {
      continue;
    }
    const cursor = state.geulBlockCursor as BlockRoomCursor;
    const anchor = resolvePoint(blocks, cursor.anchor, awareness);
    const head = resolvePoint(blocks, cursor.head, awareness);
    if (anchor === null || head === null) {
      continue;
    }
    const color =
      typeof state.user.color === 'string' && hexColor.test(state.user.color)
        ? state.user.color
        : primitiveTokens.colors.neutral[700];
    const name = typeof state.user.name === 'string' ? state.user.name : '';
    if (anchor !== head) {
      decorations.push(
        Decoration.inline(
          Math.min(anchor, head),
          Math.max(anchor, head),
          {
            class: 'block-room-selection',
            style: `background-color: ${color}33`,
          },
          { clientId },
        ),
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
          label.style.color = primitiveTokens.colors.white;
          label.style.fontSize = 'var(--geul-font-size-xs)';
          label.style.lineHeight = 'var(--geul-line-height-xs)';
          label.style.left = '-2px';
          label.style.padding = '1px 4px';
          label.style.position = 'absolute';
          label.style.top = '-1.4em';
          label.style.whiteSpace = 'nowrap';
          label.textContent = name;
          caret.append(label);
          return caret;
        },
        // A stable peer ID alone would reuse the old DOM when identity metadata changes.
        { key: JSON.stringify(['block-room-cursor', clientId, color, name]), side: -1, clientId },
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

export function createBlockRoomPresenceExtension(
  awareness: Awareness,
  localUser: CollaborationUser,
  readUser = () => localUser,
) {
  normalizeUser(localUser);
  return Extension.create({
    name: 'blockRoomPresence',
    addProseMirrorPlugins() {
      let blocks: ReadonlyMap<string, BlockPosition>;
      return [
        new Plugin<DecorationSet>({
          key: presencePluginKey,
          state: {
            init: (_, state) => {
              blocks = blocksById(state.doc);
              return cursorDecorations(state.doc, awareness, blocks);
            },
            apply: (transaction, decorations) => {
              const mapped = decorations.map(transaction.mapping, transaction.doc);
              if (transaction.docChanged) {
                blocks = blocksById(transaction.doc);
                // Local edits precede the Yjs write; PM mapping is authoritative here.
                if (!transaction.getMeta('blockRoomProjection')) {
                  return mapped;
                }
                const changedIds = transaction.getMeta('blockRoomChangedIds') as ReadonlySet<string> | null;
                if (!changedIds) {
                  return cursorDecorations(transaction.doc, awareness, blocks);
                }
                const clients = new Set<number>();
                for (const [id, state] of awareness.getStates()) {
                  const cursor = state.geulBlockCursor as Partial<BlockRoomCursor> | undefined;
                  if (
                    cursor?.anchor &&
                    cursor.head &&
                    (changedIds.has(cursor.anchor.blockId) || changedIds.has(cursor.head.blockId))
                  ) {
                    clients.add(id);
                  }
                }
                return mapped
                  .remove(mapped.find(undefined, undefined, (spec) => clients.has(spec.clientId)))
                  .add(transaction.doc, cursorDecorations(transaction.doc, awareness, blocks, clients).find());
              }
              const clients = transaction.getMeta(PRESENCE_META) as Set<number> | undefined;
              if (!clients?.size) {
                return mapped;
              }
              const removed = mapped.find(undefined, undefined, (spec) => clients.has(spec.clientId));
              return mapped
                .remove(removed)
                .add(transaction.doc, cursorDecorations(transaction.doc, awareness, blocks, clients).find());
            },
          },
          props: {
            decorations: (state) => presencePluginKey.getState(state) ?? null,
          },
          view(view) {
            let publishTimer: ReturnType<typeof setTimeout> | null = null;
            let refreshTimer: ReturnType<typeof setTimeout> | null = null;
            let publishDeadline = Infinity;
            let lastCaretPublish = -Infinity;
            let lastPassivePublish = -Infinity;
            let unanchoredRetry = false;
            let deferredPublish = false;
            const publishNow = () => {
              if (view.composing || view.isDestroyed) {
                return;
              }
              const user = normalizeUser(readUser());
              const cursor = cursorForSelection(view.state.selection, awareness);
              const state = awareness.getLocalState() ?? {};
              const currentUser = state.user as Partial<CollaborationUser> | undefined;
              const userChanged = currentUser?.name !== user.name || currentUser.color !== user.color;
              const cursorChanged = !sameCursor(state.geulBlockCursor, cursor);
              const now = Date.now();
              const publishUser = userChanged && now - lastPassivePublish >= 1000;
              const publishCursor = cursorChanged && now - lastCaretPublish >= 100;
              if (publishUser || publishCursor) {
                if (publishUser) {
                  lastPassivePublish = now;
                }
                if (publishCursor) {
                  lastCaretPublish = now;
                }
                awareness.setLocalState({
                  ...state,
                  user: publishUser ? user : state.user,
                  geulBlockCursor: publishCursor ? cursor : state.geulBlockCursor,
                });
              }
              const delays = [
                ...(userChanged && !publishUser ? [lastPassivePublish + 1000 - now] : []),
                ...(cursorChanged && !publishCursor ? [lastCaretPublish + 100 - now] : []),
              ];
              // A text point resolves against Yjs; until the edit reaches Yjs it carries only an
              // absolute offset. Correct it once within the caret window rather than leave it.
              const unanchored =
                publishCursor &&
                cursor !== null &&
                !(view.state.selection instanceof NodeSelection) &&
                (!cursor.anchor.relative || !cursor.head.relative);
              if (unanchored && !unanchoredRetry) {
                unanchoredRetry = true;
                delays.push(100);
              } else if (!unanchored) {
                unanchoredRetry = false;
              }
              const deadline = delays.length ? now + Math.max(0, Math.min(...delays)) : Infinity;
              if (deadline < publishDeadline) {
                if (publishTimer !== null) {
                  clearTimeout(publishTimer);
                }
                publishDeadline = deadline;
                publishTimer = setTimeout(() => {
                  publishTimer = null;
                  publishDeadline = Infinity;
                  publishNow();
                }, deadline - now);
              }
            };
            // Only bring a pending deadline forward; never reset a fixed window.
            const publish = () => publishNow();
            const pendingClients = new Set<number>();
            const refreshNow = () => {
              if (!view.isDestroyed && !view.composing) {
                const clients = new Set(pendingClients);
                pendingClients.clear();
                view.dispatch(view.state.tr.setMeta(PRESENCE_META, clients).setMeta('addToHistory', false));
              }
            };
            const refresh = (change: { added: number[]; updated: number[]; removed: number[] }) => {
              for (const id of [...change.added, ...change.updated, ...change.removed]) {
                if (id !== awareness.clientID) {
                  pendingClients.add(id);
                }
              }
              if (refreshTimer !== null) {
                return;
              }
              refreshTimer = setTimeout(() => {
                refreshTimer = null;
                refreshNow();
              }, 16);
            };
            let previousBlocks = blocks;
            publishNow();
            awareness.on('change', refresh);
            return {
              update(_view, previousState) {
                if (view.state.doc === previousState.doc) {
                  publish();
                } else if (!deferredPublish) {
                  // Local edits reach Yjs in the same dispatch, after plugin views update.
                  deferredPublish = true;
                  queueMicrotask(() => {
                    deferredPublish = false;
                    if (!view.isDestroyed) {
                      publish();
                    }
                  });
                }
                if (previousBlocks !== blocks) {
                  // Local PM transactions reach Yjs after plugin view.update. Resolve
                  // their affected anchors on the next tick, after that write commits.
                  for (const [id, state] of awareness.getStates()) {
                    const cursor = state.geulBlockCursor as Partial<BlockRoomCursor> | undefined;
                    if (id === awareness.clientID || !cursor?.anchor || !cursor.head) {
                      continue;
                    }
                    if (
                      [cursor.anchor.blockId, cursor.head.blockId].some(
                        (blockId) => previousBlocks.get(blockId)?.node !== blocks.get(blockId)?.node,
                      )
                    ) {
                      pendingClients.add(id);
                    }
                  }
                  previousBlocks = blocks;
                }
                if (pendingClients.size) {
                  refresh({ added: [], updated: [], removed: [] });
                }
              },
              destroy() {
                awareness.off('change', refresh);
                if (publishTimer !== null) {
                  clearTimeout(publishTimer);
                  publishTimer = null;
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
