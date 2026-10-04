// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadType } from '@/lib/types/upload/model';
import type { PreparedMedia } from '@/lib/media/client-processing/contracts';
import {
  disposePreparedSession,
  forgetUploadSession,
  readPreparedSession,
  readUploadSession,
  rememberPreparedSession,
  rememberArtifactReceipt,
  rememberUploadSession,
} from './upload-session-store';

const durableMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  restore: vi.fn(),
  uploadArtifact: vi.fn(),
  disposeNamespace: vi.fn(async () => undefined),
}));
vi.mock('@/lib/media/client-processing/processor', async () => {
  const contracts = await vi.importActual<typeof import('@/lib/media/client-processing/contracts')>(
    '@/lib/media/client-processing/contracts',
  );
  return { ...contracts, prepareMedia: durableMocks.prepare, restoreMedia: durableMocks.restore };
});
vi.mock('@/lib/media/client-processing/artifact-storage', () => {
  return { disposeNamespace: durableMocks.disposeNamespace };
});
vi.mock('./client-media-transport', () => ({ uploadClientMediaArtifact: durableMocks.uploadArtifact }));

beforeEach(() => {
  durableMocks.prepare.mockReset();
  durableMocks.restore.mockReset();
  durableMocks.uploadArtifact.mockReset();
  durableMocks.disposeNamespace.mockClear();
});

const fileId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';

afterEach(async () => {
  await disposePreparedSession(fileId);
  forgetUploadSession(fileId);
  sessionStorage.clear();
  localStorage.clear();
});

describe('upload-session-store', () => {
  it('retains only the explicit File/upload capability used for exact resume', () => {
    rememberUploadSession({ fileId, uploadId: 'multipart-1', attemptId: 'attempt-1' });

    expect(readUploadSession(fileId)).toEqual({
      fileId,
      uploadId: 'multipart-1',
      attemptId: 'attempt-1',
    });
    expect(sessionStorage.getItem(`geul-upload-session:${fileId}`)).not.toContain('blockId');
  });

  it('fails closed on malformed persisted state', () => {
    sessionStorage.setItem(`geul-upload-session:${fileId}`, JSON.stringify({ fileId }));

    expect(readUploadSession(fileId)).toBeNull();
    expect(sessionStorage.getItem(`geul-upload-session:${fileId}`)).toBeNull();
  });
  it('keeps the original source and durable index scoped to the matching upload session', async () => {
    const source = new File(['source'], 'source.wav', { type: 'audio/wav', lastModified: 123 });
    const prepared: PreparedMedia = {
      storageId: 'geul-client-media-11111111-1111-1111-1111-111111111111',
      sourceFingerprint: 'a'.repeat(64),
      metadata: { kind: 'audio', durationSeconds: 1 },
      artifacts: [],
      dispose: vi.fn(async () => undefined),
    };
    rememberUploadSession({ fileId, uploadId: 'multipart-1', clientMediaBundleId: 'bundle-1' });
    rememberPreparedSession(fileId, {
      source,
      uploadType: UploadType.TRACK_AUDIO,
      uploadId: 'multipart-1',
      bundleId: 'bundle-1',
      prepared,
      progress: { loadedBytes: 3, percentage: 45 },
    });
    expect(readPreparedSession(fileId, 'multipart-1', source, UploadType.TRACK_AUDIO)?.prepared).toBe(prepared);
    const reselected = new File(['change'], source.name, { type: source.type, lastModified: source.lastModified });
    expect(readPreparedSession(fileId, 'multipart-1', reselected, UploadType.TRACK_AUDIO)?.source).toBe(source);
    expect(
      readPreparedSession(
        fileId,
        'multipart-1',
        new File(['change'], 'changed.wav', { type: source.type, lastModified: source.lastModified }),
        UploadType.TRACK_AUDIO,
      ),
    ).toBeNull();
    expect(readPreparedSession(fileId, 'multipart-other', source, UploadType.TRACK_AUDIO)).toBeNull();
    expect(readPreparedSession(fileId, 'multipart-1', source, UploadType.EDITOR_AUDIO)).toBeNull();
    expect(sessionStorage.getItem(`geul-upload-session:${fileId}`)).toBe(
      JSON.stringify({ fileId, uploadId: 'multipart-1', clientMediaBundleId: 'bundle-1' }),
    );
    await disposePreparedSession(fileId);
    await disposePreparedSession(fileId);
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(readPreparedSession(fileId, 'multipart-1', source, UploadType.TRACK_AUDIO)).toBeNull();
  });
});

function preparedResumeFixture(): { source: File; prepared: PreparedMedia } {
  const source = new File(['source'], 'source.ogg', { type: 'audio/ogg', lastModified: 123 });
  const artifact = new File(['wave'], 'waveform.json', { type: 'application/json' });
  const prepared: PreparedMedia = {
    storageId: 'geul-client-media-11111111-1111-1111-1111-111111111111',
    sourceFingerprint: 'a'.repeat(64),
    metadata: { kind: 'audio', durationSeconds: 1 },
    artifacts: [
      { path: artifact.name, mimeType: artifact.type, size: artifact.size, sha256: 'b'.repeat(64), file: artifact },
    ],
    dispose: vi.fn(async () => undefined),
  };
  rememberUploadSession({ fileId, uploadId: 'multipart-1', attemptId: 'attempt-1', clientMediaBundleId: 'bundle-1' });
  rememberPreparedSession(fileId, {
    source,
    uploadId: 'multipart-1',
    bundleId: 'bundle-1',
    uploadType: UploadType.TRACK_AUDIO,
    prepared,
    progress: { loadedBytes: 6, percentage: 75 },
  });
  rememberArtifactReceipt(fileId, { path: artifact.name, sha256: 'b'.repeat(64) });
  return { source, prepared };
}

function resumeRuntime() {
  return {
    canTrackServerLifecycle: false,
    lifecycleTrackers: new Map(),
    isAborted: () => false,
    resetAborted: vi.fn(),
    abortActiveUpload: vi.fn(),
    registerPartAborter: () => vi.fn(),
    clearPartAborters: vi.fn(),
    setUploading: vi.fn(),
    initiate: vi.fn(),
    prepareBundle: vi.fn(),
    complete: vi.fn(async () => ({ fileId, url: '/ready' })),
    recoverCompleted: vi.fn(),
    abort: vi.fn(),
    findCandidate: vi.fn(async () => ({
      fileId,
      uploadId: 'multipart-1',
      clientMediaBundleId: 'bundle-1',
      totalParts: 1,
      chunkSize: 6,
      uploadedParts: [{ partNumber: 1, etag: 'existing-original' }],
      attemptId: 'attempt-1',
      slotId: '',
    })),
  } as unknown as import('./direct-upload-runner').DirectUploadRuntime;
}

async function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('durable prepared upload integration', () => {
  it('restores after module reset without re-encoding or re-sending acknowledged artifacts', async () => {
    const { source, prepared } = preparedResumeFixture();
    expect(localStorage.getItem(`geul-prepared-upload:${fileId}`)).toContain('waveform.json');
    vi.resetModules();
    const restored = { ...prepared, dispose: vi.fn(async () => undefined) };
    durableMocks.restore.mockImplementation(async (_storageId, selectedSource) => {
      expect(await readBlobText(selectedSource)).toBe('source');
      return restored;
    });
    const { runDirectFileUpload } = await import('./direct-upload-runner');
    const runtime = resumeRuntime();
    const progress: number[] = [];
    const selected = new File(['source'], source.name, { type: source.type, lastModified: source.lastModified });
    await expect(
      runDirectFileUpload(
        selected,
        {
          uploadType: UploadType.TRACK_AUDIO,
          entityId: 'track-1',
          resumeSession: { fileId, uploadId: 'multipart-1' },
          onProgress: ({ percentage }) => progress.push(percentage),
        },
        runtime,
      ),
    ).resolves.toMatchObject({ fileId });
    expect(durableMocks.prepare).not.toHaveBeenCalled();
    expect(durableMocks.restore).toHaveBeenCalledOnce();
    expect(durableMocks.uploadArtifact).not.toHaveBeenCalled();
    expect(runtime.complete).toHaveBeenCalledWith(expect.objectContaining({ clientMediaBundleId: 'bundle-1' }));
    expect(restored.dispose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(`geul-prepared-upload:${fileId}`)).toBeNull();
    expect(progress.at(-1)).toBe(100);
    expect(progress.every((percentage, index) => index === 0 || percentage >= progress[index - 1]!)).toBe(true);
  });

  it('rejects same-metadata changed source content after reload and retains the bundle for the correct source', async () => {
    const { source, prepared } = preparedResumeFixture();
    vi.resetModules();
    const { ClientMediaRestoreMismatchError } = await import('@/lib/media/client-processing/contracts');
    durableMocks.restore.mockImplementation(async (_storageId, selectedSource) => {
      if ((await readBlobText(selectedSource)) !== 'source') {
        throw new ClientMediaRestoreMismatchError('Select the original source file.');
      }
      return prepared;
    });
    const { runDirectFileUpload } = await import('./direct-upload-runner');
    const runtime = resumeRuntime();
    const changed = new File(['change'], source.name, { type: source.type, lastModified: source.lastModified });
    await expect(
      runDirectFileUpload(
        changed,
        { uploadType: UploadType.TRACK_AUDIO, entityId: 'track-1', resumeSession: { fileId, uploadId: 'multipart-1' } },
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'CLIENT_MEDIA_RESTORE_MISMATCH' });
    expect(runtime.abort).not.toHaveBeenCalled();
    expect(runtime.complete).not.toHaveBeenCalled();
    expect(localStorage.getItem(`geul-prepared-upload:${fileId}`)).toContain('bundle-1');
    expect(sessionStorage.getItem(`geul-upload-session:${fileId}`)).toContain('bundle-1');
    expect(durableMocks.disposeNamespace).not.toHaveBeenCalled();

    const original = new File(['source'], source.name, { type: source.type, lastModified: source.lastModified });
    await expect(
      runDirectFileUpload(
        original,
        { uploadType: UploadType.TRACK_AUDIO, entityId: 'track-1', resumeSession: { fileId, uploadId: 'multipart-1' } },
        runtime,
      ),
    ).resolves.toMatchObject({ fileId });
    expect(durableMocks.prepare).not.toHaveBeenCalled();
    expect(runtime.complete).toHaveBeenCalledOnce();
    expect(localStorage.getItem(`geul-prepared-upload:${fileId}`)).toBeNull();
  });

  it('preserves durable state after a transient OPFS read failure', async () => {
    const { source } = preparedResumeFixture();
    vi.resetModules();
    durableMocks.restore.mockRejectedValue(new Error('Transient storage read failed'));
    const { runDirectFileUpload } = await import('./direct-upload-runner');
    const runtime = resumeRuntime();
    await expect(
      runDirectFileUpload(
        source,
        { uploadType: UploadType.TRACK_AUDIO, entityId: 'track-1', resumeSession: { fileId, uploadId: 'multipart-1' } },
        runtime,
      ),
    ).rejects.toThrow('Transient storage read failed');
    expect(runtime.abort).not.toHaveBeenCalled();
    expect(localStorage.getItem(`geul-prepared-upload:${fileId}`)).not.toBeNull();
  });
});
