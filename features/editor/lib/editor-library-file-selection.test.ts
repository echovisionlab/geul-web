import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import type { FileManagerFileRow } from '@/lib/actions/file';
import {
  applyEditorLibraryFileSelection,
  createEditorLibraryFilePatch,
  createEditorLibraryFileNeutralPatch,
  editorLibraryFileDisplayName,
  isEditorLibraryFileEligible,
  isUnifiedEditorLibraryFileEligible,
} from './editor-library-file-selection';
import type { EditorMediaCommandPort, SelectedFileBlock } from './media-block-updates';

function libraryFile(overrides: Partial<FileManagerFileRow> = {}): FileManagerFileRow {
  return {
    kind: 'file',
    id: randomTestUuid(),
    fileName: 'field-recording',
    extension: 'wav',
    mimeType: 'audio/wav',
    fileSize: 4096,
    durationSeconds: 12.5,
    createdAt: null,
    updatedAt: null,
    usageCount: 0,
    ...overrides,
  };
}

describe('editor library file selection', () => {
  it('filters library files by the target block upload contract', () => {
    const audio = libraryFile();
    const image = libraryFile({ mimeType: 'image/png', extension: 'png', fileSize: 2048 });
    const oversizedAttachment = libraryFile({
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSize: 501 * 1024 * 1024,
    });
    const failedImage = libraryFile({
      mimeType: 'image/png',
      extension: 'png',
      processingStatus: MediaProcessingStatus.FAILED,
    });

    expect(isEditorLibraryFileEligible(audio, 'file')).toBe(true);
    expect(isEditorLibraryFileEligible(image, 'file')).toBe(true);
    expect(isEditorLibraryFileEligible(oversizedAttachment, 'file')).toBe(false);
    expect(isEditorLibraryFileEligible(failedImage, 'file')).toBe(false);
    expect(isUnifiedEditorLibraryFileEligible(audio)).toBe(true);
    expect(isUnifiedEditorLibraryFileEligible(image)).toBe(true);
    expect(isUnifiedEditorLibraryFileEligible(oversizedAttachment)).toBe(false);
    expect(isUnifiedEditorLibraryFileEligible(failedImage)).toBe(false);
  });

  it('creates a File UUID patch with delivery metadata but no upload attempt state', () => {
    const file = libraryFile();

    expect(
      createEditorLibraryFilePatch(
        'file',
        {
          name: '',
          fileId: randomTestUuid(),
          pendingUploadFileId: randomTestUuid(),
          mediaAttemptId: randomTestUuid(),
          url: 'blob:stale',
          originalUrl: 'https://old.example/audio.wav',
          hlsUrl: 'https://old.example/audio.m3u8',
          waveformUrl: 'https://old.example/waveform.json',
          spectrogramUrl: 'https://old.example/spectrogram.png',
          processingStatus: 'processing',
          processingProgress: '73',
          uploadStage: 'uploading',
        },
        file,
      ),
    ).toEqual({
      fileId: file.id,
      fileName: 'field-recording.wav',
      name: 'field-recording',
      mimeType: 'audio/wav',
      size: '4096',
      url: '',
      originalUrl: '',
      hlsUrl: '',
      waveformUrl: '',
      spectrogramUrl: '',
      thumbnailUrl: '',
      duration: '12.5',
    });
  });

  it('clears all runtime sources while preserving an authored display name', () => {
    const file = libraryFile({ fileName: 'new-image', extension: 'png', mimeType: 'image/png' });

    expect(createEditorLibraryFilePatch('file', { name: 'Curated title' }, file)).toMatchObject({
      fileId: file.id,
      name: 'Curated title',
      url: '',
    });
    expect(createEditorLibraryFileNeutralPatch('file', { name: 'Curated title' }, file)).not.toHaveProperty('_tempUrl');
    expect(createEditorLibraryFilePatch('file', {}, file)).toMatchObject({
      fileId: file.id,
      url: '',
      hlsUrl: '',
      thumbnailUrl: '',
    });
    expect(createEditorLibraryFileNeutralPatch('file', {}, file)).not.toHaveProperty('clientThumbnail');
    expect(createEditorLibraryFilePatch('file', {}, file)).toMatchObject({
      fileId: file.id,
      url: '',
      mimeType: 'image/png',
      size: '4096',
    });
    expect(editorLibraryFileDisplayName(file)).toBe('new-image.png');
  });

  it('updates an active canonical File block without copying transient props', () => {
    const block: SelectedFileBlock = {
      id: randomTestUuid(),
      type: 'file',
      props: {
        caption: 'Localized caption',
        previewWidth: '60',
        textAlignment: 'right',
        fileId: randomTestUuid(),
        name: '',
      },
    };
    const updateBlockProps = vi.fn(() => true);
    const editor = {
      getBlock: () => block,
      updateBlockProps,
    } as unknown as EditorMediaCommandPort;
    const file = libraryFile();

    applyEditorLibraryFileSelection(editor, block, 'file', file);

    expect(updateBlockProps).toHaveBeenCalledWith(
      block.id,
      expect.objectContaining({
        fileId: file.id,
        caption: 'Localized caption',
        previewWidth: '60',
        textAlignment: 'right',
      }),
    );
  });
});
