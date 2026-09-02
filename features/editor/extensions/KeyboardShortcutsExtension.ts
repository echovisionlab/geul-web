/**
 * Keyboard shortcuts for the native TipTap document model.
 *
 * Provides:
 * - Ctrl-Shift-ArrowRight: Move text alignment forward (left → center → right)
 * - Ctrl-Shift-ArrowLeft: Move text alignment backward (right → center → left)
 * - Alt-Shift-ArrowUp: Move block up
 * - Alt-Shift-ArrowDown: Move block down
 */
import { createTiptapExtension, type TiptapExtensionInstance } from '@/lib/editor/extensions/tiptap';
import {
  changeCurrentBlockAlignment,
  moveCurrentBlock,
  resolveNextTextAlignment,
} from '@/features/editor/tiptap/block-commands';

export const TEXT_ALIGNMENT_SHORTCUTS = {
  forward: 'Ctrl-Shift-ArrowRight',
  backward: 'Ctrl-Shift-ArrowLeft',
} as const;

export { resolveNextTextAlignment };

export const KeyboardShortcutsExtension: TiptapExtensionInstance = createTiptapExtension({
  name: 'keyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      [TEXT_ALIGNMENT_SHORTCUTS.forward]: () => changeCurrentBlockAlignment(this.editor, 'forward'),
      [TEXT_ALIGNMENT_SHORTCUTS.backward]: () => changeCurrentBlockAlignment(this.editor, 'backward'),
      'Alt-Shift-ArrowUp': () => moveCurrentBlock(this.editor, 'up'),
      'Alt-Shift-ArrowDown': () => moveCurrentBlock(this.editor, 'down'),
    };
  },
});
