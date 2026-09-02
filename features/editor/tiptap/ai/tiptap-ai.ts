import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { AIEditorContext } from '@/lib/editor/ai-support';

/** Document node kinds whose stable Block handles can be sent to DCDP. */
export const defaultTiptapAINodeTypes = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'codeBlock',
  'table',
]);

export type TiptapAINodeTypes = ReadonlySet<string>;

interface TiptapAIBlock {
  id: string;
  node: ProseMirrorNode;
  pos: number;
  type: string;
}

export interface TiptapAIContext extends AIEditorContext {
  menuPosition: { top: number; left: number };
  snapshot: {
    doc: ProseMirrorNode;
    from: number;
    to: number;
  };
}

function blockContainers(editor: Editor): TiptapAIBlock[] {
  const blocks: TiptapAIBlock[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'blockContainer' || !node.firstChild) {
      return;
    }
    blocks.push({
      id: String(node.attrs.id ?? ''),
      node,
      pos,
      type: node.firstChild.type.name,
    });
  });
  return blocks;
}

function activeBlock(editor: Editor, blocks: readonly TiptapAIBlock[]): TiptapAIBlock | undefined {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type.name === 'blockContainer') {
      const pos = $from.before(depth);
      return blocks.find((block) => block.pos === pos);
    }
  }
  return blocks.find(
    (block) =>
      block.pos <= editor.state.selection.from && block.pos + block.node.nodeSize >= editor.state.selection.from,
  );
}

function unsupportedContext(currentBlockId: string, editor: Editor): TiptapAIContext {
  const { from, to } = editor.state.selection;
  return {
    currentBlockId,
    isSupported: false,
    mode: 'generate',
    selectedBlockIds: [],
    menuPosition: { top: 48, left: 24 },
    snapshot: { doc: editor.state.doc, from, to },
  };
}

/** Resolves stable Block handles only. No HTML, ProseMirror positions, or document payload leaves this boundary. */
export function resolveTiptapAIContext(
  editor: Editor,
  supportedNodeTypes: TiptapAINodeTypes = defaultTiptapAINodeTypes,
): TiptapAIContext {
  const blocks = blockContainers(editor);
  const current = activeBlock(editor, blocks);
  const { selection } = editor.state;
  const snapshot = { doc: editor.state.doc, from: selection.from, to: selection.to };
  let menuPosition = { top: 48, left: 24 };
  if (editor.isEditable) {
    try {
      const coordinates = editor.view.coordsAtPos(selection.to);
      menuPosition = { top: coordinates.bottom + 8, left: coordinates.left };
    } catch {
      // Hidden editors have no selection rectangle; FloatingWindow uses the fallback.
    }
  }

  if (!editor.isEditable || !current?.id || !supportedNodeTypes.has(current.type)) {
    return unsupportedContext(current?.id ?? '', editor);
  }

  const selected = selection.empty
    ? []
    : blocks.filter((block) => block.pos < selection.to && block.pos + block.node.nodeSize > selection.from);
  if (selected.some((block) => !supportedNodeTypes.has(block.type))) {
    return unsupportedContext(current.id, editor);
  }

  return {
    currentBlockId: current.id,
    isSupported: true,
    mode: selected.length > 0 ? 'modify' : 'generate',
    selectedBlockIds: selected.map((block) => block.id),
    menuPosition,
    snapshot,
  };
}

/** Optional extension for hosts that install keyboard behavior with their extension list. */
export function createTiptapAIShortcutExtension(onOpen: () => boolean | void) {
  return Extension.create({
    name: 'tiptapAIAssistantShortcut',
    addKeyboardShortcuts() {
      return {
        'Mod-j': () => onOpen() !== false,
      };
    },
  });
}
