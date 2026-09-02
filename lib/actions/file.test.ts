import { Code, ConnectError } from '@connectrpc/connect';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileClient } from '@/lib/api/server-client';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import {
  completeUploadAction,
  deleteFileAction,
  downloadFromUrlAction,
  getFileStatusAction,
  getManagedFileAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  listFileManagerItemsAction,
  listManagedFileUsagesAction,
  recoverCompletedUploadAction,
  searchFileManagerItemsAction,
} from './file';

const getMediaDeliveryMock = vi.fn();
const deleteFileMock = vi.fn();
const completeMultipartUploadMock = vi.fn();
const downloadFromUrlMock = vi.fn();
const initiateMultipartUploadMock = vi.fn();
const findMultipartUploadCandidateMock = vi.fn();
const getFileMock = vi.fn();
const listFileUsagesMock = vi.fn();
const listFileManagerItemsMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createFileClient: vi.fn(),
}));

beforeEach(() => {
  getMediaDeliveryMock.mockReset();
  deleteFileMock.mockReset();
  completeMultipartUploadMock.mockReset();
  downloadFromUrlMock.mockReset();
  initiateMultipartUploadMock.mockReset();
  findMultipartUploadCandidateMock.mockReset();
  getFileMock.mockReset();
  listFileUsagesMock.mockReset();
  listFileManagerItemsMock.mockReset();
  vi.mocked(createFileClient).mockReset();
  vi.mocked(createFileClient).mockResolvedValue({
    getMediaDelivery: getMediaDeliveryMock,
    deleteFile: deleteFileMock,
    completeMultipartUpload: completeMultipartUploadMock,
    downloadFromUrl: downloadFromUrlMock,
    initiateMultipartUpload: initiateMultipartUploadMock,
    findMultipartUploadCandidate: findMultipartUploadCandidateMock,
    getFile: getFileMock,
    listFileUsages: listFileUsagesMock,
    listFileManagerItems: listFileManagerItemsMock,
  } as unknown as Awaited<ReturnType<typeof createFileClient>>);
});

describe('File Manager directory listing', () => {
  it('loads a complete directory in one bounded snapshot', async () => {
    listFileManagerItemsMock.mockResolvedValueOnce({
      items: [
        {
          item: {
            case: 'folder',
            value: { id: 'folder-1', name: '2026' },
          },
        },
        {
          item: {
            case: 'folder',
            value: { id: 'folder-2', name: '08' },
          },
        },
      ],
      total: BigInt(2),
    });

    await expect(listFileManagerItemsAction({ folderId: 'root-folder' })).resolves.toMatchObject({
      items: [
        { kind: 'folder', id: 'folder-1', name: '2026' },
        { kind: 'folder', id: 'folder-2', name: '08' },
      ],
      total: 2,
      folderNotFound: false,
    });
    expect(listFileManagerItemsMock).toHaveBeenCalledOnce();
    expect(listFileManagerItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'root-folder', pageSize: 10_000 }),
    );
  });

  it('rejects an oversized directory instead of showing a partial result', async () => {
    listFileManagerItemsMock.mockResolvedValueOnce({
      items: [],
      nextPageToken: 'page-2',
      total: BigInt(10_001),
    });

    await expect(listFileManagerItemsAction({})).rejects.toThrow('limited to 10000 items');
  });

  it('rejects duplicate item IDs', async () => {
    listFileManagerItemsMock.mockResolvedValueOnce({
      items: [
        { item: { case: 'folder', value: { id: 'folder-1', name: 'First' } } },
        { item: { case: 'folder', value: { id: 'folder-1', name: 'Duplicate' } } },
      ],
      total: BigInt(2),
    });

    await expect(listFileManagerItemsAction({})).rejects.toThrow('duplicate item');
  });

  it('reports an explicitly requested missing folder separately from an empty folder', async () => {
    listFileManagerItemsMock.mockRejectedValue(new ConnectError('folder missing', Code.NotFound));

    await expect(listFileManagerItemsAction({ folderId: 'missing-folder' })).resolves.toEqual({
      items: [],
      total: 0,
      folderNotFound: true,
    });
  });

  it('rejects an incomplete directory snapshot', async () => {
    listFileManagerItemsMock.mockResolvedValue({
      items: [{ item: { case: 'folder', value: { id: 'folder-1', name: 'Only item' } } }],
      total: BigInt(2),
    });

    await expect(listFileManagerItemsAction({})).rejects.toThrow('incomplete directory');
  });
});

describe('File Manager site-wide search', () => {
  it('preserves result paths and the bounded pagination cursor', async () => {
    listFileManagerItemsMock.mockResolvedValueOnce({
      items: [
        {
          folderPath: [
            { id: 'library', name: 'Library' },
            { id: 'covers', name: 'Covers' },
          ],
          item: {
            case: 'file',
            value: {
              id: 'file-1',
              fileName: 'cover',
              extension: 'jpg',
              mimeType: 'image/jpeg',
              fileSize: BigInt(2400),
              usageCount: 0,
            },
          },
        },
      ],
      total: BigInt(12),
      nextPageToken: 'page-2',
    });

    await expect(searchFileManagerItemsAction({ query: 'CoVeR', pageSize: 500 })).resolves.toMatchObject({
      items: [
        {
          kind: 'file',
          id: 'file-1',
          folderPath: [
            { id: 'library', name: 'Library' },
            { id: 'covers', name: 'Covers' },
          ],
        },
      ],
      total: 12,
      nextPageToken: 'page-2',
    });
    expect(listFileManagerItemsMock).toHaveBeenCalledWith(expect.objectContaining({ query: 'CoVeR', pageSize: 100 }));
    expect(listFileManagerItemsMock.mock.calls[0]?.[0]).not.toHaveProperty('folderId');
  });

  it('passes a folder scope without changing the bounded search contract', async () => {
    listFileManagerItemsMock.mockResolvedValueOnce({ items: [], total: BigInt(0) });

    await searchFileManagerItemsAction({ query: 'recording', folderId: 'recordings' });

    expect(listFileManagerItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'recording', folderId: 'recordings', pageSize: 50 }),
    );
  });
});

describe('File Manager detail projection', () => {
  it('loads one file projection and paginates its typed usages', async () => {
    getFileMock.mockResolvedValue({
      file: {
        id: 'file-1',
        fileName: 'cover',
        extension: 'jpg',
        mimeType: 'image/jpeg',
        fileSize: BigInt(2400),
        usageCount: 2,
        delivery: mediaDeliveryFixture({
          fileId: 'file-1',
          mimeType: 'image/jpeg',
          inlineUrl: 'https://cdn.example.com/cover.jpg',
          downloadUrl: 'https://cdn.example.com/cover-download.jpg',
          playbackUrl: 'https://cdn.example.com/cover.m3u8',
          thumbnailUrl: 'https://cdn.example.com/cover-thumbnail.jpg',
          waveformUrl: 'https://cdn.example.com/cover-waveform.json',
          spectrogramUrl: 'https://cdn.example.com/cover-spectrogram.jpg',
          processingStatus: MediaProcessingStatus.READY,
        }),
      },
      domainUsageSummary: [{ domain: 1, entityId: 'post-1', referencePath: 'body', count: 2 }],
    });
    listFileUsagesMock.mockResolvedValue({
      usages: [{ domain: 1, entityId: 'post-1', referencePath: 'body', blockId: 'block-1', count: 1 }],
      nextPageToken: 'next-1',
      total: BigInt(2),
    });

    await expect(getManagedFileAction('file-1')).resolves.toMatchObject({
      success: true,
      file: {
        id: 'file-1',
        fileName: 'cover',
        extension: 'jpg',
        fileSize: 2400,
        inlineUrl: 'https://cdn.example.com/cover.jpg',
        playbackUrl: 'https://cdn.example.com/cover.m3u8',
        thumbnailUrl: 'https://cdn.example.com/cover-thumbnail.jpg',
        waveformUrl: 'https://cdn.example.com/cover-waveform.json',
        processingStatus: MediaProcessingStatus.READY,
      },
      domainUsageSummary: [{ entityId: 'post-1', slot: 'body', count: 2 }],
    });
    await expect(
      listManagedFileUsagesAction({ fileId: 'file-1', pageSize: 25, pageToken: 'page-1' }),
    ).resolves.toMatchObject({
      success: true,
      usages: [{ entityId: 'post-1', blockId: 'block-1' }],
      nextPageToken: 'next-1',
      total: 2,
    });
    expect(listFileUsagesMock).toHaveBeenCalledWith({ fileId: 'file-1', pageSize: 25, pageToken: 'page-1' });
  });

  it('returns stable localization codes instead of backend error text', async () => {
    getFileMock.mockRejectedValueOnce(new ConnectError('session details must not reach the UI', Code.Unauthenticated));
    listFileUsagesMock.mockRejectedValueOnce(
      new ConnectError('database details must not reach the UI', Code.Unavailable),
    );

    await expect(getManagedFileAction('file-1')).resolves.toEqual({
      success: false,
      errorCode: 'unauthorized',
    });
    await expect(listManagedFileUsagesAction({ fileId: 'file-1' })).resolves.toEqual({
      success: false,
      errorCode: 'loadUsages',
    });
  });

  it('returns a stable missing-file code when the response has no file', async () => {
    getFileMock.mockResolvedValueOnce({});

    await expect(getManagedFileAction('file-missing')).resolves.toEqual({
      success: false,
      errorCode: 'fileNotFound',
    });
  });
});

describe('initiateUploadAction upload identity', () => {
  it('forwards the upload slot and replacement CAS without attaching a Block', async () => {
    initiateMultipartUploadMock.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadedParts: [],
    });
    await initiateUploadAction({
      uploadType: UploadType.EDITOR_AUDIO,
      entityId: 'post-1',
      entityType: TranscodeEntityType.POST,
      fileSize: 1024,
      mimeType: 'audio/wav',
      fileName: 'field-recording.wav',
      slotId: 'slot-1',
      expectedCurrentFileId: 'b8a2d28b-e790-46ed-afbb-fac7911cfeb9',
    });

    expect(initiateMultipartUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 'slot-1',
        expectedCurrentFileId: 'b8a2d28b-e790-46ed-afbb-fac7911cfeb9',
      }),
    );
    expect(initiateMultipartUploadMock.mock.calls[0]?.[0]).not.toHaveProperty('blockId');
  });

  it('keeps slot identity for a structured editor asset', async () => {
    initiateMultipartUploadMock.mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadedParts: [],
    });

    await initiateUploadAction({
      uploadType: UploadType.EDITOR_IMAGE,
      entityId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      fileSize: 1024,
      mimeType: 'image/webp',
      fileName: 'structured.webp',
      slotId: 'structured-slot-1',
    });

    expect(initiateMultipartUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 'structured-slot-1',
      }),
    );
  });
});

describe('upload delivery selection', () => {
  it('uses inline delivery for an uploaded editor image', async () => {
    completeMultipartUploadMock.mockResolvedValue({
      fileId: 'image-1',
      delivery: mediaDeliveryFixture({
        fileId: 'image-1',
        mimeType: 'image/webp',
        inlineUrl: 'https://cdn.example.com/inline.webp',
        downloadUrl: 'https://cdn.example.com/download.webp',
      }),
    });

    await expect(
      completeUploadAction({ fileId: 'image-1', uploadId: 'upload-1', uploadType: UploadType.EDITOR_IMAGE }),
    ).resolves.toEqual({ url: 'https://cdn.example.com/inline.webp', fileId: 'image-1' });
  });

  it('uses download delivery for an uploaded attachment', async () => {
    downloadFromUrlMock.mockResolvedValue({
      fileId: 'attachment-1',
      delivery: mediaDeliveryFixture({
        fileId: 'attachment-1',
        mimeType: 'application/pdf',
        inlineUrl: 'https://cdn.example.com/inline.pdf',
        downloadUrl: 'https://cdn.example.com/download.pdf',
      }),
    });

    await expect(
      downloadFromUrlAction({
        uploadType: UploadType.EDITOR_ATTACHMENT,
        entityId: 'post-1',
        url: 'https://source.example.com/file.pdf',
      }),
    ).resolves.toMatchObject({ url: 'https://cdn.example.com/download.pdf', fileId: 'attachment-1' });
  });

  it('uses playback delivery for ready audio and video imports', async () => {
    downloadFromUrlMock.mockResolvedValue({
      fileId: 'video-1',
      delivery: mediaDeliveryFixture({
        fileId: 'video-1',
        mimeType: 'video/mp4',
        inlineUrl: 'https://cdn.example.com/inline.mp4',
        downloadUrl: 'https://cdn.example.com/download.mp4',
        playbackUrl: 'https://cdn.example.com/master.m3u8',
      }),
    });

    await expect(
      downloadFromUrlAction({
        uploadType: UploadType.EDITOR_VIDEO,
        entityId: 'post-1',
        url: 'https://source.example.com/video.mp4',
      }),
    ).resolves.toMatchObject({ url: 'https://cdn.example.com/master.m3u8', fileId: 'video-1' });
  });
});

describe('multipart completion recovery error classification', () => {
  it('forwards the exact upload and file capability pair during candidate lookup', async () => {
    findMultipartUploadCandidateMock.mockResolvedValue({});

    await findMultipartUploadCandidateAction({
      uploadType: UploadType.GENERAL_FILE,
      entityId: '',
      fileId: 'file-1',
      uploadId: 'upload-1',
    });

    expect(findMultipartUploadCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-1', uploadId: 'upload-1' }),
    );
  });

  it.each([
    [Code.InvalidArgument, 'Upload failed'],
    [Code.NotFound, 'Upload failed'],
    [Code.PermissionDenied, 'Forbidden'],
  ])('marks definitive Complete rejection %s as terminal', async (code, expectedMessage) => {
    completeMultipartUploadMock.mockRejectedValue(new ConnectError('completion rejected', code));

    await expect(
      completeUploadAction({ fileId: 'file-1', uploadId: 'upload-1', uploadType: UploadType.EDITOR_IMAGE }),
    ).rejects.toThrow(expectedMessage);
  });

  it('preserves an ambiguous Complete transport failure for caller recovery', async () => {
    const error = new ConnectError('completion unavailable', Code.Unavailable);
    completeMultipartUploadMock.mockRejectedValue(error);

    await expect(
      completeUploadAction({ fileId: 'file-1', uploadId: 'upload-1', uploadType: UploadType.EDITOR_IMAGE }),
    ).rejects.toBe(error);
  });

  it('marks a failed-precondition exact completion recovery as terminal', async () => {
    completeMultipartUploadMock.mockRejectedValue(new ConnectError('session is failed', Code.FailedPrecondition));

    await expect(
      recoverCompletedUploadAction({
        fileId: 'file-1',
        uploadId: 'upload-1',
        uploadType: UploadType.EDITOR_IMAGE,
      }),
    ).rejects.toThrow('Upload failed');
  });

  it.each([
    [Code.FailedPrecondition, 'Upload failed'],
    [Code.PermissionDenied, 'Forbidden'],
  ])('marks definitive candidate rejection %s as terminal', async (code, expectedMessage) => {
    findMultipartUploadCandidateMock.mockRejectedValue(new ConnectError('candidate rejected', code));

    await expect(
      findMultipartUploadCandidateAction({
        uploadType: UploadType.EDITOR_IMAGE,
        entityId: 'post-1',
        entityType: TranscodeEntityType.POST,
        fileId: 'file-1',
        uploadId: 'upload-1',
      }),
    ).rejects.toThrow(expectedMessage);
  });
});

describe('downloadFromUrlAction upload identity', () => {
  it.each([
    {
      name: 'page shared first attach',
      uploadType: UploadType.EDITOR_ATTACHMENT,
      entityType: TranscodeEntityType.PAGE,
      expectedCurrentFileId: undefined,
    },
    {
      name: 'post replacement',
      uploadType: UploadType.EDITOR_IMAGE,
      entityType: TranscodeEntityType.POST,
      expectedCurrentFileId: 'b8a2d28b-e790-46ed-afbb-fac7911cfeb9',
    },
    {
      name: 'work shared first attach',
      uploadType: UploadType.EDITOR_AUDIO,
      entityType: TranscodeEntityType.WORK,
      expectedCurrentFileId: undefined,
    },
    {
      name: 'event replacement',
      uploadType: UploadType.EDITOR_VIDEO,
      entityType: TranscodeEntityType.PROGRAM_EVENT,
      expectedCurrentFileId: 'b8a2d28b-e790-46ed-afbb-fac7911cfeb9',
    },
    {
      name: 'track original replacement',
      uploadType: UploadType.TRACK_AUDIO,
      entityType: TranscodeEntityType.TRACK,
      expectedCurrentFileId: '5458b32a-b8b8-4da4-9791-b9ad09c686d9',
    },
  ])('forwards $name exact target and CAS to FileService', async (testCase) => {
    downloadFromUrlMock.mockResolvedValue({
      fileId: 'file-imported',
      delivery: mediaDeliveryFixture({
        fileId: 'file-imported',
        mimeType: 'image/webp',
        inlineUrl: 'https://cdn.example.com/imported.webp',
      }),
    });

    await downloadFromUrlAction({
      uploadType: testCase.uploadType,
      entityId: 'entity-1',
      entityType: testCase.entityType,
      url: 'https://source.example.com/media',
      correlationId: 'correlation-1',
      slotId: 'client-attempt-slot',
      expectedCurrentFileId: testCase.expectedCurrentFileId,
    });

    expect(downloadFromUrlMock).toHaveBeenCalledWith({
      uploadType: testCase.uploadType,
      entityId: 'entity-1',
      entityType: testCase.entityType,
      url: 'https://source.example.com/media',
      correlationId: 'correlation-1',
      slotId: 'client-attempt-slot',
      expectedCurrentFileId: testCase.expectedCurrentFileId,
    });
    expect(downloadFromUrlMock.mock.calls[0]?.[0]).not.toHaveProperty('blockId');
  });

  it('keeps structured slot identity for remote ingest', async () => {
    downloadFromUrlMock.mockResolvedValue({
      fileId: 'file-imported',
      delivery: mediaDeliveryFixture({ fileId: 'file-imported', mimeType: 'image/webp' }),
    });

    await downloadFromUrlAction({
      uploadType: UploadType.EDITOR_IMAGE,
      entityId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      url: 'https://source.example.com/structured.webp',
      slotId: 'structured-slot-1',
    });

    expect(downloadFromUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 'structured-slot-1',
      }),
    );
  });

  it('uses the exact File and upload identities for multipart resume lookup', async () => {
    findMultipartUploadCandidateMock.mockResolvedValue({});

    await findMultipartUploadCandidateAction({
      uploadType: UploadType.EDITOR_AUDIO,
      entityId: 'post-1',
      entityType: TranscodeEntityType.POST,
      slotId: 'client-attempt-slot',
      expectedCurrentFileId: 'b8a2d28b-e790-46ed-afbb-fac7911cfeb9',
      fileId: 'file-1',
      uploadId: 'upload-1',
    });

    expect(findMultipartUploadCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 'client-attempt-slot',
        fileId: 'file-1',
        uploadId: 'upload-1',
        expectedCurrentFileId: 'b8a2d28b-e790-46ed-afbb-fac7911cfeb9',
      }),
    );
    expect(findMultipartUploadCandidateMock.mock.calls[0]?.[0]).not.toHaveProperty('blockId');
  });
});

describe('getFileStatusAction', () => {
  it('surfaces terminal processing failure for editor audio bootstrap', async () => {
    getMediaDeliveryMock.mockResolvedValue({
      delivery: mediaDeliveryFixture({
        fileId: 'file-audio',
        mimeType: 'audio/flac',
        inlineUrl: 'https://cdn.example.com/original.flac',
        downloadUrl: 'https://cdn.example.com/original.flac',
        playbackUrl: 'https://cdn.example.com/stream.m3u8',
        spectrogramUrl: 'https://cdn.example.com/spectrogram.webp',
        processingStatus: MediaProcessingStatus.FAILED,
        durationSeconds: 180,
      }),
    });

    await expect(getFileStatusAction('file-audio')).resolves.toEqual({
      mimeType: 'audio/flac',
      completed: false,
      failed: true,
      unavailable: false,
      url: 'https://cdn.example.com/original.flac',
      originalUrl: 'https://cdn.example.com/original.flac',
      waveformUrl: '',
      spectrogramUrl: 'https://cdn.example.com/spectrogram.webp',
      thumbnailUrl: '',
      hlsUrl: 'https://cdn.example.com/stream.m3u8',
      durationSeconds: 180,
      processingStatus: MediaProcessingStatus.FAILED,
      processingPercentage: undefined,
    });
  });

  it('keeps non-terminal media in processing when derivatives are still pending', async () => {
    getMediaDeliveryMock.mockResolvedValue({
      delivery: mediaDeliveryFixture({
        fileId: 'file-video',
        mimeType: 'video/mp4',
        inlineUrl: 'https://cdn.example.com/original.mp4',
        downloadUrl: 'https://cdn.example.com/original.mp4',
        processingStatus: MediaProcessingStatus.PROCESSING,
        processingPercentage: 0,
        durationSeconds: 0,
      }),
    });

    await expect(getFileStatusAction('file-video')).resolves.toEqual({
      mimeType: 'video/mp4',
      completed: false,
      failed: false,
      unavailable: false,
      url: 'https://cdn.example.com/original.mp4',
      originalUrl: 'https://cdn.example.com/original.mp4',
      waveformUrl: '',
      spectrogramUrl: '',
      thumbnailUrl: '',
      hlsUrl: '',
      durationSeconds: 0,
      processingStatus: MediaProcessingStatus.PROCESSING,
      processingPercentage: 0,
    });
  });

  it('does not infer media readiness from derivative URLs without backend ready status', async () => {
    getMediaDeliveryMock.mockResolvedValue({
      delivery: mediaDeliveryFixture({
        fileId: 'file-audio',
        mimeType: 'audio/flac',
        inlineUrl: 'https://cdn.example.com/original.flac',
        playbackUrl: 'https://cdn.example.com/stream.m3u8',
        waveformUrl: 'https://cdn.example.com/waveform.json',
        spectrogramUrl: 'https://cdn.example.com/spectrogram.webp',
        processingStatus: MediaProcessingStatus.PROCESSING,
        processingPercentage: 99,
        durationSeconds: 180,
      }),
    });

    await expect(getFileStatusAction('file-audio')).resolves.toMatchObject({
      completed: false,
      failed: false,
      processingStatus: MediaProcessingStatus.PROCESSING,
      processingPercentage: 99,
      hlsUrl: 'https://cdn.example.com/stream.m3u8',
      waveformUrl: 'https://cdn.example.com/waveform.json',
      spectrogramUrl: 'https://cdn.example.com/spectrogram.webp',
    });
  });

  it('uses backend ready status as the only media readiness signal', async () => {
    getMediaDeliveryMock.mockResolvedValue({
      delivery: mediaDeliveryFixture({
        fileId: 'file-audio',
        mimeType: 'audio/flac',
        inlineUrl: 'https://cdn.example.com/original.flac',
        playbackUrl: 'https://cdn.example.com/stream.m3u8',
        waveformUrl: 'https://cdn.example.com/waveform.json',
        spectrogramUrl: 'https://cdn.example.com/spectrogram.webp',
        processingStatus: MediaProcessingStatus.READY,
        durationSeconds: 180,
      }),
    });

    await expect(getFileStatusAction('file-audio')).resolves.toMatchObject({
      completed: true,
      failed: false,
      processingStatus: MediaProcessingStatus.READY,
    });
  });

  it('does not treat upstream status fetch errors as terminal failure', async () => {
    getMediaDeliveryMock.mockRejectedValue(new ConnectError('backend unavailable', Code.Unavailable));

    await expect(getFileStatusAction('file-unavailable')).resolves.toEqual({
      mimeType: '',
      completed: false,
      failed: false,
      unavailable: true,
      url: '',
      originalUrl: '',
      waveformUrl: '',
      spectrogramUrl: '',
      thumbnailUrl: '',
      hlsUrl: '',
      durationSeconds: 0,
      processingStatus: MediaProcessingStatus.UNSPECIFIED,
      processingPercentage: undefined,
    });
  });
});

describe('deleteFileAction', () => {
  it('returns success when the backend deletes the file', async () => {
    deleteFileMock.mockResolvedValue({ success: true });

    await expect(deleteFileAction('file-1')).resolves.toEqual({ success: true });
    expect(deleteFileMock).toHaveBeenCalledWith({ fileId: 'file-1' });
  });

  it('treats already missing files as deleted', async () => {
    deleteFileMock.mockRejectedValue(new ConnectError('not found', Code.NotFound));

    await expect(deleteFileAction('file-missing')).resolves.toEqual({ success: true });
  });

  it.each([
    [Code.Unauthenticated, 'Unauthorized'],
    [Code.PermissionDenied, 'Forbidden'],
  ])('returns a cleanup error for auth failures with code %s', async (code, message) => {
    deleteFileMock.mockRejectedValue(new ConnectError(message, code));

    await expect(deleteFileAction('file-denied')).resolves.toEqual({ error: message });
  });

  it('returns the backend message for other Connect errors', async () => {
    deleteFileMock.mockRejectedValue(new ConnectError('backend unavailable', Code.Unavailable));

    await expect(deleteFileAction('file-failed')).resolves.toEqual({
      error: '[unavailable] backend unavailable',
    });
  });

  it('returns non-Connect error messages', async () => {
    deleteFileMock.mockRejectedValue(new Error('network failed'));

    await expect(deleteFileAction('file-error')).resolves.toEqual({ error: 'network failed' });
  });
});
