'use client';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { HierarchyIndent } from '@/components/core/Hierarchy';
import { ConfirmationDialog } from '@/features/confirmation';

import { SectionCard, SectionHeader } from '@/components/core/Section';
import { DisclosureRegion } from '@/components/core/Disclosure';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableSurface, ReorderRow, useSortableItem } from '@/components/core/Sortable';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { IconChevronDown, IconChevronUp, IconGripVertical, IconX } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Spinner, Table } from '@/components/core/Display';
import { Progress } from '@/components/core/Progress';
import { TimePicker, TextInput } from '@/components/core/Input';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button, SaveButton } from '@/components/core/Button';
import { TextButton } from '@/components/core/TextButton';
import { IconButton } from '@/components/core/IconButton';

import { Tooltip } from '@/components/core/Tooltip';
import { ConnectedFileDownloadPolicyEditor } from '@/features/media-download/ConnectedFileDownloadPolicyEditor';
import { createTrackAction, deleteTrackAction, updateTrackAction } from '@/lib/actions/track';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { useUploadSurfaceController } from '@/lib/hooks/useUploadSurfaceController';
import type { MediaStatusLabels } from '@/lib/media/status';
import { useMediaProcessingRuntimeState } from '@/lib/media/use-media-processing-runtime-state';
import { UploadType } from '@/lib/types/upload/model';
import { isUploadResumeSuppressed, type UploadResumeSuppressionIdentity } from '@/lib/upload/resume-suppression';
import type { UploadResumeState } from '@/lib/hooks/useUploadResumeNotice';
import { UploadResumeStateCode } from '@/lib/upload/resume-state';
import { TrackAudioUploader } from '../TrackAudioUploader';
import { resolveReleaseTrackProcessingStatus } from './track-processing-status';
import {
  applyReleaseTrackRuntimeState,
  getTrackProcessingLifecycle,
  resolveReleaseTrackRuntimeState,
  resolveTrackProgressIndicator,
  resolveTrackResumeIndicator,
  type ReleaseTrackRuntimeState,
  type TrackProcessingLifecycle,
  type TrackUploadProgressState,
} from './track-runtime';
import { ReleaseTrackCreateView, secondsToTimePickerValue, timePickerValueToSeconds } from './ReleaseTrackCreateView';
import { TrackCreditsEditorSection } from './TrackCreditsEditorSection';
import { getUntrackedConfigurationWriteOrigin } from '@/lib/editor/editor-write-origin';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { useTrackOrderSave } from './useTrackOrderSave';

interface ReleaseTracksSectionProps {
  releaseId: string;
  idPrefix?: string;
  tracks: ReleaseTrackItem[];
  onTracksChange: (tracks: ReleaseTrackItem[]) => void;
  onMutationStart?: () => string | void;
  onMutationSettled?: (succeeded: boolean) => void;
}

type MediaStatusMessageKey =
  | 'statuses.uploading'
  | 'statuses.processing'
  | 'statuses.ready'
  | 'statuses.failed'
  | 'statuses.unknown'
  | 'statuses.stage.validating'
  | 'statuses.stage.uploading'
  | 'statuses.stage.downloading'
  | 'statuses.stage.finalizing'
  | 'statuses.stage.processing';

function createLocalizedMediaStatusLabels(tMedia: (key: MediaStatusMessageKey) => string): MediaStatusLabels {
  return {
    uploading: tMedia('statuses.uploading'),
    processing: tMedia('statuses.processing'),
    ready: tMedia('statuses.ready'),
    failed: tMedia('statuses.failed'),
    unknown: tMedia('statuses.unknown'),
    stage: {
      validating: tMedia('statuses.stage.validating'),
      uploading: tMedia('statuses.stage.uploading'),
      downloading: tMedia('statuses.stage.downloading'),
      finalizing: tMedia('statuses.stage.finalizing'),
      processing: tMedia('statuses.stage.processing'),
    },
  };
}

export function ReleaseTracksSection({
  releaseId,
  idPrefix,
  tracks,
  onTracksChange,
  onMutationStart,
  onMutationSettled,
}: ReleaseTracksSectionProps) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks');
  const isMobile = useMediaQuery(breakpointQuery('sm'));
  const nextTrackNumber = tracks.reduce((max, track) => Math.max(max, track.track_number), 0) + 1;
  // Add track modal
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackDuration, setNewTrackDuration] = useState<number | ''>('');

  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [trackUploadProgress, setTrackUploadProgress] = useState<Record<string, TrackUploadProgressState>>({});
  const [editTrackTitle, setEditTrackTitle] = useState('');
  const [editTrackDuration, setEditTrackDuration] = useState<number | ''>('');
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);

  const createTrack = useMutation({
    mutationFn: async (data: {
      release_id: string;
      track_number: number;
      title: string;
      duration_seconds?: number;
    }) => {
      const editorOrigin = onMutationStart?.() || getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      const result = await createTrackAction(data, editorOrigin);
      if (result.data && !result.error) {
        publishEditorEntityChange(`release:${releaseId}`, editorOrigin);
      }
      return result;
    },
    onSettled: (result, error) => onMutationSettled?.(!error && Boolean(result?.data) && !result?.error),
  });

  const updateTrack = useMutation({
    mutationFn: async (data: {
      id: string;
      track_number?: number;
      title?: string;
      duration_seconds?: number | null;
    }) => {
      const editorOrigin = onMutationStart?.() || getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      const result = await updateTrackAction(data.id, data, editorOrigin);
      if (result.success && !result.error) {
        publishEditorEntityChange(`release:${releaseId}`, editorOrigin);
      }
      return result;
    },
    onSettled: (result, error) => onMutationSettled?.(!error && Boolean(result?.success) && !result?.error),
  });

  const deleteTrack = useMutation({
    mutationFn: async (id: string) => {
      const editorOrigin = onMutationStart?.() || getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      const result = await deleteTrackAction(id, editorOrigin);
      if (result.success && !result.error) {
        publishEditorEntityChange(`release:${releaseId}`, editorOrigin);
      }
      return result;
    },
    onSettled: (result, error) => onMutationSettled?.(!error && Boolean(result?.success) && !result?.error),
  });

  const saveTrackOrder = useTrackOrderSave({ releaseId, tracks, onTracksChange, onMutationStart, onMutationSettled });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(tracks, oldIndex, newIndex).map((track, index) => ({
        ...track,
        track_number: index + 1,
      }));
      saveTrackOrder(newOrder);
    }
  };

  const handleAddTrack = () => {
    if (!canEdit) {
      return;
    }
    if (!newTrackTitle.trim()) {
      return;
    }

    createTrack.mutate(
      {
        release_id: releaseId,
        track_number: nextTrackNumber,
        title: newTrackTitle.trim(),
        duration_seconds: newTrackDuration || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.error || !result.data) {
            notifications.show({
              message: result.error || t('messages.createFailed'),
              tone: 'danger',
            });
            return;
          }
          const newTrack = result.data;
          notifications.show({
            message: tCommon('messages.itemCreated', { item: tCommon('entities.track') }),
            tone: 'positive',
          });
          // Add new track to collab state
          const newTrackItem: ReleaseTrackItem = {
            id: newTrack.id,
            track_number: newTrack.track_number,
            title: newTrack.title,
            duration_seconds: newTrack.duration_seconds,
            audio_attached: false,
            processing_status: newTrack.processing_status,
            credits: [],
          };
          onTracksChange([...tracks, newTrackItem]);
          closeAddModal();
          setNewTrackTitle('');
          setNewTrackDuration('');
        },
      },
    );
  };

  const handleToggleTrackEditor = (track: ReleaseTrackItem) => {
    if (expandedTrackId === track.id) {
      setExpandedTrackId(null);
      return;
    }
    setExpandedTrackId(track.id);
    setEditTrackTitle(track.title);
    setEditTrackDuration(track.duration_seconds ?? '');
  };

  const handleUpdateTrack = () => {
    if (!canEdit) {
      return;
    }
    if (!expandedTrackId || !editTrackTitle.trim()) {
      return;
    }

    const durationSeconds = typeof editTrackDuration === 'number' ? editTrackDuration : null;

    updateTrack.mutate(
      {
        id: expandedTrackId,
        title: editTrackTitle.trim(),
        duration_seconds: durationSeconds,
      },
      {
        onSuccess: (result) => {
          if (result.error) {
            notifications.show({ message: result.error, tone: 'danger' });
            return;
          }
          notifications.show({
            message: tCommon('messages.itemUpdated', { item: tCommon('entities.track') }),
            tone: 'positive',
          });
          // Update track in collab state
          const updatedTracks = tracks.map((t) =>
            t.id === expandedTrackId
              ? {
                  ...t,
                  title: editTrackTitle.trim(),
                  duration_seconds: durationSeconds,
                }
              : t,
          );
          onTracksChange(updatedTracks);
        },
      },
    );
  };

  const handleDeleteTrack = (trackId: string) => {
    setDeletingTrackId(trackId);
    openDeleteModal();
  };

  const handleConfirmDeleteTrack = () => {
    if (!canEdit) {
      return;
    }
    if (!deletingTrackId) {
      return;
    }

    deleteTrack.mutate(deletingTrackId, {
      onSuccess: (result) => {
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
          return;
        }
        notifications.show({
          message: tCommon('messages.itemDeleted', { item: tCommon('entities.track') }),
          tone: 'positive',
        });
        // Remove track from collab state
        onTracksChange(tracks.filter((t) => t.id !== deletingTrackId));
        if (expandedTrackId === deletingTrackId) {
          setExpandedTrackId(null);
        }
        setDeletingTrackId(null);
        closeDeleteModal();
      },
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) {
      return '-';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset form when opening add modal
  const handleOpenAddModal = () => {
    setNewTrackTitle('');
    setNewTrackDuration('');
    openAddModal();
  };

  const handleTrackUploadProgressChange = useCallback(
    (trackId: string, nextState: { active: boolean; progress: number; stage?: string | null }) => {
      const nextProgress = nextState.active
        ? {
            progress: Math.max(0, Math.min(100, Math.round(nextState.progress))),
            stage: nextState.stage ?? 'uploading',
          }
        : null;

      setTrackUploadProgress((current) => {
        const currentProgress = current[trackId];

        if (nextProgress == null) {
          if (currentProgress == null) {
            return current;
          }

          const next = { ...current };
          delete next[trackId];
          return next;
        }

        if (
          currentProgress?.progress === nextProgress.progress &&
          (currentProgress?.stage ?? null) === (nextProgress.stage ?? null)
        ) {
          return current;
        }

        return {
          ...current,
          [trackId]: nextProgress,
        };
      });
    },
    [],
  );

  const renderTrackEditor = (track: ReleaseTrackItem) => {
    if (expandedTrackId !== track.id) {
      return null;
    }

    return (
      <TrackRowEditorPanel
        releaseId={releaseId}
        idPrefix={idPrefix}
        track={track}
        title={editTrackTitle}
        durationSeconds={editTrackDuration}
        onTitleChange={setEditTrackTitle}
        onDurationChange={setEditTrackDuration}
        onSave={handleUpdateTrack}
        onClose={() => setExpandedTrackId(null)}
        isSaving={updateTrack.isPending}
        onCreditsChange={(newCredits) => {
          onTracksChange(tracks.map((item) => (item.id === track.id ? { ...item, credits: newCredits } : item)));
        }}
        onMutationStart={onMutationStart}
        onMutationSettled={onMutationSettled}
      />
    );
  };

  return (
    <>
      <div id="release-tracks-section">
        <SectionCard>
          <DsLayoutStack>
            <SectionHeader
              title={tCommon('entities.tracks')}
              actions={
                <div id="release-track-add-action">
                  <ReleaseTrackCreateView
                    idPrefix={idPrefix ? `${idPrefix}-new-track` : undefined}
                    opened={addModalOpened}
                    title={newTrackTitle}
                    durationSeconds={newTrackDuration}
                    isCreating={createTrack.isPending}
                    onOpen={handleOpenAddModal}
                    onClose={closeAddModal}
                    onTitleChange={setNewTrackTitle}
                    onDurationChange={setNewTrackDuration}
                    onSubmit={handleAddTrack}
                  />
                </div>
              }
            />

            {tracks.length === 0 ? (
              <SupportingText tone="secondary">{t('empty')}</SupportingText>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {isMobile ? (
                    <DsLayoutStack gap="none">
                      {tracks.map((track) => (
                        <SortableTrackListItem
                          key={track.id}
                          track={track}
                          expanded={expandedTrackId === track.id}
                          onToggle={() => handleToggleTrackEditor(track)}
                          onDelete={() => handleDeleteTrack(track.id)}
                          uploadProgress={trackUploadProgress[track.id] ?? null}
                          onUploadProgressChange={handleTrackUploadProgressChange}
                          editor={renderTrackEditor(track)}
                          idPrefix={idPrefix}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </DsLayoutStack>
                  ) : (
                    <Table density="compact">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th />
                          <Table.Th>{tCommon('labels.title')}</Table.Th>
                          <Table.Th width={80}>{tCommon('labels.length')}</Table.Th>
                          <Table.Th width={104}>{tCommon('labels.status')}</Table.Th>
                          <Table.Th width={132} align="end">
                            {tCommon('labels.actions')}
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {tracks.map((track) => (
                          <SortableTrackRow
                            key={track.id}
                            track={track}
                            expanded={expandedTrackId === track.id}
                            onToggle={() => handleToggleTrackEditor(track)}
                            onDelete={() => handleDeleteTrack(track.id)}
                            uploadProgress={trackUploadProgress[track.id] ?? null}
                            onUploadProgressChange={handleTrackUploadProgressChange}
                            editor={renderTrackEditor(track)}
                            idPrefix={idPrefix}
                            formatDuration={formatDuration}
                          />
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </SortableContext>
              </DndContext>
            )}
          </DsLayoutStack>
        </SectionCard>
      </div>

      <ConfirmationDialog
        intent="delete"
        opened={deleteModalOpened}
        onClose={() => {
          setDeletingTrackId(null);
          closeDeleteModal();
        }}
        confirmDisabled={!canEdit}
        onConfirm={handleConfirmDeleteTrack}
        title={tCommon('actions.delete')}
        message={t('deleteConfirm')}
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteTrack.isPending}
      />
    </>
  );
}

// Sortable track row component
interface SortableTrackRowProps {
  idPrefix?: string;
  track: {
    id: string;
    track_number: number;
    title: string;
    duration_seconds: number | null;
    audio_attached: boolean;
    audio_original_file_id?: string | null;
    processing_status: string | null;
    processing_progress?: number | null;
    pending_upload_file_id?: string;
    pending_upload_attempt_id?: string;
    pending_upload_status?: ReleaseTrackItem['pending_upload_status'];
    pending_upload_started_at?: string;
  };
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUploadProgressChange: (
    trackId: string,
    nextState: { active: boolean; progress: number; stage?: string | null },
  ) => void;
  uploadProgress: TrackUploadProgressState | null;
  formatDuration: (seconds: number | null) => string;
  editor?: React.ReactNode;
}

type TrackUploadProgressIndicator = Pick<
  NonNullable<ReturnType<typeof resolveTrackProgressIndicator>>,
  'label' | 'progress'
>;
type TrackResumeIndicator = { kind: 'warning' | 'pending' | 'failed'; label: string };

interface TrackAudioViewProps {
  idPrefix?: string;
  track: SortableTrackRowProps['track'];
  uploadProgress: TrackUploadProgressState | null;
  processingLifecycle: TrackProcessingLifecycle | null;
  suppressedResumeIdentity: UploadResumeSuppressionIdentity | null;
  backendResumeState: UploadResumeState;
}

function TrackAudioStatusView({
  idPrefix,
  track,
  uploadProgress,
  processingLifecycle,
  suppressedResumeIdentity,
  backendResumeState,
}: TrackAudioViewProps) {
  return (
    <TrackAudioUploader
      trackId={track.id}
      audioOriginalFileId={track.audio_original_file_id}
      inputId={idPrefix ? `${idPrefix}-track-audio-${track.id}` : undefined}
      processingStatus={resolveReleaseTrackProcessingStatus(track.processing_status)}
      audioAttached={track.audio_attached}
      activeUploadState={
        uploadProgress
          ? {
              active: true,
              progress: uploadProgress.progress,
              stage: uploadProgress.stage ?? null,
            }
          : null
      }
      pendingUploadFileId={track.pending_upload_file_id}
      pendingUploadAttemptId={track.pending_upload_attempt_id}
      pendingUploadStatus={track.pending_upload_status}
      pendingUploadStartedAt={track.pending_upload_started_at}
      processingActive={processingLifecycle != null}
      processingProgress={processingLifecycle?.progress}
      suppressedResumeIdentity={suppressedResumeIdentity}
      resumeStateOverride={backendResumeState}
      compact
      mode="status-only"
    />
  );
}

interface TrackAudioUploadButtonViewProps extends Omit<TrackAudioViewProps, 'uploadProgress'> {
  onUploadProgressChange: SortableTrackRowProps['onUploadProgressChange'];
  onPendingUploadCancelled: (identity: UploadResumeSuppressionIdentity) => void;
}

function TrackAudioUploadButtonView({
  idPrefix,
  track,
  processingLifecycle,
  suppressedResumeIdentity,
  onUploadProgressChange,
  onPendingUploadCancelled,
  backendResumeState,
}: TrackAudioUploadButtonViewProps) {
  const canEdit = useReleaseEditorCanEdit();
  return (
    <TrackAudioUploader
      trackId={track.id}
      audioOriginalFileId={track.audio_original_file_id}
      inputId={idPrefix ? `${idPrefix}-track-audio-upload-${track.id}` : undefined}
      processingStatus={resolveReleaseTrackProcessingStatus(track.processing_status)}
      audioAttached={track.audio_attached}
      pendingUploadFileId={track.pending_upload_file_id}
      pendingUploadAttemptId={track.pending_upload_attempt_id}
      pendingUploadStatus={track.pending_upload_status}
      pendingUploadStartedAt={track.pending_upload_started_at}
      processingActive={processingLifecycle != null}
      processingProgress={processingLifecycle?.progress}
      onUploadProgressChange={onUploadProgressChange}
      onPendingUploadCancelled={onPendingUploadCancelled}
      suppressedResumeIdentity={suppressedResumeIdentity}
      resumeStateOverride={backendResumeState}
      compact
      disabled={!canEdit}
      mode="button-only"
    />
  );
}

function TrackProgressDetails({ indicator }: { indicator: TrackUploadProgressIndicator }) {
  return (
    <>
      <DsLayoutInline justify="between" gap="sm" wrap="nowrap">
        <DsText size="xs" tone="accent">
          {indicator.label}
        </DsText>
        {indicator.progress != null ? (
          <DsText size="xs" tone="accent">
            {indicator.progress}%
          </DsText>
        ) : null}
      </DsLayoutInline>
      <Progress value={indicator.progress ?? 0} size="xs" tone="accent" aria-label={indicator.label} />
    </>
  );
}

function TrackResumeMessage({ indicator }: { indicator: TrackResumeIndicator }) {
  if (indicator.kind === 'pending') {
    return (
      <DsLayoutInline gap="xs" role="status">
        <Spinner size="xs" />
        <DsText size="xs" tone="secondary">
          {indicator.label}
        </DsText>
      </DsLayoutInline>
    );
  }
  return (
    <DsText size="xs" tone={indicator.kind === 'failed' ? 'danger' : 'warning'}>
      {indicator.label}
    </DsText>
  );
}

function useEditorVisibility(expanded: boolean, editor?: React.ReactNode) {
  return { shouldRenderEditor: expanded, collapseOpen: expanded, cachedEditor: editor };
}

function TrackEditorSurface({ children }: { children: React.ReactNode }) {
  return (
    <SectionCard appearance="muted" padding="sm" withBorder={false}>
      {children}
    </SectionCard>
  );
}

function TrackDurationPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: number | '';
  onChange: (value: number | '') => void;
}) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');

  return (
    <TimePicker
      id={id}
      label={tCommon('labels.length')}
      value={secondsToTimePickerValue(value)}
      disabled={!canEdit}
      onChange={(nextValue) => onChange(timePickerValueToSeconds(nextValue))}
      clearable
      withSeconds
      hoursInputLabel={tCommon('labels.hours')}
      minutesInputLabel={tCommon('labels.minutes')}
      secondsInputLabel={tCommon('labels.seconds')}
    />
  );
}

function useReleaseTrackRuntimeState(
  track: Pick<
    ReleaseTrackItem,
    'id' | 'audio_original_file_id' | 'pending_upload_file_id' | 'pending_upload_attempt_id'
  >,
): ReleaseTrackRuntimeState | null {
  const runtime = useMediaProcessingRuntimeState({
    fileId: track.audio_original_file_id,
    pendingUploadFileId: track.pending_upload_file_id,
    mediaAttemptId: track.pending_upload_attempt_id,
    trackId: track.id,
    enabled: Boolean(
      track.audio_original_file_id || track.pending_upload_file_id || track.pending_upload_attempt_id || track.id,
    ),
    mapStatus: useCallback((status) => resolveReleaseTrackRuntimeState(status), []),
  });

  return runtime.value;
}

function useReleaseTrackUploadSurfaceState({
  track,
  uploadProgress,
  mediaStatusLabels,
  resumeLabels,
}: {
  track: SortableTrackRowProps['track'];
  uploadProgress: TrackUploadProgressState | null;
  mediaStatusLabels: MediaStatusLabels;
  resumeLabels: {
    resumeAvailable: string;
    resumeExpired: string;
  };
}) {
  const tCommon = useTranslations('common');
  const runtimeTrackState = useReleaseTrackRuntimeState(track);
  const effectiveTrack = applyReleaseTrackRuntimeState(track, runtimeTrackState);
  const processingLifecycle = getTrackProcessingLifecycle(effectiveTrack);
  const [suppressedResumeIdentity, setSuppressedResumeIdentity] = useState<UploadResumeSuppressionIdentity | null>(
    null,
  );
  const uploadSurface = useUploadSurfaceController({
    uploadType: UploadType.TRACK_AUDIO,
    entityId: effectiveTrack.id,
    resumeEntityId:
      !effectiveTrack.audio_attached ||
      effectiveTrack.pending_upload_file_id ||
      effectiveTrack.pending_upload_attempt_id
        ? effectiveTrack.id
        : null,
    entityType: TranscodeEntityType.TRACK,
    expectedCurrentFileId: effectiveTrack.audio_original_file_id || undefined,
    fileId: effectiveTrack.pending_upload_file_id || undefined,
    attemptId: effectiveTrack.pending_upload_attempt_id || undefined,
    pendingFileId: effectiveTrack.pending_upload_file_id || undefined,
    hasDurableSource: effectiveTrack.audio_attached,
  });
  const backendResumeState = uploadSurface.resumeState;
  const isBackendResumeSuppressed = isUploadResumeSuppressed(
    backendResumeState.resumeNotice ?? {
      fileId: effectiveTrack.pending_upload_file_id,
      attemptId: effectiveTrack.pending_upload_attempt_id,
    },
    suppressedResumeIdentity,
  );

  useEffect(() => {
    if (!suppressedResumeIdentity || !backendResumeState.resumeNotice) {
      return;
    }
    if (!isBackendResumeSuppressed) {
      setSuppressedResumeIdentity(null);
    }
  }, [backendResumeState.resumeNotice, isBackendResumeSuppressed, suppressedResumeIdentity]);

  const handlePendingUploadCancelled = useCallback((identity: UploadResumeSuppressionIdentity) => {
    setSuppressedResumeIdentity(identity);
  }, []);
  const isFinalizing = backendResumeState.resumeNotice?.status === UploadSessionStatus.FINALIZING;
  const progressIndicator =
    uploadProgress != null
      ? resolveTrackProgressIndicator(mediaStatusLabels, uploadProgress, null)
      : isFinalizing
        ? { label: mediaStatusLabels.stage.finalizing, progress: null }
        : resolveTrackProgressIndicator(mediaStatusLabels, null, processingLifecycle);
  const pendingResumeIndicator = resolveTrackResumeIndicator(effectiveTrack, resumeLabels);
  const backendResumeIndicator =
    backendResumeState.code === UploadResumeStateCode.AVAILABLE &&
    backendResumeState.resumeNotice &&
    !isBackendResumeSuppressed &&
    !effectiveTrack.audio_attached
      ? {
          kind: 'warning' as const,
          label: resumeLabels.resumeAvailable,
          color: 'yellow' as const,
        }
      : null;
  const resolveResumeIndicator = (): TrackResumeIndicator | null => {
    if (progressIndicator || isBackendResumeSuppressed || effectiveTrack.audio_attached) {
      return null;
    }
    if (pendingResumeIndicator?.color === 'red') {
      return pendingResumeIndicator;
    }
    switch (backendResumeState.code) {
      case UploadResumeStateCode.LOOKUP_PENDING:
        return { kind: 'pending', label: tCommon('states.loading') };
      case UploadResumeStateCode.LOOKUP_ERROR:
        return { kind: 'failed', label: tCommon('messages.failedToLoad') };
      case UploadResumeStateCode.MISSING_SESSION:
        return { kind: 'warning', label: tCommon('states.notAvailable') };
      case UploadResumeStateCode.AVAILABLE:
        return backendResumeIndicator ? (pendingResumeIndicator ?? backendResumeIndicator) : null;
      default:
        return null;
    }
  };
  const resumeIndicator = resolveResumeIndicator();

  return {
    effectiveTrack,
    processingLifecycle,
    suppressedResumeIdentity,
    backendResumeState,
    handlePendingUploadCancelled,
    progressIndicator,
    resumeIndicator,
  };
}

export function SortableTrackRow({
  idPrefix,
  track,
  expanded,
  onToggle,
  onDelete,
  onUploadProgressChange,
  uploadProgress,
  formatDuration,
  editor,
}: SortableTrackRowProps) {
  const canEdit = useReleaseEditorCanEdit();
  const sortable = useSortableItem({
    id: track.id,
    disabled: !canEdit,
  });
  const tCommon = useTranslations('common');
  const tSort = useTranslations('dataTable.sort');
  const tMedia = useTranslations('editorCommon.media');
  const tTrackAudio = useTranslations('releaseEditor.tracks.audio');
  const tIngestDialog = useTranslations('editorCommon.media.ingestDialog');
  const mediaStatusLabels = createLocalizedMediaStatusLabels(tMedia);
  const {
    effectiveTrack,
    processingLifecycle,
    suppressedResumeIdentity,
    backendResumeState,
    handlePendingUploadCancelled,
    progressIndicator,
    resumeIndicator,
  } = useReleaseTrackUploadSurfaceState({
    track,
    uploadProgress,
    mediaStatusLabels,
    resumeLabels: {
      resumeAvailable: tIngestDialog('resumeAvailable'),
      resumeExpired: tTrackAudio('resumeExpired'),
    },
  });
  const editorPanelId = useId();
  const { shouldRenderEditor, collapseOpen, cachedEditor } = useEditorVisibility(expanded, editor);

  return (
    <>
      <Table.Tr id={`release-track-row-${track.id}`} ref={sortable.setNodeRef} dragState={sortable.dragState}>
        <Table.Td>
          <IconButton
            emphasis="low"
            interaction="drag-handle"
            draggable={false}
            {...sortable.handle}
            disabled={!canEdit}
            aria-label={tSort('aria.reorder', { label: track.title })}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
        </Table.Td>
        <Table.Td>
          <Button
            id={`${editorPanelId}-title`}
            size="sm"
            emphasis="low"
            aria-expanded={expanded}
            aria-controls={expanded ? editorPanelId : undefined}
            onClick={onToggle}
          >
            {track.title}
          </Button>
        </Table.Td>
        <Table.Td>
          <DsText size="sm" tone="secondary">
            {formatDuration(effectiveTrack.duration_seconds)}
          </DsText>
        </Table.Td>
        <Table.Td>
          <TrackAudioStatusView
            idPrefix={idPrefix}
            track={effectiveTrack}
            uploadProgress={uploadProgress}
            processingLifecycle={processingLifecycle}
            suppressedResumeIdentity={suppressedResumeIdentity}
            backendResumeState={backendResumeState}
          />
        </Table.Td>
        <Table.Td>
          <DsLayoutInline gap="xxs" justify="end" wrap="nowrap" role="group" aria-labelledby={`${editorPanelId}-title`}>
            <TrackAudioUploadButtonView
              idPrefix={idPrefix}
              track={effectiveTrack}
              processingLifecycle={processingLifecycle}
              suppressedResumeIdentity={suppressedResumeIdentity}
              backendResumeState={backendResumeState}
              onUploadProgressChange={onUploadProgressChange}
              onPendingUploadCancelled={handlePendingUploadCancelled}
            />
            <Tooltip label={tCommon('actions.delete')}>
              <IconButton
                tone="danger"
                emphasis="low"
                size="compact"
                disabled={!canEdit}
                onClick={onDelete}
                aria-label={tCommon('actions.delete')}
                aria-describedby={`${editorPanelId}-title`}
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
            <IconButton
              emphasis="low"
              size="compact"
              aria-expanded={expanded}
              aria-controls={expanded ? editorPanelId : undefined}
              aria-describedby={`${editorPanelId}-title`}
              onClick={onToggle}
              aria-label={expanded ? tCommon('actions.close') : tCommon('actions.edit')}
            >
              {expanded ? <IconChevronUp aria-hidden /> : <IconChevronDown aria-hidden />}
            </IconButton>
          </DsLayoutInline>
        </Table.Td>
      </Table.Tr>
      {progressIndicator ? (
        <Table.Tr id={`release-track-progress-row-${track.id}`}>
          <Table.Td colSpan={5}>
            <DsLayoutInset block="xs">
              <DsLayoutStack gap="xxs">
                {resumeIndicator ? (
                  <TrackResumeMessage indicator={resumeIndicator} />
                ) : (
                  <TrackProgressDetails indicator={progressIndicator} />
                )}
              </DsLayoutStack>
            </DsLayoutInset>
          </Table.Td>
        </Table.Tr>
      ) : resumeIndicator ? (
        <Table.Tr id={`release-track-resume-row-${track.id}`}>
          <Table.Td colSpan={5}>
            <DsLayoutInset block="xs">
              <DsLayoutStack gap="xxs">
                <TrackResumeMessage indicator={resumeIndicator} />
              </DsLayoutStack>
            </DsLayoutInset>
          </Table.Td>
        </Table.Tr>
      ) : null}
      {shouldRenderEditor && cachedEditor ? (
        <Table.Tr>
          <Table.Td colSpan={5}>
            <DisclosureRegion id={editorPanelId} labelledBy={`${editorPanelId}-title`} expanded={collapseOpen}>
              <DsLayoutInset block="xxs">
                <DsLayoutInset space="none">
                  <TrackEditorSurface>{cachedEditor}</TrackEditorSurface>
                </DsLayoutInset>
              </DsLayoutInset>
            </DisclosureRegion>
          </Table.Td>
        </Table.Tr>
      ) : null}
    </>
  );
}

type SortableTrackListItemProps = SortableTrackRowProps;

export function SortableTrackListItem({
  idPrefix,
  track,
  expanded,
  onToggle,
  onDelete,
  onUploadProgressChange,
  uploadProgress,
  formatDuration,
  editor,
}: SortableTrackListItemProps) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const tSort = useTranslations('dataTable.sort');
  const tMedia = useTranslations('editorCommon.media');
  const tTrackAudio = useTranslations('releaseEditor.tracks.audio');
  const tIngestDialog = useTranslations('editorCommon.media.ingestDialog');
  const mediaStatusLabels = createLocalizedMediaStatusLabels(tMedia);
  const {
    effectiveTrack,
    processingLifecycle,
    suppressedResumeIdentity,
    backendResumeState,
    handlePendingUploadCancelled,
    progressIndicator,
    resumeIndicator,
  } = useReleaseTrackUploadSurfaceState({
    track,
    uploadProgress,
    mediaStatusLabels,
    resumeLabels: {
      resumeAvailable: tIngestDialog('resumeAvailable'),
      resumeExpired: tTrackAudio('resumeExpired'),
    },
  });
  const sortable = useSortableItem({
    id: track.id,
    disabled: !canEdit,
  });
  const editorPanelId = useId();
  const { shouldRenderEditor, collapseOpen, cachedEditor } = useEditorVisibility(expanded, editor);

  const hasStatus = Boolean(
    effectiveTrack.audio_attached ||
    resolveReleaseTrackProcessingStatus(effectiveTrack.processing_status) ||
    processingLifecycle ||
    uploadProgress ||
    progressIndicator ||
    resumeIndicator,
  );
  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <ReorderRow
        handle={
          <IconButton
            interaction="drag-handle"
            draggable={false}
            {...sortable.handle}
            disabled={!canEdit}
            aria-label={tSort('aria.reorder', { label: track.title })}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
        }
        actions={
          <DsLayoutInline gap="none" wrap="nowrap" role="group" aria-labelledby={`${editorPanelId}-title`}>
            <TrackAudioUploadButtonView
              idPrefix={idPrefix}
              track={effectiveTrack}
              processingLifecycle={processingLifecycle}
              suppressedResumeIdentity={suppressedResumeIdentity}
              onUploadProgressChange={onUploadProgressChange}
              onPendingUploadCancelled={handlePendingUploadCancelled}
              backendResumeState={backendResumeState}
            />
            <IconButton
              tone="danger"
              disabled={!canEdit}
              onClick={onDelete}
              aria-label={tCommon('actions.delete')}
              aria-describedby={`${editorPanelId}-title`}
            >
              <IconX aria-hidden />
            </IconButton>
            <IconButton
              aria-expanded={expanded}
              aria-controls={expanded ? editorPanelId : undefined}
              aria-describedby={`${editorPanelId}-title`}
              onClick={onToggle}
              aria-label={expanded ? tCommon('actions.close') : tCommon('actions.edit')}
            >
              {expanded ? <IconChevronUp aria-hidden /> : <IconChevronDown aria-hidden />}
            </IconButton>
          </DsLayoutInline>
        }
      >
        <DsLayoutInline gap="xxs" wrap="nowrap" justify="between">
          <TextButton
            id={`${editorPanelId}-title`}
            size="xs"
            aria-expanded={expanded}
            aria-controls={expanded ? editorPanelId : undefined}
            onClick={onToggle}
          >
            {track.title}
          </TextButton>
          <DsText size="xs" tone="secondary" shrink={false}>
            {formatDuration(effectiveTrack.duration_seconds)}
          </DsText>
        </DsLayoutInline>
      </ReorderRow>
      <HierarchyIndent alignment="parent-label">
        <DsLayoutStack gap="xxs">
          {hasStatus ? (
            <TrackAudioStatusView
              idPrefix={idPrefix}
              track={effectiveTrack}
              uploadProgress={uploadProgress}
              processingLifecycle={processingLifecycle}
              suppressedResumeIdentity={suppressedResumeIdentity}
              backendResumeState={backendResumeState}
            />
          ) : null}
          {progressIndicator ? (
            resumeIndicator ? (
              <TrackResumeMessage indicator={resumeIndicator} />
            ) : (
              <TrackProgressDetails indicator={progressIndicator} />
            )
          ) : resumeIndicator ? (
            <TrackResumeMessage indicator={resumeIndicator} />
          ) : null}
          {shouldRenderEditor && cachedEditor ? (
            <DisclosureRegion id={editorPanelId} labelledBy={`${editorPanelId}-title`} expanded={collapseOpen}>
              <TrackEditorSurface>{cachedEditor}</TrackEditorSurface>
            </DisclosureRegion>
          ) : null}
        </DsLayoutStack>
      </HierarchyIndent>
    </SortableSurface>
  );
}

interface TrackRowEditorPanelProps {
  releaseId: string;
  idPrefix?: string;
  track: ReleaseTrackItem;
  title: string;
  durationSeconds: number | '';
  onTitleChange: (value: string) => void;
  onDurationChange: (value: number | '') => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  onCreditsChange: (credits: ReleaseTrackItem['credits']) => void;
  onMutationStart?: () => string | void;
  onMutationSettled?: (succeeded: boolean) => void;
}

function TrackRowEditorPanel({
  releaseId,
  idPrefix,
  track,
  title,
  durationSeconds,
  onTitleChange,
  onDurationChange,
  onSave,
  onClose,
  isSaving,
  onCreditsChange,
  onMutationStart,
  onMutationSettled,
}: TrackRowEditorPanelProps) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks');
  const isMobile = useMediaQuery(breakpointQuery('sm'));

  return (
    <DsLayoutStack gap="md">
      <DsLayoutInline align="start" gap="sm" grow={isMobile} wrap={isMobile ? 'wrap' : 'nowrap'}>
        <div style={{ minWidth: isMobile ? '100%' : 0, flex: 1 }}>
          <TextInput
            grow
            id={idPrefix ? `${idPrefix}-edit-track-title-${track.id}` : undefined}
            label={tCommon('labels.title')}
            placeholder={t('placeholders.title')}
            disabled={!canEdit}
            value={title}
            onChange={(e) => onTitleChange(e.currentTarget.value)}
            required
          />
        </div>
        <div style={{ width: isMobile ? '100%' : 180 }}>
          <TrackDurationPicker
            id={idPrefix ? `${idPrefix}-edit-track-duration-${track.id}` : undefined}
            value={durationSeconds}
            onChange={onDurationChange}
          />
        </div>
      </DsLayoutInline>

      {track.audio_original_file_id ? (
        <ConnectedFileDownloadPolicyEditor
          entityType={TranscodeEntityType.TRACK}
          entityId={track.id}
          releaseId={releaseId}
          expectedFileId={track.audio_original_file_id}
          readOnly={!canEdit}
          compact={false}
        />
      ) : null}

      <TrackCreditsEditorSection
        releaseId={releaseId}
        idPrefix={idPrefix}
        trackId={track.id}
        credits={track.credits}
        onCreditsChange={onCreditsChange}
        onMutationStart={onMutationStart}
        onMutationSettled={onMutationSettled}
      />

      <DsLayoutInline justify="end">
        <Button emphasis="low" onClick={onClose}>
          {tCommon('actions.close')}
        </Button>
        <SaveButton type="button" onClick={onSave} loading={isSaving} disabled={!canEdit || !title.trim()}>
          {tCommon('actions.save')}
        </SaveButton>
      </DsLayoutInline>
    </DsLayoutStack>
  );
}
