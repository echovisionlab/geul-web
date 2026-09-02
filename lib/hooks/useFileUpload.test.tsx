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
  completeUploadAction,
  downloadFromUrlAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  recoverCompletedUploadAction,
} from '@/lib/actions/file';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { UploadType } from '@/lib/types/upload/model';
import { useFileUpload } from './useFileUpload';

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

vi.mock('@/lib/actions/file', () => ({
  abortUploadAction: vi.fn(),
  completeUploadAction: vi.fn(),
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

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <EditorRuntimeProvider provider={{} as never} entityType="release" entityId="release-1">
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
  entityId?: string;
  entityType?: TranscodeEntityType;
  file?: File;
  uploadOptions?: Record<string, unknown>;
}

function UploadHarness({
  onResolved,
  onRejected,
  onProgress,
  onLifecycle,
  onMultipartSession,
  uploadType = UploadType.TRACK_AUDIO,
  entityId = 'track-1',
  entityType = TranscodeEntityType.TRACK,
  file = new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }),
  uploadOptions = {},
}: UploadHarnessProps) {
  const { upload } = useFileUpload();

  return (
    <button
      id="start-upload"
      type="button"
      onClick={() => {
        void upload(file, {
          uploadType,
          entityId,
          entityType,
          correlationId: 'correlation-1',
          ...uploadOptions,
          onProgress,
          onLifecycle,
          onMultipartSession,
        }).then(onResolved, onRejected);
      }}
    >
      start
    </button>
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

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    runtimeSubscription.listener = null;
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
    globalThis.fetch = originalFetch;
    MockXMLHttpRequest.instances = [];
    MockXMLHttpRequest.sendHandler = null;
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
  ])('forwards $name projection identity to the server action', async (testCase) => {
    vi.mocked(downloadFromUrlAction).mockResolvedValue({
      url: 'https://cdn.example.com/image.png',
      fileId: 'file-1',
      slotId: 'slot-1',
      attemptId: 'attempt-1',
    });

    render(<DownloadHarness entityType={testCase.entityType} expectedCurrentFileId={testCase.expectedCurrentFileId} />);

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-download')?.click();
    });

    await expect.poll(() => vi.mocked(downloadFromUrlAction).mock.calls.length).toBe(1);
    expect(persistCollaborativeDocumentNowMock).not.toHaveBeenCalled();
    expect(vi.mocked(downloadFromUrlAction).mock.calls[0]?.[0]).toEqual({
      uploadType: UploadType.EDITOR_IMAGE,
      entityId: 'entity-1',
      entityType: testCase.entityType,
      url: 'https://source.example.com/image.png',
      correlationId: 'correlation-1',
      slotId: undefined,
      expectedCurrentFileId: testCase.expectedCurrentFileId,
    });
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
    const file = new File(['audio-data'], 'audio.ogg', { type: 'audio/ogg' });
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
      uploadType: UploadType.TRACK_AUDIO,
      entityId: 'track-1',
      entityType: TranscodeEntityType.TRACK,
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
      uploadType: UploadType.TRACK_AUDIO,
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
      uploadType: UploadType.TRACK_AUDIO,
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
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File([new Uint8Array(50)], 'audio.ogg', { type: 'audio/ogg' });
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

    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => vi.mocked(completeUploadAction).mock.calls.length).toBe(1);
    await expect.poll(() => resolved).toBe(true);
    expect(partAttempts.get(7)).toBe(2);
    expect(progressPercentages.every((value, index) => index === 0 || value >= progressPercentages[index - 1]!)).toBe(
      true,
    );
    expect(vi.mocked(completeUploadAction).mock.calls[0]?.[0]).toMatchObject({
      uploadId: 'upload-1',
      fileId: 'file-1',
      uploadType: UploadType.TRACK_AUDIO,
    });
  });

  it('stops after automatic part retries are exhausted and succeeds when the user resumes the same file', async () => {
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File([new Uint8Array(50)], 'audio.ogg', { type: 'audio/ogg' });
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

    await expect.poll(() => runtimeSubscription.listener != null).toBe(true);
    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => rejected != null).toBe(true);
    expect(rejected).toBeInstanceOf(Error);
    expect((rejected as Error).message).toBe('Upload interrupted');
    expect(partAttemptsByPhase.get('initial:6')).toBe(3);
    expect(vi.mocked(completeUploadAction)).not.toHaveBeenCalled();

    Object.assign(uploadOptions, {
      resumeSession: { fileId: 'file-1', uploadId: 'upload-1' },
    });

    await act(async () => {
      document.querySelector<HTMLButtonElement>('#start-upload')?.click();
    });

    await expect.poll(() => vi.mocked(completeUploadAction).mock.calls.length).toBe(1);
    await expect.poll(() => resolved).toBe(true);
    expect(partAttemptsByPhase.get('resume:6')).toBe(1);
    expect(progressByPhase.resume[0]).toBe(60);
    expect(
      progressByPhase.resume.every((value, index) => index === 0 || value >= progressByPhase.resume[index - 1]!),
    ).toBe(true);
    expect(vi.mocked(completeUploadAction).mock.calls[0]?.[0]).toMatchObject({
      uploadId: 'upload-1',
      fileId: 'file-1',
    });
  });
});
