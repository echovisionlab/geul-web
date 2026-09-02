import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadDirectPartWithRetry, uploadRelayedPartWithRetry } from './multipart-transport';

const openedUrls: string[] = [];
const openedMethods: string[] = [];
const requestHeaders: Array<Record<string, string>> = [];
const putStatuses: number[] = [];
const responseBodies: string[] = [];

class FakeXMLHttpRequest {
  static readonly DONE = 4;

  readyState = 0;
  status = 0;
  statusText = '';
  responseText = '';
  responseType: XMLHttpRequestResponseType = '';
  withCredentials = false;
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onerror: ((event: ProgressEvent) => void) | null = null;
  onabort: ((event: ProgressEvent) => void) | null = null;
  onload: ((event: ProgressEvent) => void) | null = null;

  private headers: Record<string, string> = {};

  open(method: string, url: string) {
    openedMethods.push(method);
    openedUrls.push(url);
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  send(body: Blob) {
    this.readyState = FakeXMLHttpRequest.DONE;
    this.status = putStatuses.shift() ?? 200;
    this.responseText = responseBodies.shift() ?? '';
    requestHeaders.push({ ...this.headers });
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
});
