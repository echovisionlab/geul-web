import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadClientMediaArtifact } from './client-media-transport';

class TestXHR {
  static instances: TestXHR[] = [];
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onprogress: ((event: ProgressEvent) => void) | null = null;
  status = 204;
  statusText = '';
  responseText = '';
  responseType = '';
  withCredentials = false;
  timeout = 0;
  getResponseHeader = vi.fn((): string | null => null);
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  constructor() {
    TestXHR.instances.push(this);
  }
}

beforeEach(() => {
  TestXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', TestXHR);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function request(signal = new AbortController().signal) {
  return {
    fileId: 'file-1',
    uploadId: 'upload-1',
    bundleId: 'bundle-1',
    path: 'seg 1.ts',
    file: new Blob(['1234'], { type: 'video/mp2t' }),
    signal,
  };
}

describe('client media artifact transport', () => {
  it.each([200, 204])('uses authenticated PUT and waits for server ACK %s after all bytes', async (status) => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const completed = vi.fn();
    const promise = uploadClientMediaArtifact({ ...request(controller.signal), onProgress }).then(completed);
    const xhr = TestXHR.instances[0];
    xhr.status = status;
    expect(xhr.open).toHaveBeenCalledWith(
      'PUT',
      '/api/upload/media-artifact?fileId=file-1&uploadId=upload-1&bundleId=bundle-1&path=seg+1.ts',
    );
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'video/mp2t');
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 8 } as ProgressEvent);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: 4, total: 4 });
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    xhr.onload?.();
    await promise;
    expect(completed).toHaveBeenCalledOnce();
    controller.abort();
    expect(xhr.abort).not.toHaveBeenCalled();
  });

  it.each([400, 403, 422])('rejects terminal HTTP %s even after all bytes were sent', async (status) => {
    vi.useFakeTimers();
    const promise = uploadClientMediaArtifact(request());
    const xhr = TestXHR.instances[0];
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4 } as ProgressEvent);
    xhr.status = status;
    xhr.responseText = 'hash mismatch';
    xhr.onload?.();
    await expect(promise).rejects.toMatchObject({ status });
    expect(TestXHR.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['onerror', 'ontimeout'] as const)('retries %s and waits for the new server ACK', async (event) => {
    vi.useFakeTimers();
    const promise = uploadClientMediaArtifact(request());
    TestXHR.instances[0][event]?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(TestXHR.instances).toHaveLength(2);
    TestXHR.instances[1].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it('honors Retry-After after artifact 503', async () => {
    vi.useFakeTimers();
    const promise = uploadClientMediaArtifact(request());
    const xhr = TestXHR.instances[0];
    xhr.status = 503;
    xhr.getResponseHeader = vi.fn(() => '3');
    xhr.onload?.();
    await vi.advanceTimersByTimeAsync(2999);
    expect(TestXHR.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(TestXHR.instances).toHaveLength(2);
    TestXHR.instances[1].onload?.();
    await promise;
  });

  it('cancels while waiting for artifact retry', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = uploadClientMediaArtifact(request(controller.signal));
    const rejected = expect(promise).rejects.toThrow('Upload aborted');
    TestXHR.instances[0].onerror?.();
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await rejected;
    await vi.runAllTimersAsync();
    expect(TestXHR.instances).toHaveLength(1);
  });

  it('allows a slow active upload without imposing a total transfer timeout', async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    const promise = uploadClientMediaArtifact(request()).then(completed);
    const xhr = TestXHR.instances[0];
    expect(xhr.timeout).toBe(0);
    await vi.advanceTimersByTimeAsync(90_000);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1 } as ProgressEvent);
    await vi.advanceTimersByTimeAsync(90_000);
    xhr.onprogress?.({ lengthComputable: false, loaded: 2 } as ProgressEvent);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(completed).not.toHaveBeenCalled();
    expect(TestXHR.instances).toHaveLength(1);
    xhr.onload?.();
    await promise;
    expect(completed).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts stalled artifact I/O after 120 seconds and retries without classifying it as user cancellation', async () => {
    vi.useFakeTimers();
    const promise = uploadClientMediaArtifact(request());
    const first = TestXHR.instances[0];
    await vi.advanceTimersByTimeAsync(119_999);
    expect(first.abort).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(first.abort).toHaveBeenCalledOnce();
    expect(first.onload).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(TestXHR.instances).toHaveLength(2);
    TestXHR.instances[1].onload?.();
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels XHR and removes callbacks/listener', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = uploadClientMediaArtifact(request(controller.signal));
    controller.abort();
    await expect(promise).rejects.toThrow('Upload aborted');
    expect(TestXHR.instances[0].abort).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(TestXHR.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
