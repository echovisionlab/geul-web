'use client';

import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { FileManagerFileRow } from '@/lib/actions/file';
import { UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { deriveMediaDisplayName } from '@/lib/media/block-schemas';
import {
  EditorMediaCommandPort,
  applyCurrentAndNeutralBlockProps,
  EditorMediaBlockType,
  pickNeutralPropsFromBlock,
  resolveCurrentBlockById,
  selectDurableEditorFileProps,
  SelectedFileBlock,
} from './media-block-updates';

export type EditorLibraryFileSelection = Pick<
  FileManagerFileRow,
  'id' | 'fileName' | 'extension' | 'mimeType' | 'fileSize' | 'durationSeconds'
>;

export function editorLibraryFileDisplayName(file: EditorLibraryFileSelection): string {
  return file.extension ? `${file.fileName}.${file.extension}` : file.fileName;
}

export function isEditorLibraryFileEligible(file: FileManagerFileRow, blockType: EditorMediaBlockType): boolean {
  return blockType === 'file' && isUnifiedEditorLibraryFileEligible(file);
}

const UNIFIED_EDITOR_UPLOAD_TYPES = [
  UploadType.EDITOR_IMAGE,
  UploadType.EDITOR_AUDIO,
  UploadType.EDITOR_VIDEO,
  UploadType.EDITOR_ATTACHMENT,
] as const;

export function resolveEditorLibraryFileUploadType(file: FileManagerFileRow): UploadType | null {
  if (file.processingStatus === MediaProcessingStatus.FAILED) {
    return null;
  }
  return (
    UNIFIED_EDITOR_UPLOAD_TYPES.find((uploadType) => {
      const config = UPLOAD_CONFIGS[uploadType];
      return (
        config.permittedMimeTypes.includes(file.mimeType) &&
        file.fileSize >= config.minSize &&
        file.fileSize <= config.maxSize
      );
    }) ?? null
  );
}

export function isUnifiedEditorLibraryFileEligible(file: FileManagerFileRow): boolean {
  return resolveEditorLibraryFileUploadType(file) !== null;
}

function selectedFileName(file: EditorLibraryFileSelection, currentName: unknown): string {
  const preservedName = typeof currentName === 'string' ? currentName.trim() : '';
  return preservedName || deriveMediaDisplayName(editorLibraryFileDisplayName(file));
}

export function createEditorLibraryFilePatch(
  _blockType: EditorMediaBlockType,
  currentProps: Record<string, unknown>,
  file: EditorLibraryFileSelection,
): Record<string, string> {
  const common = {
    fileId: file.id,
    fileName: editorLibraryFileDisplayName(file),
    name: selectedFileName(file, currentProps.name),
  };
  const metadata = {
    mimeType: file.mimeType,
    size: String(file.fileSize),
  };

  return {
    ...common,
    ...metadata,
    url: '',
    originalUrl: '',
    hlsUrl: '',
    waveformUrl: '',
    spectrogramUrl: '',
    thumbnailUrl: '',
    duration: String(file.durationSeconds ?? 0),
  };
}

export function createEditorLibraryFileNeutralPatch(
  _blockType: EditorMediaBlockType,
  currentProps: Record<string, unknown>,
  file: EditorLibraryFileSelection,
): Record<string, string> {
  return {
    fileId: file.id,
    name: selectedFileName(file, currentProps.name),
  };
}

export function applyUnifiedEditorLibraryFileSelection(
  editor: EditorMediaCommandPort,
  selectedBlock: SelectedFileBlock,
  file: EditorLibraryFileSelection,
) {
  applyEditorLibraryFileSelection(editor, selectedBlock, 'file', file);
}

export function applyEditorLibraryFileSelection(
  editor: EditorMediaCommandPort,
  selectedBlock: SelectedFileBlock,
  blockType: EditorMediaBlockType,
  file: EditorLibraryFileSelection,
) {
  const currentBlock = resolveCurrentBlockById(editor, selectedBlock.id) ?? selectedBlock;
  const patch = createEditorLibraryFilePatch(blockType, currentBlock.props, file);
  const currentProps = { ...selectDurableEditorFileProps(currentBlock.props), ...patch };
  const neutralProps = {
    ...pickNeutralPropsFromBlock(currentBlock),
    ...createEditorLibraryFileNeutralPatch(blockType, currentBlock.props, file),
  };

  applyCurrentAndNeutralBlockProps(editor, currentBlock, currentProps, neutralProps);
}
