// @vitest-environment jsdom

import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { Code } from '@connectrpc/connect';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import {
  abortUploadAction,
  completeUploadAction,
  completeClientMediaUploadAction,
  recoverCompletedClientMediaUploadAction,
  prepareClientMediaUploadAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
} from '@/lib/actions/file';
import { useFileUpload } from './useFileUpload';
import { UploadType } from '@/lib/types/upload/model';
import { prepareMedia } from '@/lib/media/client-processing/processor';
import { uploadClientMediaArtifact } from '@/lib/upload/client-media-transport';
import { disposePreparedSession, forgetUploadSession } from '@/lib/upload/upload-session-store';
import {
  preparedFixture,
  sessionFixture,
  uploadFetch,
  UploadXMLHttpRequest,
} from '@/lib/upload/direct-upload.test-fixture';

const subscription = vi.hoisted(() => ({ listener: null as ((event: EditorRuntimeEvent) => void) | null }));
vi.mock('@/lib/collab/subscribe-runtime-events', () => ({
  subscribeToProviderRuntimeEvents: (_provider: unknown, listener: (event: EditorRuntimeEvent) => void) => {
    subscription.listener = listener;
    return () => {
      subscription.listener = null;
    };
  },
}));
vi.mock('@/lib/actions/file', () => ({
  abortUploadAction: vi.fn(),
  completeUploadAction: vi.fn(),
  completeClientMediaUploadAction: vi.fn(),
  recoverCompletedClientMediaUploadAction: vi.fn(),
  prepareClientMediaUploadAction: vi.fn(),
  findMultipartUploadCandidateAction: vi.fn(),
  initiateUploadAction: vi.fn(),
  recoverCompletedUploadAction: vi.fn(),
}));
vi.mock('@/lib/utils/upload-pipeline', () => ({
  prepareUploadFile: async (file: File) => ({ file, mimeType: file.type }),
}));
vi.mock('@/lib/media/client-processing/processor', () => ({ prepareMedia: vi.fn(), restoreMedia: vi.fn() }));
vi.mock('@/lib/upload/client-media-transport', () => ({ uploadClientMediaArtifact: vi.fn() }));

const provider = {} as HocuspocusProvider;
const queryClients: QueryClient[] = [];
let activeView: ReturnType<typeof render> | undefined;
const pendingUploads = new Set<Promise<unknown>>();
let cancelActiveUpload: (() => void) | undefined;
function Harness({
  media = false,
  track = false,
  onLifecycle = vi.fn(),
  onRejected = vi.fn(),
  onResolved = vi.fn(),
}: {
  media?: boolean;
  track?: boolean;
  onLifecycle?: (update: { source: string; percentage?: number }) => void;
  onRejected?: (error: unknown) => void;
  onResolved?: () => void;
}) {
  const { upload, abort, pauseUpload, isUploading } = useFileUpload(
    track ? { provider, entityType: 'release', entityId: 'release-1' } : undefined,
  );
  cancelActiveUpload = abort;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const pending = upload(
            new File([media ? 'audio' : 'bytes'], media ? 'audio.ogg' : 'file.bin', {
              type: media ? 'audio/ogg' : 'application/octet-stream',
            }),
            {
              uploadType: media ? UploadType.TRACK_AUDIO : UploadType.GENERAL_FILE,
              entityId: 'track-1',
              correlationId: 'correlation-1',
              onLifecycle,
            },
          ).then(onResolved, onRejected);
          pendingUploads.add(pending);
          void pending.then(
            () => pendingUploads.delete(pending),
            () => pendingUploads.delete(pending),
          );
        }}
      >
        Start
      </button>
      <button type="button" onClick={abort}>
        Cancel
      </button>
      <button type="button" onClick={pauseUpload}>
        Pause
      </button>
      <span role="status">{isUploading ? 'Uploading' : 'Idle'}</span>
    </>
  );
}
function renderUpload(props: React.ComponentProps<typeof Harness>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClients.push(client);
  activeView = render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
  return activeView;
}
function emitProgress(
  percentage: number,
  identity: { attemptId?: string; fileId?: string; stage?: 'uploading' | 'completed' } = {},
) {
  subscription.listener?.({
    version: 1,
    kind: 'file.ingest.lifecycle',
    entityType: 'release',
    entityId: 'release-1',
    correlationId: 'correlation-1',
    timestampMs: 1,
    payload: {
      fileId: identity.fileId ?? 'file-1',
      attemptId: identity.attemptId ?? 'attempt-1',
      source: 'upload',
      stage: identity.stage ?? 'uploading',
      progress: percentage,
      bytesCompleted: percentage,
      bytesTotal: 100,
    },
  });
}

beforeEach(() => {
  notifyManager.setNotifyFunction((callback) => act(callback));
  vi.resetAllMocks();
  vi.mocked(initiateUploadAction).mockResolvedValue(sessionFixture());
  vi.mocked(completeUploadAction).mockResolvedValue({ fileId: 'file-1', url: '/media/file-1' });
  vi.mocked(completeClientMediaUploadAction).mockResolvedValue({ ok: true, fileId: 'file-1', url: '/media/file-1' });
  vi.mocked(recoverCompletedClientMediaUploadAction).mockResolvedValue({
    ok: true,
    fileId: 'file-1',
    url: '/media/file-1',
  });
  vi.mocked(prepareClientMediaUploadAction).mockResolvedValue({ ok: true, bundleId: 'bundle-1' });
  vi.mocked(prepareMedia).mockResolvedValue(null);
  vi.mocked(uploadClientMediaArtifact).mockResolvedValue(undefined);
  vi.stubGlobal('XMLHttpRequest', UploadXMLHttpRequest);
  vi.stubGlobal('fetch', vi.fn(uploadFetch));
  UploadXMLHttpRequest.instances = [];
  UploadXMLHttpRequest.sendHandler = null;
});
afterEach(async () => {
  await act(async () => {
    cancelActiveUpload?.();
    await Promise.allSettled([...pendingUploads]);
  });
  cancelActiveUpload = undefined;
  activeView?.unmount();
  activeView = undefined;
  queryClients.splice(0).forEach((client) => client.clear());
  try {
    await disposePreparedSession('file-1');
  } finally {
    forgetUploadSession('file-1');
    localStorage.clear();
    sessionStorage.clear();
    subscription.listener = null;
    vi.unstubAllGlobals();
    UploadXMLHttpRequest.instances = [];
    UploadXMLHttpRequest.sendHandler = null;
    notifyManager.setNotifyFunction((callback) => callback());
  }
});

describe('useFileUpload wiring', () => {
  it.each([
    { action: 'Cancel', code: undefined },
    { action: 'Pause', code: 'UPLOAD_PAUSED' },
  ])('$action interrupts preparation without creating or revoking a server session', async ({ action, code }) => {
    let signal: AbortSignal | undefined;
    vi.mocked(prepareMedia).mockImplementation(
      (_file, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    const rejected = vi.fn();
    const { user } = renderUpload({ media: true, onRejected: rejected });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(signal).toBeDefined());
    expect(screen.getByRole('status')).toHaveTextContent('Uploading');
    try {
      await user.click(screen.getByRole('button', { name: action }));
      await waitFor(() => expect(rejected).toHaveBeenCalledOnce());
      expect(signal!.aborted).toBe(true);
      expect(rejected.mock.calls[0]?.[0]).toMatchObject(code ? { code } : { message: 'Upload aborted' });
      expect(initiateUploadAction).not.toHaveBeenCalled();
      expect(abortUploadAction).not.toHaveBeenCalled();
      expect(uploadClientMediaArtifact).not.toHaveBeenCalled();
      expect(localStorage.getItem('geul-prepared-upload:file-1')).toBeNull();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Idle'));
    } finally {
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
    }
  });

  it('ignores stale attempt events and keeps active realtime progress monotonic', async () => {
    let pending: UploadXMLHttpRequest | undefined;
    UploadXMLHttpRequest.sendHandler = (xhr) => {
      pending = xhr;
    };
    const onLifecycle = vi.fn();
    const onResolved = vi.fn();
    const { user } = renderUpload({ track: true, onLifecycle, onResolved });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(pending).toBeDefined());
    try {
      act(() => {
        emitProgress(100, { attemptId: 'stale', fileId: 'stale', stage: 'completed' });
        emitProgress(40);
        emitProgress(90, { attemptId: 'stale', fileId: 'stale' });
        emitProgress(20);
      });
      expect(
        onLifecycle.mock.calls
          .map(([update]) => update)
          .filter((update) => update.source === 'server')
          .map((update) => update.percentage),
      ).toEqual([40, 40]);
    } finally {
      await act(async () => {
        pending?.succeed();
      });
    }
    await waitFor(() => expect(onResolved).toHaveBeenCalledOnce());
  });

  it('ignores raw server completion for prepared bundles and routes lost commit recovery to the client-media action', async () => {
    vi.mocked(prepareMedia).mockResolvedValue(preparedFixture());
    let finishArtifact: (() => void) | undefined;
    vi.mocked(uploadClientMediaArtifact).mockImplementation(
      ({ signal }) =>
        new Promise((resolve, reject) => {
          finishArtifact = resolve;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );
    vi.mocked(completeClientMediaUploadAction).mockResolvedValue({
      ok: false,
      error: 'response lost',
      errorCode: Code.Unavailable,
    });
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue(null);
    const onLifecycle = vi.fn();
    const onResolved = vi.fn();
    const { user } = renderUpload({ media: true, track: true, onLifecycle, onResolved });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(finishArtifact).toBeDefined());
    try {
      act(() => {
        emitProgress(100, { stage: 'completed' });
      });
      expect(onLifecycle.mock.calls.filter(([update]) => update.source === 'server')).toHaveLength(0);
      expect(onLifecycle.mock.calls.some(([update]) => update.percentage === 100)).toBe(false);
      expect(completeClientMediaUploadAction).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        finishArtifact?.();
      });
    }
    await waitFor(() => expect(onResolved).toHaveBeenCalledOnce());
    expect(recoverCompletedClientMediaUploadAction).toHaveBeenCalledWith({
      fileId: 'file-1',
      uploadId: 'upload-1',
      uploadType: UploadType.TRACK_AUDIO,
      correlationId: 'correlation-1',
      clientMediaBundleId: 'bundle-1',
    });
    expect(completeUploadAction).not.toHaveBeenCalled();
    expect(onLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'completed', percentage: 100 }));
  });
});
