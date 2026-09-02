import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Awareness } from 'y-protocols/awareness';
import { UndoManager, type XmlFragment } from 'yjs';
import {
  redoCommand,
  undoCommand,
  updateYFragment,
  yCursorPlugin,
  ySyncPlugin,
  ySyncPluginKey,
  yUndoPlugin,
} from 'y-prosemirror';

const hexColor = /^#[0-9a-f]{6}$/i;
const selectionSafeBindings = new WeakSet<object>();

type YFragmentBindingMetadata = Parameters<typeof updateYFragment>[3];

interface YSyncBindingWithRerender extends YFragmentBindingMetadata {
  beforeTransactionSelection: unknown | null;
  doc: NonNullable<XmlFragment['doc']>;
  mux: (callback: () => void) => void;
  prosemirrorView: EditorView | null;
  type: XmlFragment;
  _forceRerender: () => void;
}

function assertYSyncBindingWithRerender(binding: unknown): asserts binding is YSyncBindingWithRerender {
  if (
    !binding ||
    typeof binding !== 'object' ||
    !('beforeTransactionSelection' in binding) ||
    !('prosemirrorView' in binding) ||
    !('doc' in binding) ||
    !('type' in binding) ||
    !('mapping' in binding) ||
    !('isOMark' in binding) ||
    !('mux' in binding) ||
    typeof binding.mux !== 'function' ||
    !('_forceRerender' in binding) ||
    typeof binding._forceRerender !== 'function'
  ) {
    throw new Error('Unsupported y-prosemirror sync binding: selection-safe rerender contract changed.');
  }
}

/**
 * Applies an ownership projection through the live y-prosemirror mapping.
 * The non-editor origin keeps this system change out of the collaborator's
 * fragment-scoped UndoManager while preserving Yjs item identity where the
 * mapped ProseMirror structure is unchanged.
 */
export function replaceCollaborationDocument(editor: Editor, document: ProseMirrorNode, origin: string): boolean {
  if (editor.state.doc.eq(document)) {
    return false;
  }
  const binding: unknown = ySyncPluginKey.getState(editor.state)?.binding;
  assertYSyncBindingWithRerender(binding);
  binding.doc.transact(() => {
    updateYFragment(binding.doc, binding.type, document, binding);
  }, origin);
  return true;
}

export interface CollaborationUser {
  /** Display name published through Yjs awareness for collaborator cursors. */
  name: string;
  /** Six-digit hex color used for the collaborator cursor and selection. */
  color: string;
}

export interface CollaborationOptions {
  fragment: XmlFragment;
  awareness?: Awareness;
  /**
   * The authenticated collaborator represented by this editor binding.
   *
   * This is intentionally supplied by the owning editor/session boundary: a
   * document fragment cannot authoritatively identify the current member.
   */
  localUser?: CollaborationUser;
}

function normalizeLocalUser(user: CollaborationUser): CollaborationUser {
  const name = user.name.trim();
  if (!name) {
    throw new Error('Tiptap collaboration awareness requires a non-empty local user name.');
  }
  if (!hexColor.test(user.color)) {
    throw new Error('Tiptap collaboration awareness color must be a six-digit hex color (#RRGGBB).');
  }
  return { name, color: user.color.toLowerCase() };
}

function sameUser(left: unknown, right: CollaborationUser): boolean {
  if (!left || typeof left !== 'object') {
    return false;
  }
  const user = left as Partial<CollaborationUser>;
  return user.name === right.name && user.color === right.color;
}

/**
 * Owns only the local awareness `user` field. Cursor lifecycle remains owned
 * by yCursorPlugin, which clears the cursor on blur and editor destruction.
 */
function localAwarenessUserPlugin(awareness: Awareness, user: CollaborationUser): Plugin {
  return new Plugin({
    view() {
      const publishUser = () => {
        if (!sameUser(awareness.getLocalState()?.user, user)) {
          awareness.setLocalStateField('user', user);
        }
      };

      // Re-assert the local identity after an awareness reconnect/update. This
      // keeps the cursor label stable without taking ownership of other fields.
      const onAwarenessUpdate = () => publishUser();
      publishUser();
      awareness.on('update', onAwarenessUpdate);

      return {
        update: publishUser,
        destroy: () => {
          awareness.off('update', onAwarenessUpdate);
          if (sameUser(awareness.getLocalState()?.user, user)) {
            awareness.setLocalStateField('user', null);
          }
        },
      };
    },
  });
}

/**
 * A Y.UndoManager is deliberately scoped to this shared XML fragment and
 * tracks only transactions emitted by this editor's ySync plugin. Remote Yjs
 * updates and server/system projections use other origins, so cannot enter a
 * collaborator's undo stack.
 */
function createLocalUndoManager(fragment: XmlFragment): UndoManager {
  return new UndoManager(fragment, {
    trackedOrigins: new Set([ySyncPluginKey]),
  });
}

/**
 * y-prosemirror 1.3.7 restores the numeric endpoints captured before its
 * initial fragment replacement with TextSelection.create(). The document
 * starts with blockGroup/blockContainer wrappers, so a valid old endpoint can
 * point at a non-inline wrapper in the replacement document.
 *
 * Resolve the selection's own bookmark instead. Text, node, and table-cell
 * bookmarks each validate their target and provide a schema-safe fallback.
 * This private compatibility boundary is runtime-guarded above and the
 * dependency is pinned to y-prosemirror 1.3.7.
 */
function makeForceRerenderSelectionSafe(binding: YSyncBindingWithRerender) {
  if (selectionSafeBindings.has(binding)) {
    return;
  }
  selectionSafeBindings.add(binding);

  const forceRerender = binding._forceRerender.bind(binding);
  binding._forceRerender = () => {
    const view = binding.prosemirrorView;
    if (!view || binding.beforeTransactionSelection !== null) {
      forceRerender();
      return;
    }

    const previousSelection = view.state.selection;
    const bookmark = previousSelection.getBookmark();
    const previousBeforeTransactionSelection = binding.beforeTransactionSelection;

    // Suppress y-prosemirror's TextSelection.create() restoration. The
    // document replacement itself remains entirely owned by ySyncPlugin.
    binding.beforeTransactionSelection = {};
    try {
      forceRerender();
    } finally {
      binding.beforeTransactionSelection = previousBeforeTransactionSelection;
    }

    const nextView = binding.prosemirrorView;
    if (!nextView) {
      return;
    }

    let selection: Selection;
    try {
      selection = bookmark.resolve(nextView.state.doc);
    } catch {
      const position = Math.min(Math.max(previousSelection.head, 0), nextView.state.doc.content.size);
      const bias = previousSelection.head < previousSelection.anchor ? -1 : 1;
      selection = Selection.near(nextView.state.doc.resolve(position), bias);
    }

    if (!selection.eq(nextView.state.selection)) {
      // Keep this selection-only dispatch inside the binding mutex so the
      // ySync view does not open an empty Yjs transaction for it.
      binding.mux(() => {
        nextView.dispatch(nextView.state.tr.setSelection(selection).setMeta('addToHistory', false));
      });
    }
  };
}

function createSelectionSafeYSyncPlugin(fragment: XmlFragment): Plugin {
  const syncPlugin = ySyncPlugin(fragment) as Plugin;
  const syncView = syncPlugin.spec.view;
  if (typeof syncView !== 'function') {
    throw new Error('Unsupported y-prosemirror sync plugin: selection-safe view contract changed.');
  }

  return new Plugin({
    ...syncPlugin.spec,
    view(view) {
      const binding: unknown = ySyncPluginKey.getState(view.state)?.binding;
      assertYSyncBindingWithRerender(binding);
      makeForceRerenderSelectionSafe(binding);
      return syncView.call(syncPlugin, view);
    },
  });
}

/**
 * Binds Tiptap directly to the existing Y.XmlFragment authority.
 * ProseMirror history is intentionally absent; Yjs owns collaborative undo.
 */
export function createCollaborationExtension({ fragment, awareness, localUser }: CollaborationOptions) {
  if (localUser && !awareness) {
    throw new Error('Tiptap collaboration localUser requires an awareness instance.');
  }
  const normalizedLocalUser = localUser ? normalizeLocalUser(localUser) : undefined;

  return Extension.create({
    name: 'collaboration',
    priority: 1000,
    addKeyboardShortcuts() {
      return {
        'Mod-z': () => undoCommand(this.editor.state, this.editor.view.dispatch),
        'Mod-Shift-z': () => redoCommand(this.editor.state, this.editor.view.dispatch),
        'Mod-y': () => redoCommand(this.editor.state, this.editor.view.dispatch),
      };
    },
    addProseMirrorPlugins() {
      return [
        createSelectionSafeYSyncPlugin(fragment),
        yUndoPlugin({ undoManager: createLocalUndoManager(fragment) }),
        ...(awareness ? [yCursorPlugin(awareness)] : []),
        ...(awareness && normalizedLocalUser ? [localAwarenessUserPlugin(awareness, normalizedLocalUser)] : []),
      ];
    },
  });
}
