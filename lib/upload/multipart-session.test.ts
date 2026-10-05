import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMultipartUploadSession } from './multipart-session';

const openedRequests: Array<{ method: string; url: string; withCredentials: boolean }> = [];
const activeRequests = new Map<number, SessionXMLHttpRequest>();
let holdRemainingParts = false;

class SessionXMLHttpRequest {
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

  private method = '';
  private url = '';

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader() {}
  getResponseHeader() {
    return null;
  }

  send(body: Blob) {
    openedRequests.push({ method: this.method, url: this.url, withCredentials: this.withCredentials });
    const partNumber = Number(new URL(this.url, 'https://studio.example.invalid').searchParams.get('partNumber'));
    if (holdRemainingParts && partNumber > 1) {
      activeRequests.set(partNumber, this);
      return;
    }
    this.readyState = SessionXMLHttpRequest.DONE;
    this.status = 200;
    this.responseText = this.url.startsWith('/api/upload/part?') ? JSON.stringify({ etag: 'relay-etag' }) : '';
    this.upload.onprogress?.({ lengthComputable: true, loaded: body.size } as ProgressEvent);
    this.onload?.({} as ProgressEvent);
  }

  abort() {
    this.readyState = SessionXMLHttpRequest.DONE;
    this.onabort?.({} as ProgressEvent);
  }
}

function sessionOptions(uploadType: UploadType) {
  return {
    uploadType,
    file: new File(['webp'], 'image.webp', { type: 'image/webp' }),
    fileId: 'file-id',
    uploadId: 'upload-id',
    chunkSize: 10 * 1024 * 1024,
    totalParts: 1,
    uploadedParts: [],
    correlationId: 'correlation-id',
    concurrency: 3,
    isAborted: () => false,
    registerAborter: () => vi.fn(),
    onProgress: vi.fn(),
  };
}

describe('multipart session transport routing', () => {
  beforeEach(() => {
    openedRequests.length = 0;
    activeRequests.clear();
    holdRemainingParts = false;
    vi.stubGlobal('XMLHttpRequest', SessionXMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps managed public assets on the authenticated API relay', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await runMultipartUploadSession(sessionOptions(UploadType.USER_AVATAR));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(openedRequests).toEqual([
      {
        method: 'PUT',
        url: expect.stringContaining('/api/upload/part?'),
        withCredentials: true,
      },
    ]);
  });

  it('uses prefix, presign, direct PUT, and confirm for approved editor media', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/prefix?')) {
        return new Response(null, { status: 204 });
      }
      if (url.includes('/part/presign?')) {
        return Response.json({ url: 'https://s3.example.invalid/geul/editor-image.webp?signature=one' });
      }
      return Response.json({ etag: 'direct-etag' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await runMultipartUploadSession(sessionOptions(UploadType.EDITOR_IMAGE));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.map(([input]) => new URL(String(input), 'https://studio.example.invalid').pathname),
    ).toEqual(['/api/upload/prefix', '/api/upload/part/presign', '/api/upload/part/confirm']);
    expect(openedRequests).toEqual([
      {
        method: 'PUT',
        url: 'https://s3.example.invalid/geul/editor-image.webp?signature=one',
        withCredentials: false,
      },
    ]);
  });

  it('waits for sibling parts to settle before reporting failure and never starts the next batch', async () => {
    holdRemainingParts = true;
    const aborters = new Set<() => void>();
    const onProgress = vi.fn();
    const reported = vi.fn();
    const failure = new Error('observed failure');
    const result = runMultipartUploadSession({
      ...sessionOptions(UploadType.USER_AVATAR),
      file: new File(['12345678'], 'file.bin'),
      chunkSize: 2,
      totalParts: 4,
      concurrency: 2,
      onProgress,
      registerAborter: (aborter) => {
        aborters.add(aborter);
        return () => {
          aborters.delete(aborter);
        };
      },
    });
    const outcome = result.catch((error) => {
      reported(error);
      throw error;
    });
    const rejected = expect(outcome).rejects.toMatchObject({ status: 400 });
    await vi.waitFor(() => expect(activeRequests.size).toBe(2));
    const failedPart = activeRequests.get(2)!;
    failedPart.status = 400;
    failedPart.responseText = failure.message;
    failedPart.onload?.({} as ProgressEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reported).not.toHaveBeenCalled();
    expect(aborters.size).toBeGreaterThan(0);
    const sibling = activeRequests.get(3)!;
    sibling.upload.onprogress?.({ lengthComputable: true, loaded: 1 } as ProgressEvent);
    sibling.status = 200;
    sibling.responseText = JSON.stringify({ etag: 'sibling-etag' });
    sibling.onload?.({} as ProgressEvent);
    await rejected;
    expect(reported).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ loadedBytes: 4 }));
    expect(activeRequests.has(4)).toBe(false);
    expect(aborters.size).toBe(0);
    expect(sibling.upload.onprogress).toBeNull();
  });
});
