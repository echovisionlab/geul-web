import {
  canResolveTiptapInsertPosition,
  selectDurableEditorFileProps,
  type EditorMediaBlock,
  type EditorMediaCommandPort,
} from '@/features/editor/lib/media-block-updates';
import {
  insertBlockAtPosition,
  type DeferredBlockInsert,
  type InsertPosition,
} from '@/features/editor/lib/block-insert';
import type { TiptapEditorGeneration } from '../editor-generation';
import { applyTiptapSlashContent } from '../slash/execute';
import type { TiptapSlashActionContext } from '../slash/types';

export interface FileBlockInsertSession {
  context: TiptapSlashActionContext;
  editorGeneration: TiptapEditorGeneration;
  mediaPort: EditorMediaCommandPort;
  position: InsertPosition;
}

/** Applies a verified File Block at a still-valid slash anchor. */
export function applyFileBlockWorkflow(
  editorGeneration: TiptapEditorGeneration,
  context: TiptapSlashActionContext,
  block: EditorMediaBlock,
): boolean {
  if (block.id !== context.targetBlockId || block.type !== 'file') {
    return false;
  }
  const editor = editorGeneration.current();
  if (!editor) {
    return false;
  }
  const content = editor.schema.nodes.file?.createAndFill(block.props);
  return Boolean(content && applyTiptapSlashContent(editor, context, content));
}

/** Binds every result from one async picker operation to one editor generation. */
export function createFileBlockInsertSession(
  context: TiptapSlashActionContext,
  editorGeneration: TiptapEditorGeneration,
  mediaPort: EditorMediaCommandPort,
  position: InsertPosition,
): FileBlockInsertSession {
  return { context, editorGeneration, mediaPort, position };
}

export function createFileBlockInsert(session: FileBlockInsertSession): DeferredBlockInsert {
  let firstBlock = true;

  return (block, savedPosition) => {
    const editor = session.editorGeneration.current();
    if (!editor) {
      return { ok: false, reason: 'unavailable' };
    }
    if (!firstBlock) {
      return insertBlockAtPosition(session.mediaPort, block, savedPosition);
    }
    firstBlock = false;
    if (block.type !== 'file' || !savedPosition || !canResolveTiptapInsertPosition(editor, savedPosition)) {
      return { ok: false, reason: 'missing_reference' };
    }

    const canonicalBlock = {
      ...block,
      id: session.context.targetBlockId,
      props: selectDurableEditorFileProps(block.props),
    };
    if (!applyFileBlockWorkflow(session.editorGeneration, session.context, canonicalBlock)) {
      return { ok: false, reason: 'missing_reference' };
    }
    session.mediaPort.updateBlockProps(canonicalBlock.id, block.props);
    return { ok: true, blockId: canonicalBlock.id };
  };
}
