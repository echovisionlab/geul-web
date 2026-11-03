// @vitest-environment jsdom

import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { act, render, screen, waitFor, within } from '@/test/render';
import { UploadResumeStateCode } from '@/lib/upload/resume-state';
import { ReleaseEditorAccessProvider } from './ReleaseEditorAccessContext';
import { ReleaseTracksSection, SortableTrackListItem } from './ReleaseTracksSection';

const mocks = vi.hoisted(() => ({
  deleteTrack: vi.fn(),
  reorderTracks: vi.fn(),
  listArtists: vi.fn(),
  listUsers: vi.fn(),
  runtime: vi.fn((_options: unknown): { value: unknown; isLoading: boolean } => ({ value: null, isLoading: false })),
  resume: vi.fn((): { code: string; resumeNotice: any; hasActiveSession: boolean } => ({
    code: UploadResumeStateCode.IDLE,
    resumeNotice: null,
    hasActiveSession: false,
  })),
}));
vi.mock('@/lib/actions/track', () => ({
  createTrackAction: vi.fn(),
  updateTrackAction: vi.fn(),
  setTrackCreditsAction: vi.fn(),
  deleteTrackAction: mocks.deleteTrack,
  reorderTracksAction: mocks.reorderTracks,
}));
vi.mock('@/lib/actions/artist', () => ({ listArtistsAction: mocks.listArtists }));
vi.mock('@/lib/actions/user', () => ({ listUsersAdminAction: mocks.listUsers }));
vi.mock('@/lib/hooks/useUploadResumeNotice', () => ({ useUploadResumeState: mocks.resume }));
vi.mock('@/lib/media/use-media-processing-runtime-state', () => ({ useMediaProcessingRuntimeState: mocks.runtime }));
vi.mock('@/lib/hooks/useFileUpload', () => ({
  UPLOAD_ABORTED_MESSAGE: 'Upload aborted',
  UPLOAD_FAILED_MESSAGE: 'Upload failed',
  UPLOAD_FINALIZATION_FAILED_MESSAGE: 'Upload finalization failed',
  UPLOAD_INTERRUPTED_MESSAGE: 'Upload interrupted',
  useFileUpload: () => ({ upload: vi.fn(), abort: vi.fn(), isUploading: false }),
}));
const abortUpload = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/file', () => ({ abortUploadAction: abortUpload, findMultipartUploadCandidateAction: vi.fn() }));

let client: QueryClient;
function track(overrides: Partial<ReleaseTrackItem> = {}): ReleaseTrackItem {
  return {
    id: 'track-1',
    title: 'Intro',
    track_number: 1,
    duration_seconds: 90,
    audio_attached: false,
    processing_status: null,
    credits: [],
    ...overrides,
  };
}
function renderSection(tracks = [track()], onTracksChange = vi.fn()) {
  return render(
    <QueryClientProvider client={client}>
      <ReleaseTracksSection releaseId="release-1" tracks={tracks} onTracksChange={onTracksChange} />
      <NotificationRegion closeLabel="Close" />
    </QueryClientProvider>,
  );
}
function resumeSession() {
  mocks.resume.mockReturnValue({
    code: UploadResumeStateCode.AVAILABLE,
    hasActiveSession: true,
    resumeNotice: {
      fileId: 'resume-file',
      uploadId: 'resume-upload',
      attemptId: 'resume-attempt',
      fileName: 'audio.wav',
      status: UploadSessionStatus.UPLOADING,
    },
  });
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.listArtists.mockResolvedValue({ ok: true, value: [] });
  mocks.listUsers.mockResolvedValue({ ok: true, value: { data: [] } });
  mocks.deleteTrack.mockResolvedValue({ success: true });
  mocks.reorderTracks.mockResolvedValue({ success: true });
  abortUpload.mockResolvedValue({ success: true });
});
afterEach(() => {
  client.clear();
  act(() => notifications.clean());
  vi.clearAllMocks();
  mocks.resume.mockReturnValue({ code: UploadResumeStateCode.IDLE, resumeNotice: null, hasActiveSession: false });
  mocks.runtime.mockReturnValue({ value: null, isLoading: false });
});

describe('ReleaseTracksSection', () => {
  it('upgrades and downgrades editing controls without replacing the track table', async () => {
    const provider = {};
    const onTracksChange = vi.fn();
    function Editor() {
      return (
        <ReleaseEditorAccessProvider value={useEditorAccessLevel(provider) === 'edit'}>
          <ReleaseTracksSection releaseId="release-1" tracks={[track()]} onTracksChange={onTracksChange} />
        </ReleaseEditorAccessProvider>
      );
    }
    setProviderAccessLevel(provider, 'view');
    const { user } = render(
      <QueryClientProvider client={client}>
        <Editor />
      </QueryClientProvider>,
    );
    const table = screen.getByRole('table');
    const add = screen.getByRole('button', { name: 'Add Track' });
    expect(add).toBeDisabled();
    act(() => setProviderAccessLevel(provider, 'edit'));
    expect(add).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Upload audio file' })).toBeEnabled();
    expect(screen.getByRole('table')).toBe(table);
    act(() => setProviderAccessLevel(provider, 'view'));
    expect(screen.getByRole('table')).toBe(table);
    expect(screen.getByRole('button', { name: 'Upload audio file' })).toBeDisabled();
    const handle = screen.getByRole('button', { name: /Reorder.*Intro/i });
    expect(handle).toBeDisabled();
    await user.click(handle);
    expect(onTracksChange).not.toHaveBeenCalled();
    expect(mocks.reorderTracks).not.toHaveBeenCalled();
  });

  it('renders a failed backend status in the mobile track item', () => {
    mocks.runtime.mockReturnValue({
      value: { processing_status: 'TRACK_PROCESSING_STATUS_FAILED', processing_progress: 0, duration_seconds: null },
      isLoading: false,
    });
    render(
      <QueryClientProvider client={client}>
        <SortableTrackListItem
          track={track({ audio_original_file_id: 'audio-file' })}
          expanded={false}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          uploadProgress={null}
          onUploadProgressChange={vi.fn()}
          editor={null}
          formatDuration={() => '1:30'}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('img', { name: 'Failed' })).toBeInTheDocument();
  });

  it('renders mobile upload progress without mounting the release editor', () => {
    render(
      <QueryClientProvider client={client}>
        <SortableTrackListItem
          track={track()}
          expanded={false}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          uploadProgress={{ progress: 37, stage: 'uploading' }}
          onUploadProgressChange={vi.fn()}
          editor={null}
          formatDuration={() => '1:30'}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Uploading 37%')).toBeInTheDocument();
  });

  it('renders a backend resume notice in the mobile track item', () => {
    resumeSession();
    render(
      <QueryClientProvider client={client}>
        <SortableTrackListItem
          track={track()}
          expanded={false}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          uploadProgress={null}
          onUploadProgressChange={vi.fn()}
          editor={null}
          formatDuration={() => '1:30'}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Interrupted upload found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('connects the mobile edit command to expansion', async () => {
    const onToggle = vi.fn();
    const props = {
      track: track(),
      expanded: false,
      onToggle,
      onDelete: vi.fn(),
      uploadProgress: null,
      onUploadProgressChange: vi.fn(),
      editor: <p>Track credits</p>,
      formatDuration: () => '1:30',
    };
    const { user, rerender } = render(
      <QueryClientProvider client={client}>
        <SortableTrackListItem {...props} />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(
      <QueryClientProvider client={client}>
        <SortableTrackListItem {...props} expanded />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Track credits')).toBeInTheDocument();
  });

  it('renders a tracked interrupted upload below the desktop track only after availability is confirmed', () => {
    resumeSession();
    renderSection([
      track({
        pending_upload_file_id: 'pending-file',
        pending_upload_status: 'pending',
        pending_upload_started_at: new Date().toISOString(),
      }),
    ]);
    expect(screen.getByText('Interrupted upload found')).toBeInTheDocument();
  });

  it('shows a backend-only resume row and hides it after cancelling that session', async () => {
    resumeSession();
    const { user } = renderSection();
    expect(screen.getByText('Interrupted upload found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Interrupted upload found')).not.toBeInTheDocument());
    expect(abortUpload).toHaveBeenCalledWith({ fileId: 'resume-file', uploadId: 'resume-upload' });
  });

  it('opens the inline credits editor from the desktop track title', async () => {
    const { user } = renderSection();
    expect(screen.queryByText('Track credits')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Intro' }));
    expect(await screen.findByText('Track credits')).toBeInTheDocument();
    expect(screen.getByText('Add Credit')).toBeInTheDocument();
  });

  it('requires confirmation before deleting a track', async () => {
    const onTracksChange = vi.fn();
    const { user } = renderSection([track()], onTracksChange);
    expect(mocks.deleteTrack).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(dialog).getByText('Are you sure you want to delete this track?')).toBeInTheDocument();
    expect(mocks.deleteTrack).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onTracksChange).toHaveBeenCalledWith([]));
    expect(mocks.deleteTrack).toHaveBeenCalledWith('track-1', expect.any(String));
  });

  it('subscribes to the track file runtime and shows processing without collaboration fields', () => {
    mocks.runtime.mockReturnValue({
      value: {
        processing_status: 'TRACK_PROCESSING_STATUS_PROCESSING',
        processing_progress: 45,
        duration_seconds: null,
      },
      isLoading: false,
    });
    renderSection([track({ audio_original_file_id: 'audio-file' })]);
    expect(mocks.runtime).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'audio-file', trackId: 'track-1' }));
    const row = screen.getByRole('row', { name: /Intro/i });
    expect(within(row).getByRole('progressbar', { name: 'Processing 45%' })).toBeInTheDocument();
    expect(screen.getByText('Processing 45%')).toBeInTheDocument();
  });
});

it.each([
  [UploadResumeStateCode.LOOKUP_PENDING, 'Loading...'],
  [UploadResumeStateCode.LOOKUP_ERROR, 'Failed to load data.'],
  [UploadResumeStateCode.MISSING_SESSION, 'Not available'],
] as const)('renders %s instead of a persisted resume warning', (code, label) => {
  mocks.resume.mockReturnValue({ code, resumeNotice: null, hasActiveSession: false });
  renderSection([track({ pending_upload_file_id: 'pending-file', pending_upload_status: 'pending' })]);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByText('Interrupted upload found')).not.toBeInTheDocument();
});

it('keeps finalizing recovery ahead of the persisted resume warning', () => {
  resumeSession();
  mocks.resume.mockReturnValue({
    ...mocks.resume(),
    resumeNotice: { ...mocks.resume().resumeNotice, status: UploadSessionStatus.FINALIZING },
  });
  renderSection([track({ pending_upload_file_id: 'pending-file', pending_upload_status: 'pending' })]);
  expect(screen.getByText('Finalizing')).toBeInTheDocument();
  expect(screen.queryByText('Interrupted upload found')).not.toBeInTheDocument();
});

it('preserves an expired marker while resume lookup is pending', () => {
  mocks.resume.mockReturnValue({
    code: UploadResumeStateCode.LOOKUP_PENDING,
    resumeNotice: null,
    hasActiveSession: false,
  });
  renderSection([track({ pending_upload_file_id: 'pending-file', pending_upload_status: 'expired' })]);
  expect(screen.getByText('Upload session expired. Start a fresh upload.')).toBeInTheDocument();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

it('does not infer desktop resume availability from an idle persisted marker', () => {
  renderSection([track({ pending_upload_file_id: 'pending-file', pending_upload_status: 'pending' })]);
  expect(screen.queryByText('Interrupted upload found')).not.toBeInTheDocument();
});

it('shows local recovery pending in the mobile row without a transfer percentage', () => {
  mocks.resume.mockReturnValue({
    code: UploadResumeStateCode.LOOKUP_PENDING,
    resumeNotice: null,
    hasActiveSession: false,
  });
  render(
    <QueryClientProvider client={client}>
      <SortableTrackListItem
        track={track({ pending_upload_file_id: 'pending-file' })}
        expanded={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        uploadProgress={null}
        onUploadProgressChange={vi.fn()}
        editor={null}
        formatDuration={() => '1:30'}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  expect(screen.getByRole('progressbar', { name: 'Loading...' })).not.toHaveAttribute('aria-valuenow');
  expect(screen.queryByText('Interrupted upload found')).not.toBeInTheDocument();
});
