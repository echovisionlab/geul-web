import { vi } from 'vitest';
import type { DirectUploadRuntime } from './direct-upload-runner';
import type { InFlightServerLifecycle } from './file-upload-contract';
import type { PreparedMedia } from '@/lib/media/client-processing/contracts';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';

export class UploadXMLHttpRequest {
  static DONE = 4;
  static instances: UploadXMLHttpRequest[] = [];
  static sendHandler: ((xhr: UploadXMLHttpRequest, chunk: Blob) => void) | null = null;
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  readyState = 0;
  responseText = '';
  status = 0;
  statusText = '';
  withCredentials = false;
  responseType = '';
  url = '';
  open(_method: string, url: string) {
    this.url = url;
    UploadXMLHttpRequest.instances.push(this);
  }
  setRequestHeader() {}
  getResponseHeader() {
    return null;
  }
  abort() {
    this.readyState = UploadXMLHttpRequest.DONE;
    this.onabort?.();
  }
  succeed(chunk?: Blob) {
    if (chunk) {
      this.upload.onprogress?.({ lengthComputable: true, loaded: chunk.size, total: chunk.size } as ProgressEvent);
    }
    this.readyState = UploadXMLHttpRequest.DONE;
    this.status = 200;
    this.responseText = JSON.stringify({ etag: 'etag-1' });
    this.onload?.();
  }
  send(chunk: Blob) {
    if (UploadXMLHttpRequest.sendHandler) {
      UploadXMLHttpRequest.sendHandler(this, chunk);
    } else {
      this.succeed(chunk);
    }
  }
}

export function uploadFetch(input: RequestInfo | URL) {
  const url = new URL(String(input), 'https://studio.example.com');
  if (url.pathname === '/api/upload/prefix') {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.pathname === '/api/upload/part/presign') {
    return Promise.resolve(
      Response.json({ url: `https://s3.example.com/upload?partNumber=${url.searchParams.get('partNumber')}` }),
    );
  }
  if (url.pathname === '/api/upload/part/confirm') {
    return Promise.resolve(Response.json({ etag: `etag-${url.searchParams.get('partNumber')}` }));
  }
  throw new Error(`Unexpected fetch request: ${url.pathname}`);
}

export function sessionFixture() {
  return {
    fileId: 'file-1',
    uploadId: 'upload-1',
    extension: '',
    totalParts: 1,
    chunkSize: 5,
    uploadedParts: [],
    slotId: '',
    attemptId: 'attempt-1',
    resumed: false,
    status: UploadSessionStatus.INITIATED,
  };
}

export function preparedFixture(): PreparedMedia {
  const file = new File(['wave'], 'waveform.json', { type: 'application/json' });
  return {
    storageId: 'geul-client-media-11111111-1111-1111-1111-111111111111',
    sourceFingerprint: 'a'.repeat(64),
    metadata: { kind: 'audio', durationSeconds: 1 },
    artifacts: [{ path: file.name, mimeType: file.type, size: file.size, sha256: 'a'.repeat(64), file }],
    dispose: vi.fn(async () => undefined),
  };
}

export function createUploadRuntime() {
  let aborted = false;
  let paused = false;
  const aborters = new Set<() => void>();
  const runtime = {
    canTrackServerLifecycle: false,
    lifecycleTrackers: new Map<string, InFlightServerLifecycle>(),
    isAborted: () => aborted,
    isPaused: () => paused,
    resetAborted: () => {
      aborted = false;
      paused = false;
    },
    abortActiveUpload: () => {
      aborted = true;
      aborters.forEach((abort) => abort());
    },
    registerPartAborter: (abort: () => void) => {
      aborters.add(abort);
      return () => {
        aborters.delete(abort);
      };
    },
    clearPartAborters: () => aborters.clear(),
    setUploading: vi.fn(),
    initiate: vi.fn<DirectUploadRuntime['initiate']>().mockResolvedValue(sessionFixture()),
    complete: vi.fn<DirectUploadRuntime['complete']>().mockResolvedValue({ fileId: 'file-1', url: '/media/file-1' }),
    prepareBundle: vi.fn<DirectUploadRuntime['prepareBundle']>().mockResolvedValue({ ok: true, bundleId: 'bundle-1' }),
    abort: vi.fn<DirectUploadRuntime['abort']>().mockResolvedValue({ success: true }),
    findCandidate: vi.fn<DirectUploadRuntime['findCandidate']>().mockResolvedValue(null),
    recoverCompleted: vi
      .fn<DirectUploadRuntime['recoverCompleted']>()
      .mockResolvedValue({ fileId: 'file-1', url: '/media/file-1' }),
  } satisfies DirectUploadRuntime;
  return {
    runtime,
    pause: () => {
      paused = true;
      runtime.abortActiveUpload();
    },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export function candidateFixture() {
  return {
    ...sessionFixture(),
    fileName: 'audio.ogg',
    fileSize: 5,
    mimeType: 'audio/ogg',
    fileLastModified: 123,
    lastActivityAt: null,
    clientMediaBundleId: 'bundle-1',
  };
}
