import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { ClientMediaUnavailableError, type WorkerReply } from './contracts';
import { prepareMedia } from './processor';

const { cleanup } = vi.hoisted(() => ({ cleanup: vi.fn(async () => {}) }));
vi.mock('./artifact-storage', async (original) => ({
  ...(await original<typeof import('./artifact-storage')>()),
  disposeNamespace: cleanup,
}));
vi.mock('./browser-runtime', () => ({ getCodecAssetUrl: () => 'https://codecs.example/' }));

let onPrepare: (worker: TestWorker) => void;
let acknowledgeDisposal = true;
// Only the Worker message boundary is simulated; these tests do not exercise encoding.
class TestWorker extends EventTarget {
  static instances: TestWorker[] = [];
  namespace = '';
  terminate = vi.fn();
  constructor() {
    super();
    TestWorker.instances.push(this);
  }
  postMessage(message: { type: string; namespace?: string }) {
    if (message.type === 'prepare') {
      this.namespace = message.namespace!;
      queueMicrotask(() => onPrepare(this));
    }
    if (message.type === 'dispose' && acknowledgeDisposal) {
      queueMicrotask(() => this.emit({ type: 'disposed' }));
    }
  }
  emit(data: WorkerReply) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}
const file = new File(['source'], 'input.wav', { type: 'audio/wav' });
const options = () => ({ signal: new AbortController().signal, onProgress: vi.fn() });
const artifact = (path: string) => ({
  path,
  mimeType: 'application/octet-stream',
  file: new File(['x'], path),
  size: 1,
  sha256: 'a'.repeat(64),
});

beforeEach(() => {
  cleanup.mockReset().mockResolvedValue(undefined);
  TestWorker.instances = [];
  acknowledgeDisposal = true;
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn() } });
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('client media preparation lifecycle', () => {
  it('returns null for unsupported browser preflight without starting a Worker', async () => {
    vi.stubGlobal('isSecureContext', false);
    expect(await prepareMedia(file, options())).toBeNull();
    expect(TestWorker.instances).toHaveLength(0);
  });

  it('returns local unavailability only before processing begins', async () => {
    onPrepare = (worker) =>
      worker.emit({
        type: 'error',
        error: {
          name: 'ClientMediaUnavailableError',
          message: 'Unsupported source',
          unavailableReason: 'source',
          processingStarted: false,
        },
      });
    expect(await prepareMedia(file, options())).toBeNull();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('throws typed resource failure after processing or artifact generation begins', async () => {
    onPrepare = (worker) =>
      worker.emit({
        type: 'error',
        error: {
          name: 'ClientMediaUnavailableError',
          message: 'Storage full',
          unavailableReason: 'resource',
          processingStarted: true,
        },
      });
    await expect(prepareMedia(file, options())).rejects.toBeInstanceOf(ClientMediaUnavailableError);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('retains prepared files until explicit commit/cancel disposal and keeps progress monotonic', async () => {
    onPrepare = (worker) => {
      worker.emit({ type: 'progress', progress: 0.5 });
      worker.emit({ type: 'progress', progress: 0.2 });
      worker.emit({
        type: 'complete',
        storageId: worker.namespace,
        sourceFingerprint: `client-media-source-v1:${'a'.repeat(64)}`,
        metadata: { kind: 'audio', durationSeconds: 1 },
        artifacts: ['master.m3u8', 'waveform.json', 'spectrogram.png'].map(artifact),
      });
    };
    const config = options();
    const prepared = await prepareMedia(file, config);
    expect(config.onProgress.mock.calls.map(([progress]) => progress)).toEqual([0.5, 0.5]);
    expect(cleanup).not.toHaveBeenCalled();
    expect(TestWorker.instances[0].terminate).not.toHaveBeenCalled();
    acknowledgeDisposal = false;
    const disposal = prepared!.dispose();
    expect(cleanup).not.toHaveBeenCalled();
    expect(TestWorker.instances[0].terminate).not.toHaveBeenCalled();
    TestWorker.instances[0].emit({ type: 'disposed' });
    await disposal;
    await prepared!.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('rejects an incomplete bundle instead of uploading it or falling back', async () => {
    onPrepare = (worker) =>
      worker.emit({
        type: 'complete',
        storageId: worker.namespace,
        sourceFingerprint: `client-media-source-v1:${'a'.repeat(64)}`,
        metadata: { kind: 'audio', durationSeconds: 1 },
        artifacts: [artifact('master.m3u8')],
      });
    await expect(prepareMedia(file, options())).rejects.toThrow('incomplete');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('preserves AbortError and cleans storage when canceled during processing', async () => {
    const controller = new AbortController();
    onPrepare = () => controller.abort();
    await expect(prepareMedia(file, { signal: controller.signal, onProgress: vi.fn() })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

it('terminates and cleans the namespace at the five-second deadline when Worker ACK is missing', async () => {
  vi.useFakeTimers();
  acknowledgeDisposal = false;
  onPrepare = (worker) =>
    worker.emit({
      type: 'complete',
      storageId: worker.namespace,
      sourceFingerprint: `client-media-source-v1:${'a'.repeat(64)}`,
      metadata: { kind: 'audio', durationSeconds: 1 },
      artifacts: ['master.m3u8', 'waveform.json', 'spectrogram.png'].map(artifact),
    });
  const preparedPromise = prepareMedia(file, options());
  await vi.advanceTimersByTimeAsync(0);
  const prepared = await preparedPromise;
  const disposed = prepared!.dispose();
  await vi.advanceTimersByTimeAsync(4999);
  expect(TestWorker.instances[0].terminate).not.toHaveBeenCalled();
  expect(cleanup).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await disposed;
  expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  expect(cleanup).toHaveBeenCalledOnce();
});
