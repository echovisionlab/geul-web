import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { downloadRemoteSource } from './remote-source';
import { runRemoteFileImport } from './remote-import-runner';
import {
  UploadPausedError,
  type UploadOptions,
  type UploadResult,
  type FileIngestLifecycleUpdate,
} from './file-upload-contract';
import { readDurablePreparedSession, readPreparedSession, rememberPreparedSession } from './upload-session-store';
import * as surfaceActivity from '@/lib/hooks/uploadSurfaceActivity';
import { buildUploadSurfaceKey, cancelUploadSurface } from '@/lib/hooks/uploadSurfaceActivity';

vi.mock('./remote-source', () => ({ downloadRemoteSource: vi.fn() }));
vi.mock('./upload-session-store', () => ({
  readDurablePreparedSession: vi.fn(),
  readPreparedSession: vi.fn(),
  rememberPreparedSession: vi.fn(),
}));
const file = new File(['audio'], 'original.wav', { type: 'audio/wav', lastModified: 0 });
const dispose = vi.fn(async () => undefined);
const makeRuntime = () => ({
  upload: vi.fn<(file: File, options: UploadOptions) => Promise<UploadResult>>(async () => ({
    fileId: 'file',
    url: '/file',
  })),
  isAborted: vi.fn(() => false),
  isPaused: vi.fn(() => false),
  abortActiveUpload: vi.fn(),
  registerPartAborter: vi.fn((_aborter: () => void) => vi.fn()),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readDurablePreparedSession).mockReturnValue(null);
  vi.mocked(readPreparedSession).mockReturnValue(null);
  vi.mocked(downloadRemoteSource).mockResolvedValue({ file, storageId: 'geul-client-media-source', dispose });
});

it('delegates the downloaded File to the existing uploader and maps lifecycle to monotonic embed progress', async () => {
  const runtime = makeRuntime();
  const updates: FileIngestLifecycleUpdate[] = [];
  vi.mocked(downloadRemoteSource).mockImplementationOnce(async (_url, _options, _signal, onProgress) => {
    onProgress(5, 5);
    return { file, storageId: 'geul-client-media-source', dispose };
  });
  runtime.upload.mockImplementationOnce(async (_file, options) => {
    for (const [stage, percentage] of [
      ['validating', 0],
      ['processing', 30],
      ['uploading', 60],
      ['finalizing', 99],
      ['completed', 100],
    ] as const) {
      options.onLifecycle?.({ correlationId: 'correlation', mode: 'upload', source: 'local', stage, percentage });
    }
    return { fileId: 'file', url: '/file' };
  });
  const session = { fileId: 'existing', uploadId: 'existing-upload' };
  await runRemoteFileImport(
    UploadType.TRACK_AUDIO,
    'track',
    'https://source.example/audio',
    TranscodeEntityType.POST,
    {
      correlationId: 'correlation',
      slotId: 'slot',
      surfaceSlotId: 'surface',
      attemptId: 'attempt',
      resumeSession: session,
      onLifecycle: (update) => updates.push(update),
    },
    runtime,
  );
  expect(runtime.upload).toHaveBeenCalledWith(
    file,
    expect.objectContaining({ slotId: 'slot', surfaceSlotId: 'surface', attemptId: 'attempt', resumeSession: session }),
  );
  expect(updates.map((update) => update.percentage)).toEqual([0, 20, 20, 44, 68, 99.2, 100]);
  expect(updates.every((update) => update.mode === 'embed')).toBe(true);
  expect(dispose).toHaveBeenCalledOnce();
});

it('registers cancellation for the actual download and never uploads after pause', async () => {
  const runtime = makeRuntime();
  runtime.abortActiveUpload.mockImplementation(() => {
    runtime.isAborted.mockReturnValue(true);
    runtime.isPaused.mockReturnValue(true);
  });
  vi.mocked(downloadRemoteSource).mockImplementationOnce(async (_url, _options, signal) => {
    const key = buildUploadSurfaceKey({
      uploadType: UploadType.EDITOR_AUDIO,
      entityId: 'page',
      slotId: 'surface',
      attemptId: 'attempt',
    });
    expect(cancelUploadSurface(key)).toBe(true);
    expect(runtime.registerPartAborter).toHaveBeenCalledOnce();
    expect(signal.aborted).toBe(false);
    return { file, storageId: 'geul-client-media-source', dispose };
  });
  await expect(
    runRemoteFileImport(
      UploadType.EDITOR_AUDIO,
      'page',
      'https://source.example/audio',
      undefined,
      {
        correlationId: 'cancel',
        surfaceSlotId: 'surface',
        attemptId: 'attempt',
      },
      runtime,
    ),
  ).rejects.toBeInstanceOf(UploadPausedError);
  expect(runtime.upload).not.toHaveBeenCalled();
  expect(dispose).toHaveBeenCalledOnce();
});

it('transfers source storage to the retained prepared session after recoverable upload failure', async () => {
  const runtime = makeRuntime();
  const resident = {} as NonNullable<ReturnType<typeof readPreparedSession>>;
  vi.mocked(readPreparedSession).mockReturnValue(resident);
  runtime.upload.mockImplementationOnce(async (_file, options) => {
    options.onMultipartSession?.({ fileId: 'file', uploadId: 'upload', resumed: false, resumable: true });
    throw new Error('finalization response lost');
  });
  await expect(
    runRemoteFileImport(UploadType.EDITOR_AUDIO, '', 'https://source.example/audio', undefined, undefined, runtime),
  ).rejects.toThrow('finalization response lost');
  expect(rememberPreparedSession).toHaveBeenCalledWith(
    'file',
    expect.objectContaining({ sourceStorageId: 'geul-client-media-source' }),
  );
  expect(dispose).not.toHaveBeenCalled();
});

it('maps aggregate lifecycle updates to the track surface after the server assigns an attempt', async () => {
  const runtime = makeRuntime();
  const updateSurface = vi.spyOn(surfaceActivity, 'updateUploadSurfaceLifecycle');
  const migratedKey = buildUploadSurfaceKey({
    uploadType: UploadType.TRACK_AUDIO,
    entityId: 'track',
    slotId: 'surface',
    attemptId: 'server-attempt',
  });
  runtime.upload.mockImplementationOnce(async (_file, uploadOptions) => {
    surfaceActivity.markUploadSurfaceActive(migratedKey, 'track-correlation');
    try {
      uploadOptions.onMultipartSession?.({
        fileId: 'file',
        uploadId: 'upload',
        slotId: 'durable-slot',
        attemptId: 'server-attempt',
        resumed: false,
        resumable: true,
      });
      uploadOptions.onLifecycle?.({
        correlationId: 'track-correlation',
        mode: 'upload',
        stage: 'uploading',
        percentage: 60,
        source: 'local',
      });
      expect(updateSurface).toHaveBeenCalledWith(
        migratedKey,
        { stage: 'uploading', progress: 68, error: undefined },
        'track-correlation',
      );
      return { fileId: 'file', url: '/file' };
    } finally {
      surfaceActivity.clearUploadSurfaceActive(migratedKey, 'track-correlation');
    }
  });
  try {
    await runRemoteFileImport(
      UploadType.TRACK_AUDIO,
      'track',
      'https://source.example/audio',
      undefined,
      {
        correlationId: 'track-correlation',
        slotId: 'durable-slot',
        surfaceSlotId: 'surface',
        attemptId: 'client-attempt',
      },
      runtime,
    );
  } finally {
    updateSurface.mockRestore();
  }
});

afterEach(() => vi.unstubAllGlobals());

const retainedNamespace = 'geul-client-media-22222222-2222-2222-2222-222222222222';
const retainedSession = { fileId: 'retained-file', uploadId: 'retained-upload' };

function retainedSourceFixture(uploadType = UploadType.TRACK_AUDIO) {
  const storedFile = new File([new Uint8Array(10 * 1024 * 1024)], 'source');
  const durable: NonNullable<ReturnType<typeof readDurablePreparedSession>> = {
    storageId: 'geul-client-media-11111111-1111-1111-1111-111111111111',
    sourceStorageId: retainedNamespace,
    sourceFingerprint: 'existing-fingerprint',
    uploadId: retainedSession.uploadId,
    bundleId: 'retained-bundle',
    uploadType,
    source: { name: 'original.wav', type: 'audio/wav', size: storedFile.size, lastModified: 123 },
    progress: { loadedBytes: 4, percentage: 60 },
    receipts: [],
  };
  const getFile = vi.fn(async () => storedFile);
  const getFileHandle = vi.fn(async () => ({ getFile }));
  const getDirectoryHandle = vi.fn(async () => ({ getFileHandle }));
  const removeEntry = vi.fn();
  const getDirectory = vi.fn(async () => ({ getDirectoryHandle, removeEntry }));
  vi.stubGlobal('navigator', { storage: { getDirectory } });
  vi.mocked(readDurablePreparedSession).mockReturnValue(durable);
  return { durable, storedFile, getFile, getFileHandle, getDirectoryHandle, getDirectory, removeEntry };
}

it('reuses the explicit retained 10 MiB source with its original File identity and retry options', async () => {
  const fixture = retainedSourceFixture();
  const runtime = makeRuntime();
  const updates: FileIngestLifecycleUpdate[] = [];
  runtime.upload.mockImplementationOnce(async (_file, options) => {
    options.onLifecycle?.({
      correlationId: 'retained',
      mode: 'upload',
      stage: 'uploading',
      percentage: 60,
      source: 'local',
    });
    return { fileId: retainedSession.fileId, url: '/ready' };
  });
  await runRemoteFileImport(
    UploadType.TRACK_AUDIO,
    'track',
    'https://source.example/audio',
    TranscodeEntityType.POST,
    {
      resumeSession: retainedSession,
      correlationId: 'retained',
      slotId: 'slot',
      surfaceSlotId: 'surface',
      attemptId: 'attempt',
      onLifecycle: (update) => updates.push(update),
    },
    runtime,
  );
  const [uploadedFile, options] = runtime.upload.mock.calls[0]!;
  expect(uploadedFile.size).toBe(10 * 1024 * 1024);
  expect(uploadedFile.name).toBe(fixture.durable.source.name);
  expect(uploadedFile.type).toBe(fixture.durable.source.type);
  expect(uploadedFile.lastModified).toBe(fixture.durable.source.lastModified);
  expect(options).toMatchObject({
    resumeSession: retainedSession,
    uploadType: UploadType.TRACK_AUDIO,
    entityId: 'track',
    entityType: TranscodeEntityType.POST,
    slotId: 'slot',
    surfaceSlotId: 'surface',
    attemptId: 'attempt',
  });
  expect(fixture.getDirectoryHandle).toHaveBeenCalledExactlyOnceWith(retainedNamespace);
  expect(fixture.getFileHandle).toHaveBeenCalledExactlyOnceWith('source');
  expect(downloadRemoteSource).not.toHaveBeenCalled();
  expect(updates.map(({ percentage }) => percentage)).toEqual([0, 20, 68]);
  expect(fixture.removeEntry).not.toHaveBeenCalled();
  expect(dispose).not.toHaveBeenCalled();
  expect(rememberPreparedSession).not.toHaveBeenCalled();
});

it('leaves reused source ownership in the existing session after an upload failure', async () => {
  const fixture = retainedSourceFixture();
  const runtime = makeRuntime();
  runtime.upload.mockRejectedValueOnce(new UploadPausedError());
  await expect(
    runRemoteFileImport(
      UploadType.TRACK_AUDIO,
      'track',
      'https://source.example/audio',
      undefined,
      { resumeSession: retainedSession },
      runtime,
    ),
  ).rejects.toBeInstanceOf(UploadPausedError);
  expect(downloadRemoteSource).not.toHaveBeenCalled();
  expect(readPreparedSession).not.toHaveBeenCalled();
  expect(rememberPreparedSession).not.toHaveBeenCalled();
  expect(fixture.removeEntry).not.toHaveBeenCalled();
});

it('downloads again when the retained source is missing from OPFS', async () => {
  const fixture = retainedSourceFixture();
  fixture.getFileHandle.mockRejectedValueOnce(new DOMException('Source removed', 'NotFoundError'));
  const runtime = makeRuntime();
  await runRemoteFileImport(
    UploadType.TRACK_AUDIO,
    'track',
    'https://source.example/audio',
    undefined,
    { resumeSession: retainedSession },
    runtime,
  );
  expect(downloadRemoteSource).toHaveBeenCalledOnce();
  expect(runtime.upload).toHaveBeenCalledWith(file, expect.objectContaining({ resumeSession: retainedSession }));
  expect(dispose).toHaveBeenCalledOnce();
});

it.each(['uploadId', 'uploadType', 'sourceStorageId', 'new-upload'] as const)(
  'does not reuse retained bytes for mismatched or unavailable %s',
  async (mismatch) => {
    const fixture = retainedSourceFixture();
    if (mismatch === 'uploadId') {
      fixture.durable.uploadId = 'another-upload';
    }
    if (mismatch === 'uploadType') {
      fixture.durable.uploadType = UploadType.EDITOR_AUDIO;
    }
    if (mismatch === 'sourceStorageId') {
      delete fixture.durable.sourceStorageId;
    }
    const runtime = makeRuntime();
    await runRemoteFileImport(
      UploadType.TRACK_AUDIO,
      'track',
      'https://source.example/audio',
      undefined,
      mismatch === 'new-upload' ? undefined : { resumeSession: retainedSession },
      runtime,
    );
    expect(fixture.getDirectory).not.toHaveBeenCalled();
    expect(downloadRemoteSource).toHaveBeenCalledOnce();
    expect(runtime.upload).toHaveBeenCalledWith(file, expect.any(Object));
    if (mismatch === 'new-upload') {
      expect(readDurablePreparedSession).not.toHaveBeenCalled();
    }
  },
);

it('propagates retained source storage errors without downloading again', async () => {
  const fixture = retainedSourceFixture();
  const error = new DOMException('Storage denied', 'SecurityError');
  fixture.getDirectory.mockRejectedValueOnce(error);
  const runtime = makeRuntime();
  await expect(
    runRemoteFileImport(
      UploadType.TRACK_AUDIO,
      'track',
      'https://source.example/audio',
      undefined,
      { resumeSession: retainedSession },
      runtime,
    ),
  ).rejects.toBe(error);
  expect(downloadRemoteSource).not.toHaveBeenCalled();
  expect(runtime.upload).not.toHaveBeenCalled();
});

it('rejects size-changed retained bytes without uploading or deleting the owned namespace', async () => {
  const fixture = retainedSourceFixture();
  fixture.durable.source.size++;
  const runtime = makeRuntime();
  await expect(
    runRemoteFileImport(
      UploadType.TRACK_AUDIO,
      'track',
      'https://source.example/audio',
      undefined,
      { resumeSession: retainedSession },
      runtime,
    ),
  ).rejects.toThrow('Retained remote upload source size changed');
  expect(downloadRemoteSource).not.toHaveBeenCalled();
  expect(runtime.upload).not.toHaveBeenCalled();
  expect(fixture.removeEntry).not.toHaveBeenCalled();
});

it('checks cancellation after the retained OPFS read and preserves its ownership', async () => {
  const fixture = retainedSourceFixture();
  const runtime = makeRuntime();
  fixture.getFile.mockImplementationOnce(async () => {
    runtime.isAborted.mockReturnValue(true);
    runtime.isPaused.mockReturnValue(true);
    const aborter = runtime.registerPartAborter.mock.calls[0]?.[0];
    aborter?.();
    return fixture.storedFile;
  });
  await expect(
    runRemoteFileImport(
      UploadType.TRACK_AUDIO,
      'track',
      'https://source.example/audio',
      undefined,
      { resumeSession: retainedSession },
      runtime,
    ),
  ).rejects.toBeInstanceOf(UploadPausedError);
  expect(downloadRemoteSource).not.toHaveBeenCalled();
  expect(runtime.upload).not.toHaveBeenCalled();
  expect(fixture.removeEntry).not.toHaveBeenCalled();
});
