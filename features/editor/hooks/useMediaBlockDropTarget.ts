'use client';

import { useCallback, useMemo, useState, type DragEventHandler, type HTMLAttributes } from 'react';
import { useOptionalEditorMediaIngestContext } from '@/features/editor/contexts/EditorMediaIngestContext';
import { isFileDragTransfer } from '@/features/editor/lib/file-drag';

interface BlockEditor {
  _tiptapEditor?: { view?: { dom?: HTMLElement } };
}

interface UseMediaBlockDropTargetInput {
  blockId: string;
  editor: BlockEditor;
  enabled: boolean;
}

function editorRoot(editor: BlockEditor) {
  return editor._tiptapEditor?.view?.dom;
}

export function useMediaBlockDropTarget({ blockId, editor, enabled }: UseMediaBlockDropTargetInput) {
  const mediaIngest = useOptionalEditorMediaIngestContext();
  const [isDropActive, setIsDropActive] = useState(false);
  const canDrop = enabled && mediaIngest !== null;

  const clearDropTarget = useCallback(() => {
    editorRoot(editor)?.removeAttribute('data-media-drop-target-active');
    setIsDropActive(false);
  }, [editor]);

  const handleDrop = useCallback<DragEventHandler<HTMLDivElement>>(
    async (event) => {
      if (!canDrop || !mediaIngest) {
        return;
      }

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearDropTarget();
      await mediaIngest.dropFilesAtBlock(blockId, files);
    },
    [blockId, canDrop, clearDropTarget, mediaIngest],
  );

  const handleDragOver = useCallback<DragEventHandler<HTMLDivElement>>(
    (event) => {
      if (!canDrop || !isFileDragTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      editorRoot(editor)?.setAttribute('data-media-drop-target-active', 'true');
      setIsDropActive(true);
    },
    [canDrop, editor],
  );

  const handleDragLeave = useCallback<DragEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }
      clearDropTarget();
    },
    [clearDropTarget],
  );

  const dropTargetProps = useMemo<
    Pick<HTMLAttributes<HTMLDivElement>, 'onDragEnterCapture' | 'onDragOverCapture' | 'onDragLeave' | 'onDropCapture'>
  >(() => {
    if (!canDrop) {
      return {};
    }
    return {
      onDragEnterCapture: handleDragOver,
      onDragOverCapture: handleDragOver,
      onDragLeave: handleDragLeave,
      onDropCapture: handleDrop,
    };
  }, [canDrop, handleDragLeave, handleDragOver, handleDrop]);

  return { isDropActive, dropTargetProps };
}
