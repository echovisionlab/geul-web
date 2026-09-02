'use client';

import { useCallback, useRef, useState } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { collectSupportedMediaFiles, insertMediaFilesAtPosition } from '@/features/editor/lib/media-file-insert';
import {
  applyUnifiedEditorLibraryFileSelection,
  createEditorLibraryFilePatch,
  type EditorLibraryFileSelection,
} from '@/features/editor/lib/editor-library-file-selection';
import type { EditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import {
  captureInsertPosition,
  captureInsertPositionFromDomTarget,
  createInsertPosition,
  insertBlockAtPosition as insertBlockAtSavedPosition,
  type DeferredBlockInsert,
  type InsertPosition,
} from '@/features/editor/lib/block-insert';
import type { TiptapAnyExtension } from '@/lib/editor/extensions/tiptap';
import { useFileUpload } from '@/lib/hooks/useFileUpload';

interface UseEntityMediaSurfaceOptions {
  entityId: string;
  entityType: TranscodeEntityType;
  provider?: HocuspocusProvider | null;
  mediaCommandProvider?: HocuspocusProvider | null;
  allowStructuralEdits: boolean;
  allowInsertEdits: boolean;
  insertBlockAtPosition?: DeferredBlockInsert;
  onUploadCancel?: (fileName: string) => void;
  onUploadError?: (fileName: string, message: string) => void;
}

const NO_MEDIA_EXTENSIONS: readonly TiptapAnyExtension[] = Object.freeze([]);

export function useEntityMediaSurface({
  entityId,
  entityType,
  provider = null,
  mediaCommandProvider = null,
  allowInsertEdits,
  insertBlockAtPosition,
  onUploadCancel,
  onUploadError,
}: UseEntityMediaSurfaceOptions) {
  const { upload } = useFileUpload({
    provider: mediaCommandProvider ?? provider,
    entityType,
    entityId,
  });
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const [uploadProgress, setUploadProgress] = useState<{
    name: string;
    percentage: number;
    stage?: string;
  } | null>(null);

  const insertFiles = useCallback(
    async (
      editor: EditorMediaCommandPort,
      files: FileList | File[],
      savedPosition: InsertPosition | null,
      deferredInsert: DeferredBlockInsert | undefined = insertBlockAtPosition,
    ) => {
      if (!allowInsertEdits) {
        return false;
      }
      const mediaFiles = collectSupportedMediaFiles(files, onUploadError);
      if (mediaFiles.length === 0) {
        return false;
      }

      await insertMediaFilesAtPosition(
        editor,
        mediaFiles,
        {
          entityType,
          entityId,
          upload: (file, options) => uploadRef.current(file, options),
          onUploadStart: (fileName, stage) => setUploadProgress({ name: fileName, percentage: 0, stage }),
          onUploadProgress: (fileName, percentage, stage) => setUploadProgress({ name: fileName, percentage, stage }),
          onUploadEnd: () => setUploadProgress(null),
          onUploadCancel: (fileName) => onUploadCancel?.(fileName),
          onUploadError: (fileName, message) => onUploadError?.(fileName, message),
          insertBlockAtPosition: deferredInsert,
        },
        savedPosition,
      );
      return true;
    },
    [allowInsertEdits, entityId, entityType, insertBlockAtPosition, onUploadCancel, onUploadError],
  );

  const dropFilesAtBlock = useCallback(
    (editor: EditorMediaCommandPort, referenceBlockId: string, files: FileList | File[]) =>
      insertFiles(editor, files, captureInsertPosition(editor, referenceBlockId)),
    [insertFiles],
  );

  const dropFilesAtTarget = useCallback(
    (editor: EditorMediaCommandPort, target: EventTarget | null, files: FileList | File[]) =>
      insertFiles(editor, files, captureInsertPositionFromDomTarget(editor, target) ?? captureInsertPosition(editor)),
    [insertFiles],
  );

  const insertFilesAtSavedPosition = useCallback(
    (
      editor: EditorMediaCommandPort,
      savedPosition: InsertPosition | null,
      files: FileList | File[],
      deferredInsert: DeferredBlockInsert | undefined = insertBlockAtPosition,
    ) => insertFiles(editor, files, savedPosition, deferredInsert),
    [insertBlockAtPosition, insertFiles],
  );

  const selectLibraryFilesAtSavedPosition = useCallback(
    (
      editor: EditorMediaCommandPort,
      savedPosition: InsertPosition | null,
      files: EditorLibraryFileSelection[],
      firstInsert: DeferredBlockInsert | undefined = insertBlockAtPosition,
    ) => {
      if (!allowInsertEdits || files.length === 0) {
        return false;
      }
      let position = savedPosition;
      for (const [index, file] of files.entries()) {
        const block = {
          type: 'file' as const,
          props: {
            alt: '',
            caption: '',
            width: '0',
            height: '0',
            previewWidth: '100',
            textAlignment: 'left',
            ...createEditorLibraryFilePatch('file', {}, file),
          },
        };
        const insert =
          index === 0 && firstInsert
            ? firstInsert(block, position)
            : insertBlockAtSavedPosition(editor, block, position);
        if (!insert.ok) {
          return false;
        }
        position = captureInsertPosition(editor, insert.blockId) ?? createInsertPosition(insert.blockId);
      }
      return true;
    },
    [allowInsertEdits, insertBlockAtPosition],
  );

  const selectLibraryFilesAtBlock = useCallback(
    (editor: EditorMediaCommandPort, referenceBlockId: string, files: EditorLibraryFileSelection[]) => {
      if (!allowInsertEdits || files.length === 0) {
        return false;
      }
      const targetBlock = editor.getBlock(referenceBlockId);
      if (!targetBlock || targetBlock.type !== 'file') {
        return false;
      }
      applyUnifiedEditorLibraryFileSelection(editor, targetBlock, files[0]);
      return true;
    },
    [allowInsertEdits],
  );

  return {
    externalImageProgress: null as { percentage?: number; stage?: string } | null,
    mediaTiptapExtensions: NO_MEDIA_EXTENSIONS,
    dropFilesAtBlock,
    dropFilesAtTarget,
    insertFilesAtSavedPosition,
    selectLibraryFilesAtBlock,
    selectLibraryFilesAtSavedPosition,
    uploadProgress,
  };
}
