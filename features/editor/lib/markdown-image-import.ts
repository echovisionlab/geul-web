'use client';

import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { insertBlockAtPosition, type DeferredBlockInsert } from '@/features/editor/lib/block-insert';
import type { EditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { createVerifiedFileBlock, type MediaFileUploadResult } from '@/features/editor/lib/media-file-insert';
import type { MarkdownImagePlaceholder } from '@/features/editor/tiptap/markdown-paste';
import type { UploadOptions } from '@/lib/upload/file-upload-contract';
import { maybeConvertSvg } from '@/lib/utils/svg';
import { validateUploadSelectionFile } from '@/lib/utils/upload-pipeline';

export interface RemoteImageSource {
  file: File;
  dispose: () => Promise<void>;
}

export interface MarkdownImageImportOptions {
  entityType: TranscodeEntityType;
  entityId: string;
  download: (
    url: string,
    options: UploadOptions,
    signal: AbortSignal,
    onProgress: (loadedBytes: number, totalBytes?: number) => void,
  ) => Promise<RemoteImageSource>;
  upload: (file: File, options: UploadOptions) => Promise<MediaFileUploadResult>;
  insertBlockAtPosition?: DeferredBlockInsert;
  onProgress: (percentage: number, stage?: string) => void;
}

// Matches the remote import runner: the download is the first fifth of the progress.
const DOWNLOAD_SHARE = 0.2;

export type RemoteImageImportOptions = Pick<
  MarkdownImageImportOptions,
  'entityType' | 'entityId' | 'download' | 'upload'
> & {
  onProgress?: (share: number, stage?: string) => void;
};

/**
 * Downloads one external image through the server source proxy, checks that
 * the bytes are an editor image and uploads it as an editor File.
 */
export async function importRemoteImageFile(
  url: string,
  options: Readonly<RemoteImageImportOptions>,
): Promise<{ file: File; uploaded: MediaFileUploadResult }> {
  const uploadOptions: UploadOptions = {
    uploadType: UploadType.EDITOR_IMAGE,
    entityId: options.entityId,
    entityType: options.entityType,
  };
  let source: RemoteImageSource | undefined;
  try {
    options.onProgress?.(0, 'downloading');
    source = await options.download(url, uploadOptions, new AbortController().signal, (loaded, total) =>
      options.onProgress?.(total ? (loaded / total) * DOWNLOAD_SHARE : 0, 'downloading'),
    );
    // The URL is only a claim; the downloaded bytes must still be an editor image.
    const validation = validateUploadSelectionFile(source.file, UploadType.EDITOR_IMAGE);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const file = await maybeConvertSvg(source.file);
    const uploaded = await options.upload(file, {
      ...uploadOptions,
      onProgress: (update) =>
        options.onProgress?.(DOWNLOAD_SHARE + (update.percentage / 100) * (1 - DOWNLOAD_SHARE), update.stage),
    });
    return { file, uploaded };
  } finally {
    await source?.dispose().catch(() => undefined);
  }
}

/**
 * Imports pasted Markdown images one at a time and swaps each untouched link
 * placeholder for a verified File Block. A placeholder the author edited or
 * removed meanwhile is left alone, and a failed import keeps its link.
 * Resolves to the number of failed imports.
 */
export async function importMarkdownImages(
  editor: EditorMediaCommandPort,
  images: readonly MarkdownImagePlaceholder[],
  isIntact: (image: MarkdownImagePlaceholder) => boolean,
  options: Readonly<MarkdownImageImportOptions>,
): Promise<number> {
  let failed = 0;
  for (const [index, image] of images.entries()) {
    if (!isIntact(image)) {
      continue;
    }
    try {
      const { file, uploaded } = await importRemoteImageFile(image.url, {
        ...options,
        onProgress: (share, stage) => options.onProgress(((index + Math.min(1, share)) / images.length) * 100, stage),
      });
      if (!isIntact(image)) {
        continue;
      }
      const block = createVerifiedFileBlock(file, uploaded);
      block.props.alt = image.alt;
      const position = { referenceBlockId: image.blockId };
      const insert = options.insertBlockAtPosition
        ? options.insertBlockAtPosition(block, position)
        : insertBlockAtPosition(editor, block, position);
      if (!insert.ok) {
        if (insert.reason === 'unavailable') {
          return failed;
        }
        throw new Error(`Imported image could not be inserted: ${insert.reason}`);
      }
      editor.deleteBlock(image.blockId);
    } catch {
      failed += 1;
    }
  }
  return failed;
}
