import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadType } from '@/lib/types/upload/model';
import { prepareMedia } from '@/lib/media/client-processing/processor';
import { uploadClientMediaArtifact } from './client-media-transport';
import { runDirectFileUpload as runUpload } from './direct-upload-runner';
import { CLIENT_MEDIA_ARTIFACTS_MISSING, createUploadPartError } from './upload-errors';
import {
  disposePreparedSession,
  forgetUploadSession,
  readDurablePreparedSession,
  readUploadSession,
  rememberPreparedSession,
  rememberUploadSession,
} from './upload-session-store';
import { buildUploadSurfaceKey, cancelUploadSurface } from '@/lib/hooks/uploadSurfaceActivity';
import {
  candidateFixture,
  createUploadRuntime as makeUploadRuntime,
  deferred,
  preparedFixture,
  sessionFixture,
  uploadFetch,
  UploadXMLHttpRequest,
} from './direct-upload.test-fixture';

vi.mock('@/lib/utils/upload-pipeline', () => ({
  prepareUploadFile: async (file: File) => ({ file, mimeType: file.type }),
}));
vi.mock('@/lib/media/client-processing/processor', () => ({ prepareMedia: vi.fn(), restoreMedia: vi.fn() }));
vi.mock('./client-media-transport', () => ({ uploadClientMediaArtifact: vi.fn() }));

const runtimes: ReturnType<typeof makeUploadRuntime>['runtime'][] = [];
const pendingUploads = new Set<Promise<unknown>>();
function createUploadRuntime() {
  const handle = makeUploadRuntime();
  runtimes.push(handle.runtime);
  return handle;
}
function runDirectFileUpload(...args: Parameters<typeof runUpload>) {
  const promise = runUpload(...args);
  pendingUploads.add(promise);
  void promise.then(
    () => pendingUploads.delete(promise),
    () => pendingUploads.delete(promise),
  );
  return promise;
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
const audio = () => new File(['audio'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 });
const options = {
  uploadType: UploadType.TRACK_AUDIO,
  entityId: 'track-1',
  entityType: TranscodeEntityType.TRACK,
  correlationId: 'correlation-1',
};
const resumeSession = { fileId: 'file-1', uploadId: 'upload-1' };
const blob = () => new File(['bytes'], 'file.bin', { type: 'application/octet-stream' });
const general = { ...options, uploadType: UploadType.GENERAL_FILE };

beforeEach(() => {
  vi.mocked(prepareMedia).mockReset().mockResolvedValue(null);
  vi.mocked(uploadClientMediaArtifact).mockReset().mockResolvedValue(undefined);
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), { localStorage: memoryStorage(), sessionStorage: memoryStorage() }),
  );
  vi.stubGlobal('XMLHttpRequest', UploadXMLHttpRequest);
  vi.stubGlobal('fetch', vi.fn(uploadFetch));
  UploadXMLHttpRequest.instances = [];
  UploadXMLHttpRequest.sendHandler = null;
});
afterEach(async () => {
  try {
    runtimes.splice(0).forEach((runtime) => runtime.abortActiveUpload());
    await Promise.allSettled([...pendingUploads]);
    await disposePreparedSession('file-1');
  } finally {
    forgetUploadSession('file-1');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    UploadXMLHttpRequest.instances = [];
    UploadXMLHttpRequest.sendHandler = null;
  }
});

describe('direct upload session contracts', () => {
  it.each([
    UploadType.EDITOR_IMAGE,
    UploadType.EDITOR_VIDEO,
    UploadType.EDITOR_AUDIO,
    UploadType.EDITOR_ATTACHMENT,
    UploadType.EDITOR_MESH,
  ])('removes server attachment targets for editor upload %s', async (uploadType) => {
    const { runtime } = createUploadRuntime();
    const onMultipartSession = vi.fn();
    await runDirectFileUpload(
      blob(),
      {
        ...options,
        uploadType,
        entityId: 'post-1',
        entityType: TranscodeEntityType.POST,
        slotId: 'slot-1',
        expectedCurrentFileId: 'current-file',
        onMultipartSession,
      },
      runtime,
    );
    expect(runtime.initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: '',
        entityType: undefined,
        slotId: undefined,
        expectedCurrentFileId: undefined,
      }),
    );
    expect(onMultipartSession).toHaveBeenCalledWith({
      ...resumeSession,
      slotId: 'slot-1',
      attemptId: 'attempt-1',
      resumed: false,
      resumable: false,
    });
  });

  it('reports validation before preprocessing and keeps retryable completion in finalizing', async () => {
    const { runtime } = createUploadRuntime();
    const onProgress = vi.fn();
    const onLifecycle = vi.fn();
    const onMultipartSession = vi.fn();
    runtime.initiate.mockImplementation(async () => {
      expect(onProgress.mock.calls[0]?.[0]).toMatchObject({ loaded: 0, percentage: 0, stage: 'validating' });
      return sessionFixture();
    });
    runtime.complete.mockRejectedValue(new Error('backend unavailable'));
    runtime.findCandidate.mockResolvedValue({ ...candidateFixture(), status: UploadSessionStatus.FINALIZING });
    await expect(
      runDirectFileUpload(blob(), { ...general, onProgress, onLifecycle, onMultipartSession }, runtime),
    ).rejects.toMatchObject({ message: 'Upload finalization failed', retryable: true });
    expect(onMultipartSession).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'file-1', resumable: false }));
    expect(runtime.findCandidate).toHaveBeenCalledWith({
      uploadType: UploadType.GENERAL_FILE,
      entityId: '',
      entityType: undefined,
      slotId: undefined,
      expectedCurrentFileId: undefined,
      ...resumeSession,
    });
    expect(onLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'finalizing', error: 'Upload finalization failed', source: 'local' }),
    );
  });

  it('uses the exact completion identity for recovery and publishes completed only after acknowledgement', async () => {
    const { runtime } = createUploadRuntime();
    runtime.complete.mockRejectedValue(new Error('response lost'));
    const onLifecycle = vi.fn();
    await expect(runDirectFileUpload(blob(), { ...general, onLifecycle }, runtime)).resolves.toMatchObject({
      fileId: 'file-1',
    });
    expect(runtime.recoverCompleted).toHaveBeenCalledWith({
      ...resumeSession,
      uploadType: UploadType.GENERAL_FILE,
      correlationId: 'correlation-1',
    });
    expect(onLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'completed', fileId: 'file-1' }));
  });

  it.each(['candidate-authority', 'recovery-integrity'] as const)(
    'publishes failed after %s rejection',
    async (condition) => {
      const { runtime } = createUploadRuntime();
      runtime.complete.mockRejectedValue(new Error('response lost'));
      const message = condition === 'candidate-authority' ? 'Forbidden' : 'Upload failed';
      if (condition === 'candidate-authority') {
        runtime.findCandidate.mockRejectedValue(new Error(message));
      } else {
        runtime.recoverCompleted.mockRejectedValue(new Error(message));
      }
      const onLifecycle = vi.fn();
      await expect(runDirectFileUpload(blob(), { ...general, onLifecycle }, runtime)).rejects.toMatchObject({
        message,
        retryable: false,
      });
      expect(onLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'failed', error: message }));
    },
  );

  it('resumes a poster session without creating a replacement upload', async () => {
    const { runtime } = createUploadRuntime();
    runtime.findCandidate.mockResolvedValue({ ...candidateFixture(), clientMediaBundleId: '' });
    await runDirectFileUpload(
      new File(['image'], 'poster.webp', { type: 'image/webp' }),
      {
        ...options,
        uploadType: UploadType.PROGRAM_EVENT_POSTER,
        entityId: 'event-1',
        entityType: TranscodeEntityType.PAGE,
        resumeSession,
      },
      runtime,
    );
    expect(runtime.initiate).not.toHaveBeenCalled();
    expect(runtime.findCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadType: UploadType.PROGRAM_EVENT_POSTER,
        entityId: 'event-1',
        entityType: TranscodeEntityType.PAGE,
        ...resumeSession,
      }),
    );
    expect(runtime.complete).toHaveBeenCalledWith(expect.objectContaining(resumeSession));
  });

  it('exhausts automatic part retries, then resends only unconfirmed parts on user resume', async () => {
    vi.useFakeTimers();
    const { runtime } = createUploadRuntime();
    const file = new File([new Uint8Array(50)], 'file.bin', { type: 'application/octet-stream' });
    const attempts = new Map<string, number>();
    let phase = 'initial';
    UploadXMLHttpRequest.sendHandler = (xhr, chunk) => {
      const part = Number(new URL(xhr.url, 'https://studio.example.com').searchParams.get('partNumber'));
      const key = `${phase}:${part}`;
      attempts.set(key, (attempts.get(key) ?? 0) + 1);
      if (phase === 'initial' && part === 6) {
        xhr.readyState = UploadXMLHttpRequest.DONE;
        xhr.status = 408;
        xhr.responseText = 'Upload interrupted';
        xhr.onload?.();
      } else {
        xhr.succeed(chunk);
      }
    };
    runtime.initiate.mockResolvedValue({ ...sessionFixture(), totalParts: 10 });
    runtime.findCandidate.mockResolvedValue({
      ...candidateFixture(),
      clientMediaBundleId: '',
      totalParts: 10,
      uploadedParts: [1, 2, 3, 4, 5, 7].map((partNumber) => ({ partNumber, etag: `etag-${partNumber}` })),
    });
    const first = runDirectFileUpload(file, general, runtime);
    const rejected = expect(first).rejects.toThrow('Upload interrupted');
    await vi.advanceTimersByTimeAsync(0);
    expect(attempts.get('initial:6')).toBe(1);
    for (const [index, delay] of [1000, 2000, 4000, 8000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(attempts.get('initial:6')).toBe(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(attempts.get('initial:6')).toBe(index + 2);
    }
    await rejected;
    expect(runtime.complete).not.toHaveBeenCalled();
    for (const part of [1, 2, 3, 4, 5, 7]) {
      expect(attempts.get(`initial:${part}`)).toBe(1);
    }
    phase = 'resume';
    const percentages: number[] = [];
    await runDirectFileUpload(
      file,
      { ...general, resumeSession, onProgress: ({ percentage }) => percentages.push(percentage) },
      runtime,
    );
    expect(runtime.complete).toHaveBeenCalledOnce();
    expect(attempts.get('resume:6')).toBe(1);
    for (const part of [1, 2, 3, 4, 5, 7]) {
      expect(attempts.has(`resume:${part}`)).toBe(false);
    }
    expect(percentages[0]).toBe(60);
    expect(percentages.every((value, index) => index === 0 || value >= percentages[index - 1]!)).toBe(true);
    expect(runtime.complete).toHaveBeenCalledWith(expect.objectContaining(resumeSession));
  });
});

describe('prepared client media lifecycle', () => {
  it('prepares before initiation, aggregates artifact bytes, and reserves 100 until commit acknowledgement', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockImplementation(async (_file, { onProgress }) => {
      expect(runtime.initiate).not.toHaveBeenCalled();
      onProgress(0.5);
      onProgress(1);
      return prepared;
    });
    vi.mocked(uploadClientMediaArtifact).mockImplementation(async ({ file, onProgress }) => {
      expect(runtime.prepareBundle).toHaveBeenCalledOnce();
      onProgress?.({ loaded: file.size / 2, total: file.size });
    });
    const commitStarted = deferred<void>();
    const commit = deferred<Awaited<ReturnType<typeof runtime.complete>>>();
    runtime.complete.mockImplementation(() => {
      commitStarted.resolve();
      return commit.promise;
    });
    const percentages: number[] = [];
    const loaded: number[] = [];
    const uploading = runDirectFileUpload(
      audio(),
      {
        ...options,
        onProgress: (update) => {
          percentages.push(update.percentage);
          loaded.push(update.loaded);
        },
      },
      runtime,
    );
    try {
      await commitStarted.promise;
      expect(percentages).toContain(20);
      expect(percentages).toContain(40);
      expect(Math.max(...percentages)).toBe(99);
      expect(loaded.at(-1)).toBe(9);
      expect(runtime.complete).toHaveBeenCalledWith(expect.objectContaining({ clientMediaBundleId: 'bundle-1' }));
      expect(prepared.dispose).not.toHaveBeenCalled();
    } finally {
      commit.resolve({ fileId: 'file-1', url: '/media/file-1' });
      await uploading;
    }
    expect(percentages.at(-1)).toBe(100);
    expect(percentages.every((value, index) => index === 0 || value >= percentages[index - 1]!)).toBe(true);
    expect(prepared.dispose).toHaveBeenCalledOnce();
  });

  it('reuses exact cached source and artifact receipts on completion retry', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    runtime.complete.mockRejectedValueOnce(new Error('response lost'));
    runtime.findCandidate.mockResolvedValue({ ...candidateFixture(), status: UploadSessionStatus.FINALIZING });
    await expect(runDirectFileUpload(audio(), options, runtime)).rejects.toMatchObject({ retryable: true });
    expect(readDurablePreparedSession('file-1')?.receipts).toEqual([{ path: 'waveform.json', sha256: 'a'.repeat(64) }]);
    expect(prepared.dispose).not.toHaveBeenCalled();
    const retryBodies: Blob[] = [];
    UploadXMLHttpRequest.sendHandler = (xhr, body) => {
      retryBodies.push(body);
      xhr.succeed(body);
    };
    await runDirectFileUpload(
      new File(['other'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 }),
      { ...options, resumeSession },
      runtime,
    );
    expect(await retryBodies[0]!.text()).toBe('audio');
    expect(prepareMedia).toHaveBeenCalledOnce();
    expect(runtime.prepareBundle).toHaveBeenCalledOnce();
    expect(uploadClientMediaArtifact).toHaveBeenCalledOnce();
    expect(prepared.dispose).toHaveBeenCalledOnce();
  });

  it('aborts only the owned session when cancellation arrives during initiation', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    const initiated = deferred<Awaited<ReturnType<typeof runtime.initiate>>>();
    const started = deferred<void>();
    runtime.initiate.mockImplementation(() => {
      started.resolve();
      return initiated.promise;
    });
    const uploading = runDirectFileUpload(audio(), options, runtime);
    const rejected = expect(uploading).rejects.toThrow('Upload aborted');
    try {
      await started.promise;
      runtime.abortActiveUpload();
    } finally {
      initiated.resolve(sessionFixture());
      await rejected;
    }
    expect(runtime.abort).toHaveBeenCalledWith({ ...resumeSession, correlationId: 'correlation-1' });
    expect(runtime.prepareBundle).not.toHaveBeenCalled();
    expect(UploadXMLHttpRequest.instances).toHaveLength(0);
    expect(prepared.dispose).toHaveBeenCalledOnce();
  });

  it('rejects a server bundle without cached artifact bytes instead of encoding a replacement', async () => {
    const { runtime } = createUploadRuntime();
    runtime.findCandidate.mockResolvedValue(candidateFixture());
    await expect(runDirectFileUpload(audio(), { ...options, resumeSession }, runtime)).rejects.toThrow(
      'Start a new upload',
    );
    expect(prepareMedia).not.toHaveBeenCalled();
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(UploadXMLHttpRequest.instances).toHaveLength(0);
  });

  it('cancels artifact transfer through the handed-off Track attempt surface', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    const started = deferred<AbortSignal>();
    vi.mocked(uploadClientMediaArtifact).mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          started.resolve(signal);
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    const uploading = runDirectFileUpload(audio(), options, runtime);
    const rejected = expect(uploading).rejects.toThrow('Upload aborted');
    const signal = await started.promise;
    try {
      expect(
        cancelUploadSurface(
          buildUploadSurfaceKey({ uploadType: UploadType.TRACK_AUDIO, entityId: 'track-1', attemptId: 'attempt-1' }),
        ),
      ).toBe(true);
      expect(signal.aborted).toBe(true);
    } finally {
      runtime.abortActiveUpload();
      await rejected;
    }
    expect(runtime.abort).toHaveBeenCalledWith(expect.objectContaining(resumeSession));
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(readUploadSession('file-1')).toBeNull();
  });

  it('disposes artifacts and revokes the server session on artifact integrity rejection', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    vi.mocked(uploadClientMediaArtifact).mockRejectedValue(createUploadPartError(400, 'hash mismatch'));
    await expect(runDirectFileUpload(audio(), options, runtime)).rejects.toThrow('Upload failed');
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(runtime.abort).toHaveBeenCalledWith(expect.objectContaining(resumeSession));
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(readUploadSession('file-1')).toBeNull();
  });

  it('rejects a changed source identity and cleans up the previous bundle', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    rememberUploadSession({ ...resumeSession, clientMediaBundleId: 'bundle-1' });
    rememberPreparedSession('file-1', {
      source: audio(),
      uploadId: 'upload-1',
      uploadType: UploadType.TRACK_AUDIO,
      bundleId: 'bundle-1',
      prepared,
      progress: { loadedBytes: 5, percentage: 99 },
    });
    await expect(
      runDirectFileUpload(
        new File(['audio'], 'different.ogg', { type: 'audio/ogg', lastModified: 123 }),
        { ...options, resumeSession },
        runtime,
      ),
    ).rejects.toThrow('Start a new upload');
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(runtime.abort).toHaveBeenCalledWith(expect.objectContaining(resumeSession));
    expect(readUploadSession('file-1')).toBeNull();
    expect(runtime.initiate).not.toHaveBeenCalled();
    expect(runtime.complete).not.toHaveBeenCalled();
  });

  it('pauses artifact transfer while retaining the server session and prepared bytes for resume', async () => {
    const { runtime, pause } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    const started = deferred<void>();
    vi.mocked(uploadClientMediaArtifact).mockImplementationOnce(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          started.resolve();
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    const uploading = runDirectFileUpload(audio(), options, runtime);
    const rejected = expect(uploading).rejects.toMatchObject({ code: 'UPLOAD_PAUSED' });
    try {
      await started.promise;
      pause();
    } finally {
      pause();
      await rejected;
    }
    expect(runtime.abort).not.toHaveBeenCalled();
    expect(prepared.dispose).not.toHaveBeenCalled();
    expect(readUploadSession('file-1')?.clientMediaBundleId).toBe('bundle-1');
    expect(readDurablePreparedSession('file-1')).not.toBeNull();
    runtime.findCandidate.mockResolvedValue({
      ...candidateFixture(),
      uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
    });
    await runDirectFileUpload(audio(), { ...options, resumeSession }, runtime);
    expect(prepareMedia).toHaveBeenCalledOnce();
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(readDurablePreparedSession('file-1')).toBeNull();
  });

  it('clears missing staging receipts and resends artifacts without repeating preparation', async () => {
    const { runtime } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    runtime.complete.mockRejectedValueOnce(new Error(CLIENT_MEDIA_ARTIFACTS_MISSING));
    await expect(runDirectFileUpload(audio(), options, runtime)).rejects.toMatchObject({
      code: CLIENT_MEDIA_ARTIFACTS_MISSING,
      retryable: true,
    });
    expect(readDurablePreparedSession('file-1')?.receipts).toEqual([]);
    expect(prepared.dispose).not.toHaveBeenCalled();
    runtime.findCandidate.mockResolvedValue({
      ...candidateFixture(),
      status: UploadSessionStatus.FINALIZING,
      uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
    });
    await runDirectFileUpload(audio(), { ...options, resumeSession }, runtime);
    expect(uploadClientMediaArtifact).toHaveBeenCalledTimes(2);
    expect(prepareMedia).toHaveBeenCalledOnce();
    expect(runtime.abort).not.toHaveBeenCalled();
  });

  it('rejects unsupported preparation before creating a server session or sending bytes', async () => {
    const { runtime } = createUploadRuntime();
    await expect(runDirectFileUpload(audio(), options, runtime)).rejects.toMatchObject({
      code: 'CLIENT_MEDIA_UNAVAILABLE',
      reason: 'capability',
    });
    expect(runtime.initiate).not.toHaveBeenCalled();
    expect(runtime.prepareBundle).not.toHaveBeenCalled();
    expect(UploadXMLHttpRequest.instances).toHaveLength(0);
    expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
    expect(runtime.complete).not.toHaveBeenCalled();
  });

  it('binds preparation to its immutable bundle when paused during initiation without sending bytes', async () => {
    const { runtime, pause } = createUploadRuntime();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    const initiated = deferred<Awaited<ReturnType<typeof runtime.initiate>>>();
    const started = deferred<void>();
    runtime.initiate.mockImplementation(() => {
      started.resolve();
      return initiated.promise;
    });
    const uploading = runDirectFileUpload(audio(), options, runtime);
    const rejected = expect(uploading).rejects.toMatchObject({ code: 'UPLOAD_PAUSED' });
    try {
      await started.promise;
      pause();
    } finally {
      initiated.resolve(sessionFixture());
      await rejected;
    }
    expect(runtime.abort).not.toHaveBeenCalled();
    expect(prepared.dispose).not.toHaveBeenCalled();
    expect(runtime.prepareBundle).toHaveBeenCalledOnce();
    expect(UploadXMLHttpRequest.instances).toHaveLength(0);
    expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
    expect(readUploadSession('file-1')?.clientMediaBundleId).toBe('bundle-1');
  });

  it.each([
    { mime: 'audio/ogg', name: 'audio.ogg', kind: 'audio' },
    { mime: 'video/mp4', name: 'video.mp4', kind: 'video' },
  ] as const)(
    'prepares $mime editor attachments before initiation and commits their bundle identity',
    async ({ mime, name, kind }) => {
      const { runtime } = createUploadRuntime();
      const prepared = preparedFixture();
      prepared.metadata.kind = kind;
      const preparation = deferred<typeof prepared>();
      const started = deferred<void>();
      vi.mocked(prepareMedia).mockImplementation(() => {
        started.resolve();
        return preparation.promise;
      });
      const uploading = runDirectFileUpload(
        new File(['media'], name, { type: mime }),
        { ...options, uploadType: UploadType.EDITOR_ATTACHMENT },
        runtime,
      );
      try {
        await started.promise;
        expect(runtime.initiate).not.toHaveBeenCalled();
        expect(UploadXMLHttpRequest.instances).toHaveLength(0);
      } finally {
        preparation.resolve(prepared);
        await uploading;
      }
      expect(runtime.prepareBundle).toHaveBeenCalledWith(expect.objectContaining({ kind, ...resumeSession }));
      expect(runtime.complete).toHaveBeenCalledWith(
        expect.objectContaining({ uploadType: UploadType.EDITOR_ATTACHMENT, clientMediaBundleId: 'bundle-1' }),
      );
      expect(runtime.initiate).toHaveBeenCalledWith(expect.objectContaining({ entityId: '' }));
      expect(prepared.dispose).toHaveBeenCalledOnce();
    },
  );

  it('keeps nonmedia editor attachments on ordinary multipart completion', async () => {
    const { runtime } = createUploadRuntime();
    await runDirectFileUpload(
      new File(['%PDF-'], 'document.pdf', { type: 'application/pdf' }),
      { ...options, uploadType: UploadType.EDITOR_ATTACHMENT },
      runtime,
    );
    expect(prepareMedia).not.toHaveBeenCalled();
    expect(runtime.prepareBundle).not.toHaveBeenCalled();
    expect(runtime.complete).toHaveBeenCalledWith(
      expect.objectContaining({ uploadType: UploadType.EDITOR_ATTACHMENT }),
    );
    expect(runtime.complete.mock.calls[0]?.[0]).not.toHaveProperty('clientMediaBundleId');
  });
});
