import type { EditorMapBlock } from '@/features/editor/hooks/useEditorFeatures';
import type { TiptapEditorGeneration } from '../editor-generation';
import { applyTiptapSlashContent } from '../slash/execute';
import type { TiptapSlashActionContext } from '../slash/types';

export function applyMapInsertWorkflow(
  editorGeneration: TiptapEditorGeneration,
  context: TiptapSlashActionContext,
  block: EditorMapBlock,
): boolean {
  if (block.id !== context.targetBlockId) {
    return false;
  }
  const editor = editorGeneration.current();
  if (!editor) {
    return false;
  }
  const content = editor.schema.nodes.map?.createAndFill(block.props);
  return Boolean(content && applyTiptapSlashContent(editor, context, content));
}
