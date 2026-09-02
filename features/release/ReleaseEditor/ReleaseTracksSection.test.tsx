// @vitest-environment jsdom

import { act } from 'react';
import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { DEFAULT_MEDIA_STATUS_LABELS } from '@/lib/media/status';
import { TestProviders } from '@/test/TestProviders';
import { ReleaseTracksSection } from './ReleaseTracksSection';
import { resolveTrackProgressIndicator } from './track-runtime';

const deleteTrackActionMock = vi.fn();
const reorderTracksActionMock = vi.fn();
const useUploadResumeStateMock = vi.hoisted(() =>
  vi.fn(
    () =>
      ({
        code: 'idle',
        resumeNotice: null,
        hasActiveSession: false,
      }) as any,
  ),
);
type MediaRuntimeStateMockResult = {
  value: unknown;
  isLoading: boolean;
};
const useMediaProcessingRuntimeStateMock = vi.hoisted(() =>
  vi.fn((_options: unknown): MediaRuntimeStateMockResult => ({
    value: null,
    isLoading: false,
  })),
);
let latestDragEndHandler: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
  }) => {
    latestDragEndHandler = onDragEnd ?? null;
    return <>{children}</>;
  },
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  },
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (vars: any) => Promise<any>;
    onSuccess?: (result: any) => void;
  }) => ({
    mutate: async (vars: any, options?: { onSuccess?: (result: any) => void }) => {
      const result = await mutationFn(vars);
      onSuccess?.(result);
      options?.onSuccess?.(result);
      return result;
    },
    isPending: false,
  }),
  useQuery: () => ({
    data: undefined,
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({
    children,
    onClick,
    tone,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    tone?: string;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} data-tone={tone ?? ''} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  Checkbox: () => null,
  SegmentedControl: () => null,
  Select: () => null,
  TextInput: () => null,
}));

vi.mock('@/components/core/Modal', () => ({
  ConfirmModal: ({
    opened,
    title,
    message,
    onClose,
    onConfirm,
  }: {
    opened: boolean;
    title: string;
    message: React.ReactNode;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    opened ? (
      <div data-testid="confirm-modal">
        <div>{title}</div>
        <div>{message}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionHeader: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      {actions}
    </div>
  ),
}));

vi.mock('@/lib/actions/artist', () => ({
  listArtistsAction: vi.fn(),
}));

vi.mock('@/lib/actions/user', () => ({
  listUsersAdminAction: vi.fn(),
}));

vi.mock('@/lib/actions/track', () => ({
  createTrackAction: vi.fn(),
  updateTrackAction: vi.fn(),
  deleteTrackAction: (...args: any[]) => deleteTrackActionMock(...args),
  reorderTracksAction: (...args: any[]) => reorderTracksActionMock(...args),
  setTrackCreditsAction: vi.fn(),
}));

vi.mock('@/features/media-download/ConnectedFileDownloadPolicyEditor', () => ({
  ConnectedFileDownloadPolicyEditor: () => <div data-testid="file-download-policy-editor" />,
}));

vi.mock('@/lib/hooks/useUploadResumeNotice', () => ({
  useUploadResumeState: () => useUploadResumeStateMock(),
}));

vi.mock('@/lib/media/use-media-processing-runtime-state', () => ({
  useMediaProcessingRuntimeState: (options: unknown) => useMediaProcessingRuntimeStateMock(options),
}));

vi.mock('../TrackAudioUploader', () => ({
  TrackAudioUploader: (props: {
    trackId: string;
    mode?: string;
    processingActive?: boolean;
    processingProgress?: number | null;
    onPendingUploadCancelled?: (identity: { attemptId?: string; fileId?: string }) => void;
  }) => {
    latestTrackAudioUploaderProps[`${props.trackId}:${props.mode ?? 'default'}`] = props;

    return (
      <div data-testid={`audio-uploader-${props.trackId}-${props.mode ?? 'default'}`}>
        {props.processingActive ? 'processing' : 'none'}:{props.processingProgress ?? 'null'}
      </div>
    );
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestTrackAudioUploaderProps: Record<string, any> = {};

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestProviders>{node}</TestProviders>);
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  expect(element).not.toBeUndefined();

  act(() => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await flushUpdates();
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

beforeEach(() => {
  deleteTrackActionMock.mockReset();
  deleteTrackActionMock.mockResolvedValue({ success: true });
  reorderTracksActionMock.mockReset();
  reorderTracksActionMock.mockResolvedValue({ success: true });
  useUploadResumeStateMock.mockReset();
  useUploadResumeStateMock.mockReturnValue({
    code: 'idle',
    resumeNotice: null,
    hasActiveSession: false,
  } as any);
  useMediaProcessingRuntimeStateMock.mockReset();
  useMediaProcessingRuntimeStateMock.mockReturnValue({
    value: null,
    isLoading: false,
  });
  latestTrackAudioUploaderProps = {};
  latestDragEndHandler = null;
  vi.mocked(notifications.show).mockReset();
});

describe('ReleaseTracksSection', () => {
  it('uses a visible upload tone for direct upload progress rows', () => {
    expect(
      resolveTrackProgressIndicator(DEFAULT_MEDIA_STATUS_LABELS, { progress: 64, stage: 'uploading' }, null),
    ).toEqual({
      label: 'Uploading 64%',
      progress: 64,
      color: 'blue',
    });
  });

  it('keeps the same progress row while showing validating for the first resumable chunk', () => {
    expect(
      resolveTrackProgressIndicator(DEFAULT_MEDIA_STATUS_LABELS, { progress: 18, stage: 'validating' }, null),
    ).toEqual({
      label: 'Validating 18%',
      progress: 18,
      color: 'blue',
    });
  });

  it('uses aggregate processing labels for backend-owned track processing', () => {
    expect(
      resolveTrackProgressIndicator(DEFAULT_MEDIA_STATUS_LABELS, null, {
        progress: 67,
      }),
    ).toEqual({
      label: 'Processing 67%',
      progress: 67,
      color: 'cyan',
    });
  });

  it('renders an interrupted upload warning in the full-width row area', () => {
    const releaseId = randomTestUuid();
    const trackId = randomTestUuid();
    const pendingFileId = randomTestUuid();
    const tracks: ReleaseTrackItem[] = [
      {
        id: trackId,
        track_number: 1,
        title: 'Interrupted',
        duration_seconds: null,
        audio_attached: false,
        processing_status: null,
        pending_upload_file_id: pendingFileId,
        pending_upload_status: 'pending',
        pending_upload_started_at: new Date(Date.now() - 60_000).toISOString(),
        credits: [],
      },
    ];

    render(<ReleaseTracksSection releaseId={releaseId} tracks={tracks} onTracksChange={vi.fn()} />);

    expect(document.body.textContent).toContain('Interrupted upload found');
  });

  it('renders the full-width resume row when only backend resume state is available', () => {
    const releaseId = randomTestUuid();
    const trackId = randomTestUuid();
    const fileId = randomTestUuid();
    const uploadId = randomTestUuid();
    const tracks: ReleaseTrackItem[] = [
      {
        id: trackId,
        track_number: 1,
        title: 'Backend resumable',
        duration_seconds: null,
        audio_attached: false,
        processing_status: null,
        credits: [],
      },
    ];

    useUploadResumeStateMock.mockReturnValue({
      code: 'available',
      resumeNotice: {
        uploadId,
        fileId,
        key: 'release/test/audio.wav',
        fileName: 'audio.wav',
        status: 2,
      },
      hasActiveSession: true,
    } as any);

    render(<ReleaseTracksSection releaseId={releaseId} tracks={tracks} onTracksChange={vi.fn()} />);

    expect(document.querySelector(`#release-track-resume-row-${trackId}`)).not.toBeNull();
    expect(document.body.textContent).toContain('Interrupted upload found');
  });

  it('hides the backend-only resume row after the track uploader cancels it', () => {
    const releaseId = randomTestUuid();
    const trackId = randomTestUuid();
    const fileId = randomTestUuid();
    const uploadId = randomTestUuid();
    const tracks: ReleaseTrackItem[] = [
      {
        id: trackId,
        track_number: 1,
        title: 'Backend resumable',
        duration_seconds: null,
        audio_attached: false,
        processing_status: null,
        credits: [],
      },
    ];

    useUploadResumeStateMock.mockReturnValue({
      code: 'available',
      resumeNotice: {
        uploadId,
        fileId,
        key: 'release/test/audio.wav',
        fileName: 'audio.wav',
        status: 2,
      },
      hasActiveSession: true,
    } as any);

    render(<ReleaseTracksSection releaseId={releaseId} tracks={tracks} onTracksChange={vi.fn()} />);

    expect(document.querySelector(`#release-track-resume-row-${trackId}`)).not.toBeNull();

    act(() => {
      latestTrackAudioUploaderProps[`${trackId}:button-only`]?.onPendingUploadCancelled?.({
        fileId,
      });
    });

    expect(document.querySelector(`#release-track-resume-row-${trackId}`)).toBeNull();
  });

  it('renumbers tracks locally after drag reorder', async () => {
    const onTracksChange = vi.fn();
    const tracks: ReleaseTrackItem[] = [
      {
        id: 'track-1',
        track_number: 1,
        title: 'Intro',
        duration_seconds: 90,
        audio_attached: false,
        processing_status: null,
        credits: [],
      },
      {
        id: 'track-2',
        track_number: 2,
        title: 'Outro',
        duration_seconds: 120,
        audio_attached: false,
        processing_status: null,
        credits: [],
      },
    ];

    render(<ReleaseTracksSection releaseId="release-1" tracks={tracks} onTracksChange={onTracksChange} />);

    expect(latestDragEndHandler).not.toBeNull();

    act(() => {
      latestDragEndHandler?.({
        active: { id: 'track-2' },
        over: { id: 'track-1' },
      });
    });

    expect(onTracksChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'track-2', track_number: 1 }),
      expect.objectContaining({ id: 'track-1', track_number: 2 }),
    ]);
    expect(reorderTracksActionMock).toHaveBeenCalledWith(['track-2', 'track-1']);
  });

  it('expands inline track editor when clicking a track title', async () => {
    const onTracksChange = vi.fn();
    const tracks: ReleaseTrackItem[] = [
      {
        id: 'track-1',
        track_number: 1,
        title: 'Intro',
        duration_seconds: 90,
        audio_attached: false,
        processing_status: null,
        credits: [],
      },
    ];

    render(<ReleaseTracksSection releaseId="release-1" tracks={tracks} onTracksChange={onTracksChange} />);

    expect(document.body.textContent).not.toContain('Track Credits');

    const toggleButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Edit',
    );
    await clickElement(toggleButton);

    expect(document.body.textContent).toContain('Track credits');
    expect(document.body.textContent).toContain('Add Credit');
  });

  it('requires confirmation before deleting a track', async () => {
    const onTracksChange = vi.fn();
    const tracks: ReleaseTrackItem[] = [
      {
        id: 'track-1',
        track_number: 1,
        title: 'Intro',
        duration_seconds: 90,
        audio_attached: false,
        processing_status: null,
        credits: [],
      },
    ];

    render(<ReleaseTracksSection releaseId="release-1" tracks={tracks} onTracksChange={onTracksChange} />);

    expect(deleteTrackActionMock).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="confirm-modal"]')).toBeNull();

    await clickElement(document.querySelector('button[data-tone="danger"]'));

    expect(deleteTrackActionMock).not.toHaveBeenCalled();
    const confirmModal = document.querySelector('[data-testid="confirm-modal"]');
    expect(confirmModal?.textContent).toContain('Are you sure you want to delete this track?');

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Confirm',
    );
    await clickElement(confirmButton);

    expect(deleteTrackActionMock).toHaveBeenCalledWith('track-1');
    expect(onTracksChange).toHaveBeenCalledWith([]);
  });

  it('passes backend snapshot release track processing fields through to the track audio status UI', async () => {
    const onTracksChange = vi.fn();
    const releaseId = randomTestUuid();
    const trackId = randomTestUuid();
    const fileId = randomTestUuid();
    const tracks: ReleaseTrackItem[] = [
      {
        id: trackId,
        track_number: 1,
        title: 'Intro',
        duration_seconds: 90,
        audio_attached: true,
        audio_original_file_id: fileId,
        processing_status: 'TRACK_PROCESSING_STATUS_PROCESSING',
        processing_progress: 54,
        credits: [],
      },
    ];

    render(<ReleaseTracksSection releaseId={releaseId} tracks={tracks} onTracksChange={onTracksChange} />);

    expect(document.querySelector(`[data-testid="audio-uploader-${trackId}-status-only"]`)?.textContent).toBe(
      'processing:54',
    );

    act(() => {
      root?.render(
        <TestProviders>
          <ReleaseTracksSection
            releaseId={releaseId}
            tracks={[
              {
                ...tracks[0],
                processing_progress: 81,
              },
            ]}
            onTracksChange={onTracksChange}
          />
        </TestProviders>,
      );
    });

    expect(document.querySelector(`[data-testid="audio-uploader-${trackId}-status-only"]`)?.textContent).toBe(
      'processing:81',
    );

    act(() => {
      root?.render(
        <TestProviders>
          <ReleaseTracksSection
            releaseId={releaseId}
            tracks={[
              {
                ...tracks[0],
                processing_status: 'TRACK_PROCESSING_STATUS_COMPLETED',
                processing_progress: null,
              },
            ]}
            onTracksChange={onTracksChange}
          />
        </TestProviders>,
      );
    });

    expect(document.querySelector(`[data-testid="audio-uploader-${trackId}-status-only"]`)?.textContent).toBe(
      'none:null',
    );
  });

  it('uses backend runtime state for release track status without collab processing fields', async () => {
    const onTracksChange = vi.fn();
    const releaseId = randomTestUuid();
    const trackId = randomTestUuid();
    const fileId = randomTestUuid();
    const tracks: ReleaseTrackItem[] = [
      {
        id: trackId,
        track_number: 1,
        title: 'Intro',
        duration_seconds: null,
        audio_attached: false,
        audio_original_file_id: fileId,
        processing_status: null,
        processing_progress: null,
        credits: [],
      },
    ];

    useMediaProcessingRuntimeStateMock.mockReturnValue({
      value: {
        processing_status: 'TRACK_PROCESSING_STATUS_PROCESSING',
        processing_progress: 45,
        duration_seconds: null,
      },
      isLoading: false,
    });

    render(<ReleaseTracksSection releaseId={releaseId} tracks={tracks} onTracksChange={onTracksChange} />);

    expect(useMediaProcessingRuntimeStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId,
        trackId,
      }),
    );
    expect(document.querySelector(`[data-testid="audio-uploader-${trackId}-status-only"]`)?.textContent).toBe(
      'processing:45',
    );
  });
});
