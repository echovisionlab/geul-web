import { Extension, type Editor, type Extensions } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { changeCurrentBlockAlignment, moveCurrentBlock } from '../block-commands';

export function hasExactCodeBlockNodeSelection(editor: { state: { selection: unknown } }): boolean {
  const selection = editor.state.selection;
  return selection instanceof NodeSelection && selection.node.type.name === 'codeBlock';
}

/** Opens the existing block menu from its editing context without changing text or selection. */
export function openCurrentBlockMenu(editor: Editor): boolean {
  if (!editor.isEditable) {
    return false;
  }
  const selection = editor.state.selection;
  const $from =
    selection instanceof NodeSelection && selection.node.type.name === 'blockContainer'
      ? editor.state.doc.resolve(selection.from + 1)
      : selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name !== 'blockContainer') {
      continue;
    }
    const dom = editor.view.nodeDOM($from.before(depth));
    if (!(dom instanceof HTMLElement)) {
      return false;
    }
    const container = dom.matches('[data-node-type="blockContainer"]')
      ? dom
      : (dom.querySelector<HTMLElement>('[data-node-type="blockContainer"]') ?? dom);
    const handle = [...container.querySelectorAll<HTMLButtonElement>('[data-drag-handle]')].find(
      (candidate) => (candidate.closest('[data-node-type="blockContainer"]') ?? dom) === container,
    );
    if (!handle || handle.disabled || handle.hidden || handle.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    handle.focus();
    if (editor.view.dom.ownerDocument.activeElement !== handle) {
      return false;
    }
    handle.click();
    return true;
  }
  return false;
}

/**
 * Overrides the schema-level compatibility keymap with the live authoring
 * authority. Returning true while denied prevents lower-priority keymaps from
 * mutating neutral block structure.
 */
export function createAuthoringShortcutGuard(authoringMode: EditorAuthoringMode | null): Extensions[number] {
  return Extension.create({
    name: 'authoringShortcutGuard',
    priority: 1100,
    addKeyboardShortcuts() {
      const neutralMutation = (command: () => boolean) =>
        authoringMode?.allowNeutralBlockEdits === true ? command() : true;
      const moveNeutralBlock = (direction: 'up' | 'down') =>
        hasExactCodeBlockNodeSelection(this.editor)
          ? true
          : neutralMutation(() => moveCurrentBlock(this.editor, direction));
      return {
        'Ctrl-Shift-ArrowRight': () => neutralMutation(() => changeCurrentBlockAlignment(this.editor, 'forward')),
        'Ctrl-Shift-ArrowLeft': () => neutralMutation(() => changeCurrentBlockAlignment(this.editor, 'backward')),
        'Alt-Shift-ArrowUp': () => moveNeutralBlock('up'),
        'Alt-Shift-ArrowDown': () => moveNeutralBlock('down'),
        'Shift-F10': () => authoringMode?.allowNeutralBlockEdits === true && openCurrentBlockMenu(this.editor),
        ContextMenu: () => authoringMode?.allowNeutralBlockEdits === true && openCurrentBlockMenu(this.editor),
      };
    },
  });
}
