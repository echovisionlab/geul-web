import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadClientMediaArtifact } from './client-media-transport';

class TestXHR {
  static instances: TestXHR[] = [];
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 204;
  statusText = '';
  responseText = '';
  responseType = '';
  withCredentials = false;
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
afterEach(() => vi.unstubAllGlobals());

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

  it('rejects HTTP failures even after all bytes were sent', async () => {
    const promise = uploadClientMediaArtifact(request());
    const xhr = TestXHR.instances[0];
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4 } as ProgressEvent);
    xhr.status = 422;
    xhr.responseText = 'hash mismatch';
    xhr.onload?.();
    await expect(promise).rejects.toMatchObject({ status: 422 });
  });

  it.each(['onerror', 'ontimeout'] as const)('rejects %s', async (event) => {
    const promise = uploadClientMediaArtifact(request());
    TestXHR.instances[0][event]?.();
    await expect(promise).rejects.toThrow('Upload failed');
  });

  it('cancels XHR and removes callbacks/listener', async () => {
    const controller = new AbortController();
    const promise = uploadClientMediaArtifact(request(controller.signal));
    controller.abort();
    await expect(promise).rejects.toThrow('Upload aborted');
    expect(TestXHR.instances[0].abort).toHaveBeenCalledOnce();
  });
});
