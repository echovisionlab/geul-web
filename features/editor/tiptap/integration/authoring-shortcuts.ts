import { Extension, type Extensions } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { changeCurrentBlockAlignment, moveCurrentBlock } from '../block-commands';

export function hasExactCodeBlockNodeSelection(editor: { state: { selection: unknown } }): boolean {
  const selection = editor.state.selection;
  return selection instanceof NodeSelection && selection.node.type.name === 'codeBlock';
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
      };
    },
  });
}
