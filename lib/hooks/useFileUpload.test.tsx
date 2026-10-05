// @vitest-environment jsdom

import { act } from 'react';
import { Code, ConnectError } from '@connectrpc/connect';
import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHocuspocusProviderFixture,
  type HocuspocusProviderFixture,
} from '@/features/editor/hocuspocusProvider.test-fixture';
import {
  abortUploadAction,
  completeUploadAction,
  completeClientMediaUploadAction,
  recoverCompletedClientMediaUploadAction,
  prepareClientMediaUploadAction,
  downloadFromUrlAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  recoverCompletedUploadAction,
} from '@/lib/actions/file';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { UploadType } from '@/lib/types/upload/model';
import { useFileUpload } from './useFileUpload';
import { downloadRemoteSource } from '@/lib/upload/remote-source';
import { prepareMedia, type PreparedMedia } from '@/lib/media/client-processing/processor';
import { uploadClientMediaArtifact } from '@/lib/upload/client-media-transport';
import { buildUploadSurfaceKey, cancelUploadSurface } from '@/lib/hooks/uploadSurfaceActivity';
import { createUploadPartError } from '@/lib/upload/upload-errors';
import {
  disposePreparedSession,
  forgetUploadSession,
  readUploadSession,
  rememberPreparedSession,
  rememberUploadSession,
} from '@/lib/upload/upload-session-store';

const runtimeSubscription = vi.hoisted(() => ({
  listener: null as ((event: EditorRuntimeEvent) => void) | null,
}));
const persistCollaborativeDocumentNowMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: persistCollaborativeDocumentNowMock,
}));

vi.mock('@/lib/collab/subscribe-runtime-events', () => ({
  subscribeToProviderRuntimeEvents: (_provider: unknown, listener: (event: EditorRuntimeEvent) => void) => {
    runtimeSubscription.listener = listener;
    return () => {
      if (runtimeSubscription.listener === listener) {
        runtimeSubscription.listener = null;
      }
    };
  },
}));

vi.mock('@/lib/upload/remote-source', () => ({ downloadRemoteSource: vi.fn() }));

vi.mock('@/lib/actions/file', () => ({
  abortUploadAction: vi.fn(),
  prepareClientMediaUploadAction: vi.fn(),
  completeUploadAction: vi.fn(),
  completeClientMediaUploadAction: vi.fn(),
  recoverCompletedClientMediaUploadAction: vi.fn(),
  downloadFromUrlAction: vi.fn(),
  findMultipartUploadCandidateAction: vi.fn(),
  initiateUploadAction: vi.fn(),
  recoverCompletedUploadAction: vi.fn(),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/utils/upload-pipeline', () => ({
  prepareUploadFile: async (file: File) => ({
    file,
    mimeType: file.type || 'audio/ogg',
  }),
}));

vi.mock('@/lib/media/client-processing/processor', async () => {
  const actual = await vi.importActual<typeof import('@/lib/media/client-processing/contracts')>(
    '@/lib/media/client-processing/contracts',
  );
  return {
    prepareMedia: vi.fn(async () => null),
    restoreMedia: vi.fn(async () => null),
    ClientMediaRestoreMismatchError: actual.ClientMediaRestoreMismatchError,
  };
});
vi.mock('@/lib/upload/client-media-transport', () => ({ uploadClientMediaArtifact: vi.fn(async () => undefined) }));

class MockXMLHttpRequest {
  static DONE = 4;
  static instances: MockXMLHttpRequest[] = [];
  static sendHandler: ((xhr: MockXMLHttpRequest, chunk: Blob) => void) | null = null;

  upload = {
    onprogress: null as ((event: ProgressEvent) => void) | null,
  };
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
    MockXMLHttpRequest.instances.push(this);
  }
  setRequestHeader() {}
  getResponseHeader() {
    return null;
  }
  abort() {
    this.readyState = MockXMLHttpRequest.DONE;
    this.onabort?.();
  }
  send(chunk: Blob) {
    if (MockXMLHttpRequest.sendHandler) {
      MockXMLHttpRequest.sendHandler(this, chunk);
      return;
    }
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded: chunk.size,
      total: chunk.size,
    } as ProgressEvent);
    this.readyState = MockXMLHttpRequest.DONE;
    this.status = 200;
    this.responseText = JSON.stringify({ etag: 'etag-1' });
    this.onload?.();
  }
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let runtimeProviderFixture: HocuspocusProviderFixture | null = null;

function render(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  runtimeProviderFixture = createHocuspocusProviderFixture('release:release-1:und');
  const { provider } = runtimeProviderFixture;

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <EditorRuntimeProvider provider={provider} entityType="release" entityId="release-1">
          {node}
        </EditorRuntimeProvider>
      </QueryClientProvider>,
    );
  });
}

interface UploadHarnessProps {
  onResolved: () => void;
  onRejected?: (error: unknown) => void;
  onProgress?: (progress: { loaded: number; total: number; percentage: number; stage?: string }) => void;
  onLifecycle?: (update: { stage: string; percentage?: number; error?: string; source: 'local' | 'server' }) => void;
  onMultipartSession?: (session: {
    uploadId: string;
    fileId: string;
    slotId?: string;
    attemptId?: string;
    resumed: boolean;
    resumable: boolean;
  }) => void;
  uploadType?: UploadType;
  clientMedia?: boolean;
  entityId?: string;
  entityType?: TranscodeEntityType;
  file?: File;
  selectFile?: () => File;
  uploadOptions?: Record<string, unknown>;
}

function UploadHarness({
  onResolved,
  onRejected,
  onProgress,
  onLifecycle,
  onMultipartSession,
  uploadType,
  clientMedia = false,
  entityId = 'track-1',
  entityType = TranscodeEntityType.TRACK,
  file,
  selectFile,
  uploadOptions = {},
}: UploadHarnessProps) {
  const { upload, abort, pauseUpload } = useFileUpload();

  return (
    <>
      <button id="pause-upload" type="button" onClick={pauseUpload}>
        pause
      </button>
      <button id="cancel-upload" type="button" onClick={abort}>
        cancel
      </button>
      <button
        id="start-upload"
        type="button"
        onClick={() => {
          void upload(
            selectFile?.() ??
              file ??
              (clientMedia
                ? new File(['audio'], 'audio.ogg', { type: 'audio/ogg' })
                : new File(['bytes'], 'file.bin', { type: 'application/octet-stream' })),
            {
              uploadType: uploadType ?? (clientMedia ? UploadType.TRACK_AUDIO : UploadType.GENERAL_FILE),
              entityId,
              entityType,
              correlationId: 'correlation-1',
              ...uploadOptions,
              onProgress,
              onLifecycle,
              onMultipartSession,
            },
          ).then(onResolved, onRejected);
        }}
      >
        start
      </button>
    </>
  );
}

function DownloadHarness({
  entityType,
  expectedCurrentFileId,
}: {
  entityType: TranscodeEntityType;
  expectedCurrentFileId?: string;
}) {
  const { downloadFromUrl } = useFileUpload();

  return (
    <button
      id="start-download"
      type="button"
      onClick={() => {
        void downloadFromUrl(UploadType.EDITOR_IMAGE, 'entity-1', 'https://source.example.com/image.png', entityType, {
          correlationId: 'correlation-1',
          surfaceSlotId: 'client-attempt-slot',
          expectedCurrentFileId,
        });
      }}
    >
      start
    </button>
  );
}

describe('useFileUpload', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.mocked(completeClientMediaUploadAction).mockImplementation(async (input) => {
      try {
        return { ok: true, ...(await completeUploadAction(input)) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          errorCode: Code.Unavailable,
        };
      }
    });
    vi.mocked(recoverCompletedClientMediaUploadAction).mockImplementation(async (input) => {
      try {
        return { ok: true, ...(await recoverCompletedUploadAction(input)) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          errorCode: Code.Unavailable,
        };
      }
    });
    vi.mocked(prepareMedia).mockReset().mockResolvedValue(null);
    vi.mocked(uploadClientMediaArtifact).mockReset().mockResolvedValue(undefined);
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input), 'https://studio.example.com');
      if (url.pathname === '/api/upload/prefix') {
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/api/upload/part/presign') {
        return Response.json({
          url: `https://s3.example.com/upload?partNumber=${url.searchParams.get('partNumber')}`,
        });
      }
      if (url.pathname === '/api/upload/part/confirm') {
        const partNumber = url.searchParams.get('partNumber');
        return Response.json({ etag: `etag-${partNumber}` });
      }
      throw new Error(`Unexpected fetch request: ${url.pathname}`);
    });
  });

  afterEach(async () => {
    await disposePreparedSession('file-1');
    forgetUploadSession('file-1');
    localStorage.clear();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    runtimeProviderFixture?.destroy();
    runtimeProviderFixture = null;
    runtimeSubscription.listener = null;
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
    globalThis.fetch = originalFetch;
    MockXMLHttpRequest.instances = [];
    MockXMLHttpRequest.sendHandler = null;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'page shared first attach',
      entityType: TranscodeEntityType.PAGE,
      expectedCurrentFileId: undefined,
    },
    {
      name: 'post replacement',
      entityType: TranscodeEntityType.POST,
      expectedCurrentFileId: '046a1c17-f9ae-4ca6-a3aa-d7027dfd00b3',
    },
  ])('imports $name through the direct-upload pipeline with untargeted editor attachment', async (testCase) => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const dispose = vi.fn(async () => undefined);
    vi.mocked(downloadRemoteSource).mockResolvedValue({
      file: new File(['image'], 'image.png', { type: 'image/png', lastModified: 0 }),
      storageId: 'geul-client-media-source',
      dispose,
    });
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({ url: '/media/file-1', fileId: 'file-1' } as never);

    render(<DownloadHarness entityType={testCase.entityType} expectedCurrentFileId={testCase.expectedCurrentFileId} />);

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-download')?.click();
    });

    await expect.poll(() => vi.mocked(completeUploadAction).mock.calls.length).toBe(1);
    expect(persistCollaborativeDocumentNowMock).not.toHaveBeenCalled();
    expect(downloadFromUrlAction).not.toHaveBeenCalled();
    expect(vi.mocked(downloadRemoteSource).mock.calls[0]?.slice(0, 2)).toEqual([
      'https://source.example.com/image.png',
      expect.objectContaining({
        uploadType: UploadType.EDITOR_IMAGE,
        entityId: 'entity-1',
        entityType: testCase.entityType,
        correlationId: 'correlation-1',
        surfaceSlotId: 'client-attempt-slot',
        expectedCurrentFileId: testCase.expectedCurrentFileId,
      }),
    ]);
    expect(vi.mocked(initiateUploadAction).mock.calls[0]?.[0]).toMatchObject({
      entityId: '',
      entityType: undefined,
      slotId: undefined,
      expectedCurrentFileId: undefined,
    });
    await expect.poll(() => dispose.mock.calls.length).toBe(1);
  });

  it.each([
    UploadType.EDITOR_IMAGE,
    UploadType.EDITOR_VIDEO,
    UploadType.EDITOR_AUDIO,
    UploadType.EDITOR_ATTACHMENT,
    UploadType.EDITOR_MESH,
  ])('hard-cuts server attachment targets from editor upload type %s', async (uploadType) => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({ url: '/media/file-1', fileId: 'file-1' } as never);
    const onMultipartSession = vi.fn();

    render(
      <UploadHarness
        uploadType={uploadType}
        entityId="post-1"
        entityType={TranscodeEntityType.POST}
        onResolved={() => undefined}
        onMultipartSession={onMultipartSession}
        uploadOptions={{
          slotId: 'slot-1',
          expectedCurrentFileId: '046a1c17-f9ae-4ca6-a3aa-d7027dfd00b3',
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => vi.mocked(initiateUploadAction).mock.calls.length).toBe(1);
    expect(persistCollaborativeDocumentNowMock).not.toHaveBeenCalled();
    expect(vi.mocked(initiateUploadAction).mock.calls[0]?.[0]).toMatchObject({
      uploadType,
      entityId: '',
      entityType: undefined,
      slotId: undefined,
      expectedCurrentFileId: undefined,
    });
    await expect.poll(() => onMultipartSession.mock.calls.length).toBe(1);
    expect(onMultipartSession).toHaveBeenCalledWith({
      uploadId: 'upload-1',
      fileId: 'file-1',
      slotId: 'slot-1',
      attemptId: 'attempt-1',
      resumed: false,
      resumable: false,
    });
  });

  it('resolves from the backend complete response without waiting for lifecycle fanout', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadUrl: '',
      url: '',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({
      url: '/media/file-1',
      fileId: 'file-1',
    } as never);
    let resolved = false;

    render(<UploadHarness onResolved={() => (resolved = true)} />);

    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => vi.mocked(completeUploadAction).mock.calls.length).toBe(1);
    await expect.poll(() => resolved).toBe(true);
  });

  it('reports the backend upload session attempt returned by initiate', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File(['audio-data'], 'file.bin', { type: 'application/octet-stream' });
    const onMultipartSession = vi.fn();
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      totalParts: 2,
      chunkSize: 5,
      status: 2,
      uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
      resumed: true,
      slotId: 'slot-1',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({
      url: '/media/file-1',
      fileId: 'file-1',
    } as never);
    let resolved = false;

    render(
      <UploadHarness
        file={file}
        onMultipartSession={onMultipartSession}
        onResolved={() => (resolved = true)}
        uploadOptions={{
          slotId: 'slot-1',
        }}
      />,
    );

    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => vi.mocked(completeUploadAction).mock.calls.length).toBe(1);
    expect(vi.mocked(initiateUploadAction).mock.calls[0]?.[0]).not.toHaveProperty('attemptId');
    expect(onMultipartSession).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadId: 'upload-1',
        fileId: 'file-1',
        slotId: 'slot-1',
        attemptId: 'backend-attempt-1',
        resumed: true,
      }),
    );
    await expect.poll(() => resolved).toBe(true);
  });

  it('keeps a failed backend completion in the finalizing lifecycle for same-session retry', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-finalizing-1',
      fileId: 'file-finalizing-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-finalizing-1',
    } as never);
    vi.mocked(completeUploadAction).mockRejectedValue(new Error('backend unavailable'));
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      uploadId: 'upload-finalizing-1',
      fileId: 'file-finalizing-1',
      status: UploadSessionStatus.FINALIZING,
    } as never);
    const onLifecycle = vi.fn();
    const onMultipartSession = vi.fn();
    let rejected: unknown;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onMultipartSession={onMultipartSession}
        onResolved={() => undefined}
        onRejected={(error) => {
          rejected = error;
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => rejected != null).toBe(true);
    expect(onMultipartSession).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'file-finalizing-1',
        resumable: false,
      }),
    );
    expect(rejected).toBeInstanceOf(Error);
    expect((rejected as Error).message).toBe('Upload finalization failed');
    expect(findMultipartUploadCandidateAction).toHaveBeenCalledWith({
      uploadType: UploadType.GENERAL_FILE,
      entityId: '',
      entityType: undefined,
      slotId: undefined,
      expectedCurrentFileId: undefined,
      fileId: 'file-finalizing-1',
      uploadId: 'upload-finalizing-1',
    });
    expect(onLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stage: 'finalizing',
        error: 'Upload finalization failed',
        source: 'local',
      }),
    );
  });

  it('restores a lost Complete response with the exact completion identity', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-response-loss-1',
      fileId: 'file-response-loss-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: UploadSessionStatus.INITIATED,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-response-loss-1',
    } as never);
    vi.mocked(completeUploadAction).mockRejectedValue(new ConnectError('response lost', Code.Unavailable));
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue(null);
    vi.mocked(recoverCompletedUploadAction).mockResolvedValue({
      url: '/media/file-response-loss-1',
      fileId: 'file-response-loss-1',
    });
    const onLifecycle = vi.fn();
    let resolved = false;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onResolved={() => {
          resolved = true;
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => resolved).toBe(true);
    expect(recoverCompletedUploadAction).toHaveBeenCalledWith({
      fileId: 'file-response-loss-1',
      uploadId: 'upload-response-loss-1',
      uploadType: UploadType.GENERAL_FILE,
      correlationId: 'correlation-1',
    });
    expect(onLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stage: 'completed',
        fileId: 'file-response-loss-1',
      }),
    );
  });

  it('keeps the completion identity when candidate authority is temporarily unavailable', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-lookup-loss-1',
      fileId: 'file-lookup-loss-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: UploadSessionStatus.INITIATED,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-lookup-loss-1',
    } as never);
    vi.mocked(completeUploadAction).mockRejectedValue(new ConnectError('complete unavailable', Code.Unavailable));
    vi.mocked(findMultipartUploadCandidateAction).mockRejectedValue(
      new ConnectError('candidate unavailable', Code.Unavailable),
    );
    const onLifecycle = vi.fn();
    let rejected: unknown;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onResolved={() => undefined}
        onRejected={(error) => {
          rejected = error;
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => rejected != null).toBe(true);
    expect((rejected as Error).message).toBe('Upload finalization failed');
    expect(onLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'finalizing' }));
  });

  it('keeps finalizing after the single exact Complete confirmation retry is transient', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-recovery-transient-1',
      fileId: 'file-recovery-transient-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: UploadSessionStatus.INITIATED,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-recovery-transient-1',
    } as never);
    vi.mocked(completeUploadAction).mockRejectedValue(new ConnectError('response lost', Code.Unavailable));
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue(null);
    vi.mocked(recoverCompletedUploadAction).mockRejectedValue(
      new ConnectError('recovery unavailable', Code.Unavailable),
    );
    const onLifecycle = vi.fn();
    let rejected: unknown;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onResolved={() => undefined}
        onRejected={(error) => {
          rejected = error;
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => rejected != null).toBe(true);
    expect(recoverCompletedUploadAction).toHaveBeenCalledTimes(1);
    expect(recoverCompletedUploadAction).toHaveBeenCalledWith({
      fileId: 'file-recovery-transient-1',
      uploadId: 'upload-recovery-transient-1',
      uploadType: UploadType.GENERAL_FILE,
      correlationId: 'correlation-1',
    });
    expect((rejected as Error).message).toBe('Upload finalization failed');
    expect(onLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'finalizing' }));
  });

  it('marks an authoritative completion ownership rejection terminal', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-owner-rejected-1',
      fileId: 'file-owner-rejected-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: UploadSessionStatus.INITIATED,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-owner-rejected-1',
    } as never);
    vi.mocked(completeUploadAction).mockRejectedValue(new ConnectError('complete unavailable', Code.Unavailable));
    vi.mocked(findMultipartUploadCandidateAction).mockRejectedValue(new Error('Forbidden'));
    const onLifecycle = vi.fn();
    let rejected: unknown;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onResolved={() => undefined}
        onRejected={(error) => {
          rejected = error;
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => rejected != null).toBe(true);
    expect((rejected as Error).message).toBe('Forbidden');
    expect(findMultipartUploadCandidateAction).toHaveBeenCalledTimes(1);
    expect(onLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'failed', error: 'Forbidden' }));
  });

  it('marks completion terminal when exact recovery confirms the session failed', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-terminal-1',
      fileId: 'file-terminal-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'attempt-terminal-1',
    } as never);
    vi.mocked(completeUploadAction).mockRejectedValue(
      new Error('failed to complete multipart upload: invalid completed object'),
    );
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue(null);
    vi.mocked(recoverCompletedUploadAction).mockRejectedValue(new Error('Upload failed'));
    const onLifecycle = vi.fn();
    let rejected: unknown;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onResolved={() => undefined}
        onRejected={(error) => {
          rejected = error;
        }}
      />,
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => rejected != null).toBe(true);
    expect(rejected).toBeInstanceOf(Error);
    expect((rejected as Error).message).toBe('Upload failed');
    expect(onLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stage: 'failed',
        error: 'Upload failed',
        source: 'local',
      }),
    );
  });

  it('emits a validating progress update before client-side preprocessing finishes', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadUrl: '',
      url: '',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({
      url: '/media/file-1',
      fileId: 'file-1',
    } as never);
    const onProgress = vi.fn();

    render(<UploadHarness onProgress={onProgress} onResolved={() => undefined} />);

    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => vi.mocked(completeUploadAction).mock.calls.length).toBe(1);
    expect(onProgress.mock.calls[0]?.[0]).toMatchObject({
      loaded: 0,
      percentage: 0,
      stage: 'validating',
    });
  });

  it('ignores stale attempt events and keeps active realtime progress monotonic', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    let pendingRequest: MockXMLHttpRequest | null = null;
    MockXMLHttpRequest.sendHandler = (xhr) => {
      pendingRequest = xhr;
    };
    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadUrl: '',
      url: '',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({
      url: '/media/file-1',
      fileId: 'file-1',
    } as never);
    const onLifecycle = vi.fn();
    let resolved = false;

    render(
      <UploadHarness
        onLifecycle={onLifecycle}
        onResolved={() => {
          resolved = true;
        }}
      />,
    );

    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => pendingRequest != null).toBe(true);

    const emitServerProgress = (
      progress: number,
      identity: { attemptId?: string; fileId?: string; stage?: 'uploading' | 'completed' } = {},
    ) => {
      runtimeSubscription.listener?.({
        version: 1,
        kind: 'file.ingest.lifecycle',
        entityType: 'release',
        entityId: 'release-1',
        correlationId: 'correlation-1',
        timestampMs: 1_700_000_000_000,
        payload: {
          fileId: identity.fileId ?? 'file-1',
          attemptId: identity.attemptId ?? 'backend-attempt-1',
          source: 'upload',
          stage: identity.stage ?? 'uploading',
          progress,
          bytesCompleted: progress,
          bytesTotal: 100,
        },
      });
    };

    act(() => {
      emitServerProgress(100, {
        attemptId: 'backend-attempt-stale',
        fileId: 'file-stale',
        stage: 'completed',
      });
      emitServerProgress(40);
      emitServerProgress(90, {
        attemptId: 'backend-attempt-stale',
        fileId: 'file-stale',
      });
      emitServerProgress(20);
    });

    const serverPercentages = onLifecycle.mock.calls
      .map(([update]) => update)
      .filter((update) => update.source === 'server')
      .map((update) => update.percentage);
    expect(serverPercentages).toEqual([40, 40]);

    act(() => {
      if (!pendingRequest) {
        return;
      }
      pendingRequest.readyState = MockXMLHttpRequest.DONE;
      pendingRequest.status = 200;
      pendingRequest.responseText = JSON.stringify({ etag: 'etag-1' });
      pendingRequest.onload?.();
    });
    await expect.poll(() => resolved).toBe(true);
  });

  it('automatically retries an interrupted part in a ten-part upload and completes', async () => {
    vi.useFakeTimers();
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File([new Uint8Array(50)], 'file.bin', { type: 'application/octet-stream' });
    const partAttempts = new Map<number, number>();

    MockXMLHttpRequest.sendHandler = (xhr, chunk) => {
      const partNumber = Number(new URL(xhr.url, 'https://studio.example.com').searchParams.get('partNumber'));
      const attempt = (partAttempts.get(partNumber) ?? 0) + 1;
      partAttempts.set(partNumber, attempt);

      xhr.upload.onprogress?.({
        lengthComputable: true,
        loaded: chunk.size,
        total: chunk.size,
      } as ProgressEvent);
      xhr.readyState = MockXMLHttpRequest.DONE;

      if (partNumber === 7 && attempt === 1) {
        xhr.status = 408;
        xhr.responseText = 'Upload interrupted';
        xhr.onload?.();
        return;
      }

      xhr.status = 200;
      xhr.responseText = JSON.stringify({ etag: `etag-${partNumber}-${attempt}` });
      xhr.onload?.();
    };

    vi.mocked(initiateUploadAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadUrl: '',
      url: '',
      totalParts: 10,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({
      url: '/media/file-1',
      fileId: 'file-1',
    } as never);
    let resolved = false;
    const progressPercentages: number[] = [];

    render(
      <UploadHarness
        file={file}
        onProgress={(progress) => progressPercentages.push(progress.percentage)}
        onResolved={() => (resolved = true)}
      />,
    );

    expect(runtimeSubscription.listener).not.toBeNull();
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    expect(partAttempts.get(7)).toBe(1);
    expect(completeUploadAction).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(partAttempts.get(7)).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(completeUploadAction).toHaveBeenCalledOnce();
    expect(resolved).toBe(true);
    expect(partAttempts.get(7)).toBe(2);
    expect(progressPercentages.every((value, index) => index === 0 || value >= progressPercentages[index - 1]!)).toBe(
      true,
    );
    expect(vi.mocked(completeUploadAction).mock.calls[0]?.[0]).toMatchObject({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadType: UploadType.GENERAL_FILE,
    });
  });

  it('stops after automatic part retries are exhausted and succeeds when the user resumes the same file', async () => {
    vi.useFakeTimers();
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File([new Uint8Array(50)], 'file.bin', { type: 'application/octet-stream' });
    const partAttemptsByPhase = new Map<string, number>();
    let phase: 'initial' | 'resume' = 'initial';

    MockXMLHttpRequest.sendHandler = (xhr, chunk) => {
      const partNumber = Number(new URL(xhr.url, 'https://studio.example.com').searchParams.get('partNumber'));
      const key = `${phase}:${partNumber}`;
      const attempt = (partAttemptsByPhase.get(key) ?? 0) + 1;
      partAttemptsByPhase.set(key, attempt);

      xhr.upload.onprogress?.({
        lengthComputable: true,
        loaded: chunk.size,
        total: chunk.size,
      } as ProgressEvent);
      xhr.readyState = MockXMLHttpRequest.DONE;

      if (phase === 'initial' && partNumber === 6) {
        xhr.status = 408;
        xhr.responseText = 'Upload interrupted';
        xhr.onload?.();
        return;
      }

      xhr.status = 200;
      xhr.responseText = JSON.stringify({ etag: `etag-${phase}-${partNumber}-${attempt}` });
      xhr.onload?.();
    };

    vi.mocked(initiateUploadAction).mockResolvedValueOnce({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadUrl: '',
      url: '',
      totalParts: 10,
      chunkSize: 5,
      uploadedParts: [],
      status: 1,
      resumed: false,
      slotId: '',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadUrl: '',
      url: '',
      totalParts: 10,
      chunkSize: 5,
      uploadedParts: [1, 2, 3, 4, 5, 7].map((partNumber) => ({
        partNumber,
        etag: `etag-initial-${partNumber}-1`,
      })),
      status: 2,
      resumed: true,
      slotId: '',
      attemptId: 'backend-attempt-1',
    } as never);
    vi.mocked(completeUploadAction).mockResolvedValue({
      url: '/media/file-1',
      fileId: 'file-1',
    } as never);

    let resolved = false;
    let rejected: unknown;
    const uploadOptions: Record<string, unknown> = {};
    const progressByPhase: Record<'initial' | 'resume', number[]> = {
      initial: [],
      resume: [],
    };
    render(
      <UploadHarness
        file={file}
        uploadOptions={uploadOptions}
        onProgress={(progress) => progressByPhase[phase].push(progress.percentage)}
        onResolved={() => (resolved = true)}
        onRejected={(error) => {
          rejected = error;
          phase = 'resume';
        }}
      />,
    );

    expect(runtimeSubscription.listener).not.toBeNull();
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    expect(partAttemptsByPhase.get('initial:6')).toBe(1);
    expect(rejected).toBeUndefined();
    for (const [index, delay] of [1000, 2000, 4000, 8000].entries()) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay - 1);
      });
      expect(partAttemptsByPhase.get('initial:6')).toBe(index + 1);
      expect(rejected).toBeUndefined();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(partAttemptsByPhase.get('initial:6')).toBe(index + 2);
    }
    expect(rejected).toBeInstanceOf(Error);
    expect((rejected as Error).message).toBe('Upload interrupted');
    expect(partAttemptsByPhase.get('initial:6')).toBe(5);
    expect(vi.mocked(completeUploadAction)).not.toHaveBeenCalled();
    for (const partNumber of [1, 2, 3, 4, 5, 7]) {
      expect(partAttemptsByPhase.get(`initial:${partNumber}`)).toBe(1);
    }

    Object.assign(uploadOptions, {
      resumeSession: { fileId: 'file-1', uploadId: 'upload-1' },
    });

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(completeUploadAction).toHaveBeenCalledOnce();
    expect(resolved).toBe(true);
    expect(partAttemptsByPhase.get('resume:6')).toBe(1);
    for (const partNumber of [1, 2, 3, 4, 5, 7]) {
      expect(partAttemptsByPhase.has(`resume:${partNumber}`)).toBe(false);
    }
    expect(progressByPhase.resume[0]).toBe(60);
    expect(
      progressByPhase.resume.every((value, index) => index === 0 || value >= progressByPhase.resume[index - 1]!),
    ).toBe(true);
    expect(vi.mocked(completeUploadAction).mock.calls[0]?.[0]).toMatchObject({
      uploadId: 'upload-1',
      fileId: 'file-1',
    });
  });
  function preparedFixture(): PreparedMedia {
    const artifact = new File(['wave'], 'waveform.json', { type: 'application/json' });
    return {
      storageId: 'geul-client-media-11111111-1111-1111-1111-111111111111',
      sourceFingerprint: 'a'.repeat(64),
      metadata: { kind: 'audio', durationSeconds: 1 },
      artifacts: [
        { path: artifact.name, mimeType: artifact.type, size: artifact.size, sha256: 'a'.repeat(64), file: artifact },
      ],
      dispose: vi.fn(async () => undefined),
    };
  }

  function initiateFixture() {
    vi.mocked(initiateUploadAction).mockResolvedValue({
      fileId: 'file-1',
      uploadId: 'upload-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      slotId: '',
      attemptId: 'attempt-1',
      resumed: false,
    } as never);
    vi.mocked(prepareClientMediaUploadAction).mockResolvedValue({ ok: true, bundleId: 'bundle-1' });
    vi.mocked(completeUploadAction).mockResolvedValue({ fileId: 'file-1', url: '/media/file-1' } as never);
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
  }

  it('prepares before initiating, aggregates artifact bytes, and reserves 100 until commit acknowledgement', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    const steps: string[] = [];
    vi.mocked(prepareMedia).mockImplementation(async (_file, { onProgress }) => {
      expect(initiateUploadAction).not.toHaveBeenCalled();
      steps.push('prepare');
      onProgress(0.5);
      onProgress(1);
      return prepared;
    });
    vi.mocked(uploadClientMediaArtifact).mockImplementation(async ({ onProgress, file }) => {
      expect(prepareClientMediaUploadAction).toHaveBeenCalledOnce();
      steps.push('artifact');
      onProgress?.({ loaded: file.size / 2, total: file.size });
    });
    let acknowledge: ((value: never) => void) | undefined;
    vi.mocked(completeUploadAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }) as never,
    );
    const percentages: number[] = [];
    let resolved = false;
    render(
      <UploadHarness
        clientMedia
        onProgress={({ percentage }) => percentages.push(percentage)}
        onResolved={() => {
          resolved = true;
        }}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => acknowledge != null).toBe(true);
    expect(steps).toEqual(['prepare', 'artifact']);
    expect(percentages).toContain(20);
    expect(percentages).toContain(40);
    expect(percentages.at(-1)).toBe(99);
    expect(Math.max(...percentages)).toBe(99);
    expect(vi.mocked(completeClientMediaUploadAction).mock.calls.at(-1)?.[0]).toMatchObject({
      clientMediaBundleId: 'bundle-1',
    });
    expect(resolved).toBe(false);
    expect(prepared.dispose).not.toHaveBeenCalled();
    await act(async () => {
      acknowledge?.({ fileId: 'file-1', url: '/media/file-1' } as never);
    });
    await expect.poll(() => resolved).toBe(true);
    expect(percentages.at(-1)).toBe(100);
    expect(percentages.every((value, index) => index === 0 || value >= percentages[index - 1]!)).toBe(true);
    expect(prepared.dispose).toHaveBeenCalledOnce();
  });

  it('cancels preparation without initiating or falling back to server encoding', async () => {
    initiateFixture();
    let preparationStarted = false;
    vi.mocked(prepareMedia).mockImplementation(
      (_file, { signal }) =>
        new Promise((_resolve, reject) => {
          preparationStarted = true;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => preparationStarted).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#cancel-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0].message).toBe('Upload aborted');
    expect(initiateUploadAction).not.toHaveBeenCalled();
    expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
  });

  it('uses exact cached artifacts on completion retry without encoding again', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    vi.mocked(completeUploadAction).mockRejectedValueOnce(new Error('Lost response'));
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      fileId: 'file-1',
      uploadId: 'upload-1',
      clientMediaBundleId: 'bundle-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      status: UploadSessionStatus.FINALIZING,
      attemptId: 'attempt-1',
      slotId: '',
    } as never);
    const file = new File(['audio'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 });
    let selectedFile = file;
    const uploadOptions: Record<string, unknown> = {};
    const rejected = vi.fn();
    const resolved = vi.fn();
    render(
      <UploadHarness
        clientMedia
        selectFile={() => selectedFile}
        uploadOptions={uploadOptions}
        onResolved={resolved}
        onRejected={rejected}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(prepared.dispose).not.toHaveBeenCalled();
    selectedFile = new File(['other'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 });
    let retryOriginal: Blob | undefined;
    MockXMLHttpRequest.sendHandler = (xhr, body) => {
      retryOriginal = body;
      xhr.readyState = MockXMLHttpRequest.DONE;
      xhr.status = 200;
      xhr.responseText = JSON.stringify({ etag: 'cached-source-etag' });
      xhr.onload?.();
    };
    Object.assign(uploadOptions, { resumeSession: { fileId: 'file-1', uploadId: 'upload-1' } });
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => resolved.mock.calls.length).toBe(1);
    expect(prepareMedia).toHaveBeenCalledOnce();
    expect(prepareClientMediaUploadAction).toHaveBeenCalledOnce();
    expect(uploadClientMediaArtifact).toHaveBeenCalledOnce();
    expect(prepared.dispose).toHaveBeenCalledOnce();
    const retryBytes = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(retryOriginal!);
    });
    expect(retryBytes).toBe('audio');
  });
  it('cleans up the exact owned session when cancellation arrives during initiation', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    let finishInitiation: ((value: never) => void) | undefined;
    vi.mocked(initiateUploadAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishInitiation = resolve;
        }) as never,
    );
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => finishInitiation != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#cancel-upload')?.click();
    });
    await act(async () => {
      finishInitiation?.({
        fileId: 'file-1',
        uploadId: 'upload-1',
        totalParts: 1,
        chunkSize: 5,
        uploadedParts: [],
      } as never);
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(vi.mocked(abortUploadAction).mock.calls[0]?.[0]).toEqual({
      fileId: 'file-1',
      uploadId: 'upload-1',
      correlationId: 'correlation-1',
    });
    expect(prepareClientMediaUploadAction).not.toHaveBeenCalled();
    expect(MockXMLHttpRequest.instances).toHaveLength(0);
    expect(prepared.dispose).toHaveBeenCalledOnce();
  });

  it('ignores raw server completion until every prepared artifact and commit are acknowledged', async () => {
    initiateFixture();
    vi.mocked(prepareMedia).mockResolvedValue(preparedFixture());
    let finishArtifact: (() => void) | undefined;
    vi.mocked(uploadClientMediaArtifact).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishArtifact = resolve;
        }),
    );
    const lifecycle = vi.fn();
    const resolved = vi.fn();
    render(<UploadHarness clientMedia onResolved={resolved} onLifecycle={lifecycle} />);
    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => finishArtifact != null).toBe(true);
    act(() => {
      runtimeSubscription.listener?.({
        version: 1,
        kind: 'file.ingest.lifecycle',
        entityType: 'release',
        entityId: 'release-1',
        correlationId: 'correlation-1',
        timestampMs: 1,
        payload: { fileId: 'file-1', attemptId: 'attempt-1', source: 'upload', stage: 'completed', progress: 100 },
      });
    });
    expect(lifecycle.mock.calls.filter(([update]) => update.source === 'server')).toHaveLength(0);
    expect(lifecycle.mock.calls.some(([update]) => update.percentage === 100)).toBe(false);
    expect(completeUploadAction).not.toHaveBeenCalled();
    await act(async () => {
      finishArtifact?.();
    });
    await expect.poll(() => resolved.mock.calls.length).toBe(1);
  });

  it('rejects a persisted browser bundle without its original cached artifact bytes', async () => {
    initiateFixture();
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      fileId: 'file-1',
      uploadId: 'upload-1',
      clientMediaBundleId: 'bundle-lost',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [],
      attemptId: 'attempt-1',
      slotId: '',
    } as never);
    const rejected = vi.fn();
    render(
      <UploadHarness
        clientMedia
        uploadOptions={{ resumeSession: { fileId: 'file-1', uploadId: 'upload-1' } }}
        onResolved={vi.fn()}
        onRejected={rejected}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0].message).toContain('Start a new upload');
    expect(prepareMedia).not.toHaveBeenCalled();
    expect(completeUploadAction).not.toHaveBeenCalled();
    expect(MockXMLHttpRequest.instances).toHaveLength(0);
  });
  it('cancels an artifact transfer through the handed-off Track attempt surface', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    let artifactSignal: AbortSignal | undefined;
    vi.mocked(uploadClientMediaArtifact).mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          artifactSignal = signal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => artifactSignal != null).toBe(true);
    act(() => {
      expect(
        cancelUploadSurface(
          buildUploadSurfaceKey({ uploadType: UploadType.TRACK_AUDIO, entityId: 'track-1', attemptId: 'attempt-1' }),
        ),
      ).toBe(true);
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(artifactSignal?.aborted).toBe(true);
    expect(vi.mocked(abortUploadAction).mock.calls[0]?.[0]).toMatchObject({ fileId: 'file-1', uploadId: 'upload-1' });
    expect(completeUploadAction).not.toHaveBeenCalled();
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(readUploadSession('file-1')).toBeNull();
  });

  it('disposes artifacts and revokes its session after definitive artifact validation failure', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    vi.mocked(uploadClientMediaArtifact).mockRejectedValue(createUploadPartError(400, 'hash mismatch'));
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(vi.mocked(abortUploadAction).mock.calls[0]?.[0]).toMatchObject({ fileId: 'file-1', uploadId: 'upload-1' });
    expect(completeUploadAction).not.toHaveBeenCalled();
    expect(readUploadSession('file-1')).toBeNull();
  });
  it('rejects a different source identity and cleans up the previous bundle before a new upload', async () => {
    initiateFixture();
    const source = new File(['audio'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 });
    const prepared = preparedFixture();
    rememberUploadSession({ fileId: 'file-1', uploadId: 'upload-1', clientMediaBundleId: 'bundle-1' });
    rememberPreparedSession('file-1', {
      source,
      uploadId: 'upload-1',
      uploadType: UploadType.TRACK_AUDIO,
      bundleId: 'bundle-1',
      prepared,
      progress: { loadedBytes: 5, percentage: 99 },
    });
    const rejected = vi.fn();
    render(
      <UploadHarness
        clientMedia
        file={new File(['audio'], 'different.ogg', { type: 'audio/ogg', lastModified: 123 })}
        uploadOptions={{ resumeSession: { fileId: 'file-1', uploadId: 'upload-1' } }}
        onResolved={vi.fn()}
        onRejected={rejected}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0].message).toContain('Start a new upload');
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(vi.mocked(abortUploadAction).mock.calls[0]?.[0]).toMatchObject({ fileId: 'file-1', uploadId: 'upload-1' });
    expect(readUploadSession('file-1')).toBeNull();
    expect(initiateUploadAction).not.toHaveBeenCalled();
    expect(completeUploadAction).not.toHaveBeenCalled();
  });
  it('pauses an artifact transfer without deleting its server session or prepared bytes, then resumes', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    let pausedSignal: AbortSignal | undefined;
    vi.mocked(uploadClientMediaArtifact).mockImplementationOnce(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          pausedSignal = signal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      fileId: 'file-1',
      uploadId: 'upload-1',
      clientMediaBundleId: 'bundle-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
      status: UploadSessionStatus.UPLOADING,
      attemptId: 'attempt-1',
      slotId: '',
    } as never);
    const rejected = vi.fn();
    const resolved = vi.fn();
    const uploadOptions: Record<string, unknown> = {};
    const file = new File(['audio'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 });
    render(
      <UploadHarness
        clientMedia
        file={file}
        uploadOptions={uploadOptions}
        onResolved={resolved}
        onRejected={rejected}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => pausedSignal != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#pause-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: 'UPLOAD_PAUSED' });
    expect(abortUploadAction).not.toHaveBeenCalled();
    expect(prepared.dispose).not.toHaveBeenCalled();
    expect(readUploadSession('file-1')?.clientMediaBundleId).toBe('bundle-1');
    expect(localStorage.getItem('geul-prepared-upload:file-1')).not.toBeNull();
    Object.assign(uploadOptions, { resumeSession: { fileId: 'file-1', uploadId: 'upload-1' } });
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => resolved.mock.calls.length).toBe(1);
    expect(prepareMedia).toHaveBeenCalledOnce();
    expect(prepared.dispose).toHaveBeenCalledOnce();
    expect(localStorage.getItem('geul-prepared-upload:file-1')).toBeNull();
  });
  it('clears artifact receipts only for the structured missing-staging error and re-sends on resume', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    vi.mocked(completeClientMediaUploadAction).mockResolvedValueOnce({
      ok: false,
      error: 'CLIENT_MEDIA_ARTIFACTS_MISSING',
      errorCode: Code.Unavailable,
    });
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      fileId: 'file-1',
      uploadId: 'upload-1',
      clientMediaBundleId: 'bundle-1',
      totalParts: 1,
      chunkSize: 5,
      uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
      status: UploadSessionStatus.FINALIZING,
      attemptId: 'attempt-1',
      slotId: '',
    } as never);
    const rejected = vi.fn();
    const resolved = vi.fn();
    const uploadOptions: Record<string, unknown> = {};
    const file = new File(['audio'], 'audio.ogg', { type: 'audio/ogg', lastModified: 123 });
    render(
      <UploadHarness
        clientMedia
        file={file}
        uploadOptions={uploadOptions}
        onResolved={resolved}
        onRejected={rejected}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: 'CLIENT_MEDIA_ARTIFACTS_MISSING', retryable: true });
    expect(prepared.dispose).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('geul-prepared-upload:file-1')!).receipts).toEqual([]);
    Object.assign(uploadOptions, { resumeSession: { fileId: 'file-1', uploadId: 'upload-1' } });
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => resolved.mock.calls.length).toBe(1);
    expect(uploadClientMediaArtifact).toHaveBeenCalledTimes(2);
    expect(prepareMedia).toHaveBeenCalledOnce();
    expect(abortUploadAction).not.toHaveBeenCalled();
  });
  it('fails unsupported direct media preparation before any original or artifact upload', async () => {
    initiateFixture();
    vi.mocked(prepareMedia).mockResolvedValue(null);
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: 'CLIENT_MEDIA_UNAVAILABLE', reason: 'capability' });
    expect(initiateUploadAction).not.toHaveBeenCalled();
    expect(prepareClientMediaUploadAction).not.toHaveBeenCalled();
    expect(MockXMLHttpRequest.instances).toHaveLength(0);
    expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
    expect(completeClientMediaUploadAction).not.toHaveBeenCalled();
  });
  it('pauses preparation without creating a server session, so retry can start preparation again', async () => {
    initiateFixture();
    let activeSignal: AbortSignal | undefined;
    vi.mocked(prepareMedia).mockImplementationOnce(
      (_file, { signal }) =>
        new Promise((_resolve, reject) => {
          activeSignal = signal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => activeSignal != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#pause-upload')?.click();
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(activeSignal?.aborted).toBe(true);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: 'UPLOAD_PAUSED' });
    expect(initiateUploadAction).not.toHaveBeenCalled();
    expect(abortUploadAction).not.toHaveBeenCalled();
    expect(localStorage.getItem('geul-prepared-upload:file-1')).toBeNull();
  });

  it('pauses initiation after binding the completed preparation to its immutable bundle, without sending bytes', async () => {
    initiateFixture();
    const prepared = preparedFixture();
    vi.mocked(prepareMedia).mockResolvedValue(prepared);
    let finishInitiation: ((result: never) => void) | undefined;
    vi.mocked(initiateUploadAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishInitiation = resolve;
        }) as never,
    );
    const rejected = vi.fn();
    render(<UploadHarness clientMedia onResolved={vi.fn()} onRejected={rejected} />);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => finishInitiation != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#pause-upload')?.click();
    });
    await act(async () => {
      finishInitiation?.({
        fileId: 'file-1',
        uploadId: 'upload-1',
        totalParts: 1,
        chunkSize: 5,
        uploadedParts: [],
        attemptId: 'attempt-1',
        slotId: '',
      } as never);
    });
    await expect.poll(() => rejected.mock.calls.length).toBe(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: 'UPLOAD_PAUSED' });
    expect(abortUploadAction).not.toHaveBeenCalled();
    expect(prepared.dispose).not.toHaveBeenCalled();
    expect(prepareClientMediaUploadAction).toHaveBeenCalledOnce();
    expect(MockXMLHttpRequest.instances).toHaveLength(0);
    expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
    expect(readUploadSession('file-1')?.clientMediaBundleId).toBe('bundle-1');
  });
  it.each([
    { mime: 'audio/ogg', name: 'audio.ogg', kind: 'audio' },
    { mime: 'video/mp4', name: 'video.mp4', kind: 'video' },
  ] as const)(
    'prepares $mime editor attachments before initiation and commits with the bundle identity',
    async ({ mime, name, kind }) => {
      initiateFixture();
      const prepared = preparedFixture();
      prepared.metadata.kind = kind;
      let finishPreparation: ((result: PreparedMedia) => void) | undefined;
      vi.mocked(prepareMedia).mockImplementation(
        () =>
          new Promise((resolve) => {
            finishPreparation = resolve;
          }),
      );
      const resolved = vi.fn();
      render(
        <UploadHarness
          uploadType={UploadType.EDITOR_ATTACHMENT}
          file={new File(['media'], name, { type: mime })}
          onResolved={resolved}
        />,
      );
      await act(async () => {
        document.querySelector<HTMLButtonElement>('#start-upload')?.click();
      });
      await expect.poll(() => finishPreparation != null).toBe(true);
      expect(initiateUploadAction).not.toHaveBeenCalled();
      expect(MockXMLHttpRequest.instances).toHaveLength(0);
      await act(async () => {
        finishPreparation?.(prepared);
      });
      await expect.poll(() => resolved.mock.calls.length).toBe(1);
      expect(vi.mocked(prepareClientMediaUploadAction).mock.calls[0]?.[0]).toMatchObject({
        kind,
        fileId: 'file-1',
        uploadId: 'upload-1',
      });
      expect(vi.mocked(completeClientMediaUploadAction).mock.calls[0]?.[0]).toMatchObject({
        uploadType: UploadType.EDITOR_ATTACHMENT,
        clientMediaBundleId: 'bundle-1',
      });
      expect(vi.mocked(initiateUploadAction).mock.calls[0]?.[0]).toMatchObject({
        uploadType: UploadType.EDITOR_ATTACHMENT,
        entityId: '',
      });
      expect(prepared.dispose).toHaveBeenCalledOnce();
    },
  );

  it.each(['audio/ogg', 'video/mp4'])(
    'blocks unsupported %s editor attachments before every remote upload',
    async (mime) => {
      initiateFixture();
      vi.mocked(prepareMedia).mockResolvedValue(null);
      const rejected = vi.fn();
      render(
        <UploadHarness
          uploadType={UploadType.EDITOR_ATTACHMENT}
          file={new File(['media'], 'media', { type: mime })}
          onResolved={vi.fn()}
          onRejected={rejected}
        />,
      );
      await act(async () => {
        document.querySelector<HTMLButtonElement>('#start-upload')?.click();
      });
      await expect.poll(() => rejected.mock.calls.length).toBe(1);
      expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: 'CLIENT_MEDIA_UNAVAILABLE' });
      expect(initiateUploadAction).not.toHaveBeenCalled();
      expect(prepareClientMediaUploadAction).not.toHaveBeenCalled();
      expect(MockXMLHttpRequest.instances).toHaveLength(0);
      expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
      expect(completeClientMediaUploadAction).not.toHaveBeenCalled();
    },
  );

  it('keeps nonmedia editor attachments on their existing multipart completion path', async () => {
    initiateFixture();
    const resolved = vi.fn();
    render(
      <UploadHarness
        uploadType={UploadType.EDITOR_ATTACHMENT}
        file={new File(['%PDF-'], 'document.pdf', { type: 'application/pdf' })}
        onResolved={resolved}
      />,
    );
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });
    await expect.poll(() => resolved.mock.calls.length).toBe(1);
    expect(prepareMedia).not.toHaveBeenCalled();
    expect(prepareClientMediaUploadAction).not.toHaveBeenCalled();
    expect(completeClientMediaUploadAction).not.toHaveBeenCalled();
    expect(vi.mocked(completeUploadAction).mock.calls[0]?.[0]).toMatchObject({
      uploadType: UploadType.EDITOR_ATTACHMENT,
    });
    expect(vi.mocked(completeUploadAction).mock.calls[0]?.[0]).not.toHaveProperty('clientMediaBundleId');
  });
});
