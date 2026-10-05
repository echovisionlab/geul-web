import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadDirectPartWithRetry, uploadRelayedPartWithRetry, verifyUploadPrefix } from './multipart-transport';

const openedUrls: string[] = [];
const openedMethods: string[] = [];
const requestHeaders: Array<Record<string, string>> = [];
const putStatuses: number[] = [];
const responseBodies: string[] = [];
const sentBytes: number[] = [];

class FakeXMLHttpRequest {
  static readonly DONE = 4;
  static instances: FakeXMLHttpRequest[] = [];
  static autoRespond = true;

  readyState = 0;
  status = 0;
  statusText = '';
  responseText = '';
  responseType: XMLHttpRequestResponseType = '';
  withCredentials = false;
  timeout = 0;
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onerror: ((event: ProgressEvent) => void) | null = null;
  onabort: ((event: ProgressEvent) => void) | null = null;
  onload: ((event: ProgressEvent) => void) | null = null;
  onprogress: ((event: ProgressEvent) => void) | null = null;
  ontimeout: ((event: ProgressEvent) => void) | null = null;

  private headers: Record<string, string> = {};

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    openedMethods.push(method);
    openedUrls.push(url);
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  getResponseHeader() {
    return null;
  }

  send(body: Blob) {
    this.readyState = 1;
    requestHeaders.push({ ...this.headers });
    sentBytes.push(body.size);
    if (!FakeXMLHttpRequest.autoRespond) {
      return;
    }
    this.readyState = FakeXMLHttpRequest.DONE;
    this.status = putStatuses.shift() ?? 200;
    this.responseText = responseBodies.shift() ?? '';
    this.upload.onprogress?.({ lengthComputable: true, loaded: body.size } as ProgressEvent);
    this.onload?.({} as ProgressEvent);
  }

  abort() {
    this.readyState = FakeXMLHttpRequest.DONE;
    this.onabort?.({} as ProgressEvent);
  }
}

describe('multipart presigned transport', () => {
  beforeEach(() => {
    openedUrls.length = 0;
    openedMethods.length = 0;
    requestHeaders.length = 0;
    putStatuses.length = 0;
    responseBodies.length = 0;
    sentBytes.length = 0;
    FakeXMLHttpRequest.instances = [];
    FakeXMLHttpRequest.autoRespond = true;
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses authenticated control calls around a credential-free direct PUT', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/part/presign')) {
        return Response.json({ url: 'https://s3.example.invalid/geul/file.bin?signature=one' });
      }
      return Response.json({ etag: 'confirmed-etag' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const registerAborter = vi.fn(() => vi.fn());

    const etag = await uploadDirectPartWithRetry({
      fileId: 'file-id',
      uploadId: 'upload-id',
      correlationId: 'correlation-id',
      partNumber: 2,
      chunk: new Blob(['part-body']),
      isAborted: () => false,
      onProgress: vi.fn(),
      registerAborter,
    });

    expect(etag).toBe('confirmed-etag');
    expect(openedUrls).toEqual(['https://s3.example.invalid/geul/file.bin?signature=one']);
    expect(openedMethods).toEqual(['PUT']);
    expect(requestHeaders).toEqual([{}]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/upload/part/presign?');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/upload/part/confirm?');
  });

  it('gets a new part URL after an expired signature response', async () => {
    vi.useFakeTimers();
    putStatuses.push(403, 200);
    let presignCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/part/presign')) {
        presignCount += 1;
        return Response.json({ url: `https://s3.example.invalid/geul/file.bin?signature=${presignCount}` });
      }
      return Response.json({ etag: 'replacement-etag' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = uploadDirectPartWithRetry({
      fileId: 'file-id',
      uploadId: 'upload-id',
      correlationId: 'correlation-id',
      partNumber: 1,
      chunk: new Blob(['part-body']),
      isAborted: () => false,
      onProgress: vi.fn(),
      registerAborter: () => vi.fn(),
    });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe('replacement-etag');
    expect(openedUrls).toEqual([
      'https://s3.example.invalid/geul/file.bin?signature=1',
      'https://s3.example.invalid/geul/file.bin?signature=2',
    ]);
    expect(presignCount).toBe(2);
  });

  it('relays a managed upload part through the authenticated same-origin API path', async () => {
    responseBodies.push(JSON.stringify({ etag: 'relayed-etag' }));

    const etag = await uploadRelayedPartWithRetry({
      fileId: 'file-id',
      uploadId: 'upload-id',
      correlationId: 'correlation-id',
      partNumber: 1,
      chunk: new Blob(['managed-image']),
      isAborted: () => false,
      onProgress: vi.fn(),
      registerAborter: () => vi.fn(),
    });

    expect(etag).toBe('relayed-etag');
    expect(openedMethods).toEqual(['PUT']);
    expect(openedUrls).toHaveLength(1);
    expect(openedUrls[0]).toContain('/api/upload/part?');
    expect(requestHeaders).toEqual([{ 'content-type': 'application/octet-stream' }]);
  });

  it.each(['503', 'Failed to fetch', 'Load failed', 'fetch failed'])(
    'retries confirmation %s without resending a successful 10 MiB PUT',
    async (failure) => {
      vi.useFakeTimers();
      let confirmCount = 0;
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes('/part/presign')) {
          return Response.json({ url: 'https://s3.example.invalid/part' });
        }
        confirmCount += 1;
        if (confirmCount === 1) {
          if (failure === '503') {
            return new Response('unavailable', { status: 503 });
          }
          throw new TypeError(failure);
        }
        return Response.json({ etag: 'confirmed-etag' });
      });
      vi.stubGlobal('fetch', fetchMock);
      const chunk = new Blob([new Uint8Array(10 * 1024 * 1024)]);
      const result = uploadDirectPartWithRetry({
        fileId: 'file-id',
        uploadId: 'upload-id',
        correlationId: 'correlation-id',
        partNumber: 1,
        chunk,
        isAborted: () => false,
        onProgress: vi.fn(),
        registerAborter: () => vi.fn(),
      });
      await vi.runAllTimersAsync();
      await expect(result).resolves.toBe('confirmed-etag');
      expect(confirmCount).toBe(2);
      expect(openedMethods).toEqual(['PUT']);
      expect(sentBytes).toEqual([10 * 1024 * 1024]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it.each(['503', 'Failed to fetch', 'Load failed', 'fetch failed'])(
    'retries prefix verification after %s',
    async (failure) => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(async () => {
          if (failure === '503') {
            return new Response('unavailable', { status: 503 });
          }
          throw new TypeError(failure);
        })
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchMock);
      const prefix = new Blob(['prefix']);
      const result = verifyUploadPrefix({
        fileId: 'file-id',
        uploadId: 'upload-id',
        correlationId: 'correlation-id',
        prefix,
        registerAborter: () => vi.fn(),
      });
      await vi.runAllTimersAsync();
      await expect(result).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].body).toBe(prefix);
    },
  );

  it('retries a native fetch failure when obtaining a signer', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(Response.json({ url: 'https://s3.example.invalid/part' }))
      .mockResolvedValueOnce(Response.json({ etag: 'etag' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = uploadDirectPartWithRetry({
      fileId: 'file-id',
      uploadId: 'upload-id',
      correlationId: 'correlation-id',
      partNumber: 1,
      chunk: new Blob(['part']),
      isAborted: () => false,
      onProgress: vi.fn(),
      registerAborter: () => vi.fn(),
    });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('etag');
    expect(openedMethods).toEqual(['PUT']);
  });

  it('keeps a control permission failure terminal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      verifyUploadPrefix({
        fileId: 'file-id',
        uploadId: 'upload-id',
        correlationId: 'correlation-id',
        prefix: new Blob(['prefix']),
        registerAborter: () => vi.fn(),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  function controlledUpload(direct: boolean, aborters = new Set<() => void>()) {
    FakeXMLHttpRequest.autoRespond = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('/presign')
          ? Response.json({ url: 'https://s3.example.invalid/part' })
          : Response.json({ etag: 'etag' }),
      ),
    );
    const upload = direct ? uploadDirectPartWithRetry : uploadRelayedPartWithRetry;
    return upload({
      fileId: 'file-id',
      uploadId: 'upload-id',
      correlationId: 'correlation-id',
      partNumber: 1,
      chunk: new Blob(['body']),
      isAborted: () => false,
      onProgress: vi.fn(),
      registerAborter: (aborter) => {
        aborters.add(aborter);
        return () => {
          aborters.delete(aborter);
        };
      },
    });
  }

  function acknowledge(xhr: FakeXMLHttpRequest) {
    xhr.readyState = FakeXMLHttpRequest.DONE;
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ etag: 'etag' });
    xhr.onload?.({} as ProgressEvent);
  }

  it.each([true, false])('direct=%s restarts after 120 seconds without I/O instead of hanging', async (direct) => {
    vi.useFakeTimers();
    const result = controlledUpload(direct);
    await vi.advanceTimersByTimeAsync(0);
    const first = FakeXMLHttpRequest.instances[0];
    const abort = vi.spyOn(first, 'abort');
    await vi.advanceTimersByTimeAsync(119_999);
    expect(abort).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(abort).toHaveBeenCalledOnce();
    expect(first.onload).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeXMLHttpRequest.instances).toHaveLength(2);
    acknowledge(FakeXMLHttpRequest.instances[1]);
    await expect(result).resolves.toBe('etag');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([true, false])('direct=%s allows ongoing upload/download progress beyond 120 seconds', async (direct) => {
    vi.useFakeTimers();
    const result = controlledUpload(direct);
    await vi.advanceTimersByTimeAsync(0);
    const xhr = FakeXMLHttpRequest.instances[0];
    const abort = vi.spyOn(xhr, 'abort');
    expect(xhr.timeout).toBe(0);
    await vi.advanceTimersByTimeAsync(90_000);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1 } as ProgressEvent);
    await vi.advanceTimersByTimeAsync(90_000);
    xhr.onprogress?.({ lengthComputable: false, loaded: 2 } as ProgressEvent);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(abort).not.toHaveBeenCalled();
    expect(FakeXMLHttpRequest.instances).toHaveLength(1);
    acknowledge(xhr);
    await expect(result).resolves.toBe('etag');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([true, false])(
    'direct=%s never retries user cancellation and clears the inactivity timer',
    async (direct) => {
      vi.useFakeTimers();
      const aborters = new Set<() => void>();
      const result = controlledUpload(direct, aborters);
      const rejected = expect(result).rejects.toThrow('Upload aborted');
      await vi.advanceTimersByTimeAsync(0);
      aborters.forEach((aborter) => aborter());
      await rejected;
      await vi.runAllTimersAsync();
      expect(FakeXMLHttpRequest.instances).toHaveLength(1);
      expect(aborters.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
