'use client';

import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { deriveMediaDisplayName } from '@/lib/media/block-schemas';
import type { EditorMediaBlock, EditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import {
  captureInsertPosition,
  insertBlockAtPosition,
  type DeferredBlockInsert,
  type InsertPosition,
} from '@/features/editor/lib/block-insert';
import { UPLOAD_ABORTED_MESSAGE } from '@/lib/upload/failure';
import type { UploadOptions } from '@/lib/upload/file-upload-contract';
import { maybeConvertSvg } from '@/lib/utils/svg';
import { validateUploadSelectionFile } from '@/lib/utils/upload-pipeline';
import { getInitialUploadLifecycleStage } from '@/lib/utils/upload-runtime';

export interface MediaFileUploadResult {
  fileId: string;
  url: string;
}

export type MediaFileCategory = 'image' | 'video' | 'audio' | 'attachment';

export interface MediaFileInsertOptions {
  entityType: TranscodeEntityType;
  entityId: string;
  upload: (file: File, options: UploadOptions) => Promise<MediaFileUploadResult>;
  onUploadStart: (fileName: string, stage: string) => void;
  onUploadProgress: (fileName: string, percentage: number, stage?: string) => void;
  onUploadEnd: () => void;
  onUploadCancel?: (fileName: string) => void;
  onUploadError?: (fileName: string, message: string) => void;
  insertBlockAtPosition?: DeferredBlockInsert;
}

function getCategoryForUploadType(uploadType: UploadType): MediaFileCategory | null {
  switch (uploadType) {
    case UploadType.EDITOR_IMAGE:
      return 'image';
    case UploadType.EDITOR_VIDEO:
      return 'video';
    case UploadType.EDITOR_AUDIO:
      return 'audio';
    case UploadType.EDITOR_ATTACHMENT:
      return 'attachment';
    default:
      return null;
  }
}

export function collectSupportedMediaFiles(
  files: FileList | File[],
  onUploadError?: (fileName: string, message: string) => void,
): File[] {
  const mediaFiles: File[] = [];
  for (const file of Array.from(files)) {
    const validation = validateUploadSelectionFile(file);
    if (validation.valid) {
      mediaFiles.push(file);
    } else {
      onUploadError?.(file.name, validation.error);
    }
  }
  return mediaFiles;
}

function createVerifiedFileBlock(file: File, result: MediaFileUploadResult): EditorMediaBlock {
  return {
    type: 'file',
    props: {
      fileId: result.fileId,
      name: deriveMediaDisplayName(file.name),
      alt: '',
      caption: '',
      width: '0',
      height: '0',
      previewWidth: '100',
      textAlignment: 'left',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: String(file.size),
      url: result.url,
    },
  };
}

/**
 * Uploads first and inserts only a verified canonical File Block. Upload
 * progress never enters ProseMirror/Yjs. The saved position is a Yjs relative
 * position, so collaborator edits cannot turn an async upload into an insert
 * at a stale numeric index.
 */
export async function insertMediaFilesAtPosition(
  editor: EditorMediaCommandPort,
  files: File[],
  options: Readonly<MediaFileInsertOptions>,
  savedPosition: InsertPosition | null,
) {
  let insertionPosition = savedPosition;

  for (const [fileIndex, file] of files.entries()) {
    const validation = validateUploadSelectionFile(file);
    if (!validation.valid) {
      options.onUploadError?.(file.name, validation.error);
      continue;
    }
    const category = getCategoryForUploadType(validation.uploadType);
    if (!category) {
      options.onUploadError?.(file.name, 'Unsupported editor media type.');
      continue;
    }

    let latestProgress = 0;
    let latestStage: string = getInitialUploadLifecycleStage(file.size);
    try {
      options.onUploadStart(file.name, latestStage);
      const fileToUpload = category === 'image' ? await maybeConvertSvg(file) : file;
      const uploaded = await options.upload(fileToUpload, {
        uploadType: validation.uploadType,
        entityId: options.entityId,
        entityType: options.entityType,
        onProgress: (progress) => {
          latestProgress = Math.max(latestProgress, progress.percentage);
          latestStage = progress.stage ?? latestStage;
          options.onUploadProgress(file.name, latestProgress, latestStage);
        },
        onLifecycle: (update) => {
          latestProgress = Math.max(latestProgress, update.percentage ?? latestProgress);
          latestStage = update.stage;
          options.onUploadProgress(file.name, latestProgress, latestStage);
        },
      });

      const block = createVerifiedFileBlock(file, uploaded);
      const insert = options.insertBlockAtPosition
        ? options.insertBlockAtPosition(block, insertionPosition)
        : insertBlockAtPosition(editor, block, insertionPosition);
      if (!insert.ok) {
        throw new Error(`Verified File could not be inserted: ${insert.reason}`);
      }
      insertionPosition = captureInsertPosition(editor, insert.blockId);
      if (!insertionPosition && fileIndex < files.length - 1) {
        throw new Error('Verified File insertion position is no longer available.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message === UPLOAD_ABORTED_MESSAGE) {
        options.onUploadCancel?.(file.name);
      } else {
        options.onUploadError?.(file.name, message);
      }
    } finally {
      options.onUploadEnd();
    }
  }
}
