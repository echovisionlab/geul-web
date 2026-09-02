'use client';

import { useCallback, useEffect, useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconChevronDown, IconGripVertical, IconX } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Collapse, Divider, Group, Progress, Stack, Table, Text } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal } from '@/components/core/Modal';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import { ConnectedFileDownloadPolicyEditor } from '@/features/media-download/ConnectedFileDownloadPolicyEditor';
import { createTrackAction, deleteTrackAction, reorderTracksAction, updateTrackAction } from '@/lib/actions/track';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { useUploadSurfaceController } from '@/lib/hooks/useUploadSurfaceController';
import type { MediaStatusLabels } from '@/lib/media/status';
import { useMediaProcessingRuntimeState } from '@/lib/media/use-media-processing-runtime-state';
import { UploadType } from '@/lib/types/upload/model';
import { isUploadResumeSuppressed, type UploadResumeSuppressionIdentity } from '@/lib/upload/resume-suppression';
import { TrackAudioUploader } from '../TrackAudioUploader';
import { resolveReleaseTrackProcessingStatus } from './track-processing-status';
import {
  applyReleaseTrackRuntimeState,
  getTrackProcessingLifecycle,
  resolveReleaseTrackRuntimeState,
  resolveTrackProgressIndicator,
  resolveTrackResumeIndicator,
  type ReleaseTrackRuntimeState,
  type TrackUploadProgressState,
} from './track-runtime';
import { ReleaseTrackCreateView, secondsToTimePickerValue, timePickerValueToSeconds } from './ReleaseTrackCreateView';
import { TrackCreditsEditorSection } from './TrackCreditsEditorSection';

interface ReleaseTracksSectionProps {
  releaseId: string;
  idPrefix?: string;
  tracks: ReleaseTrackItem[];
  onTracksChange: (tracks: ReleaseTrackItem[]) => void;
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

export function ReleaseTracksSection({ releaseId, idPrefix, tracks, onTracksChange }: ReleaseTracksSectionProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks');
  const isMobile = useMediaQuery('(max-width: 48em)');
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
    mutationFn: (data: { release_id: string; track_number: number; title: string; duration_seconds?: number }) =>
      createTrackAction(data),
  });

  const updateTrack = useMutation({
    mutationFn: (data: { id: string; track_number?: number; title?: string; duration_seconds?: number | null }) =>
      updateTrackAction(data.id, data),
  });

  const deleteTrack = useMutation({
    mutationFn: (id: string) => deleteTrackAction(id),
  });

  const reorderTracks = useMutation({
    mutationFn: (trackIds: string[]) => reorderTracksAction(trackIds),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
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
      // Update collab state immediately
      onTracksChange(newOrder);
      // Persist to DB
      reorderTracks.mutate(newOrder.map((t) => t.id));
    }
  };

  const handleAddTrack = () => {
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
              color: 'red',
            });
            return;
          }
          const newTrack = result.data;
          notifications.show({
            message: tCommon('messages.itemCreated', { item: tCommon('entities.track') }),
            color: 'green',
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
        onSuccess: () => {
          notifications.show({
            message: tCommon('messages.itemUpdated', { item: tCommon('entities.track') }),
            color: 'green',
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
    if (!deletingTrackId) {
      return;
    }

    deleteTrack.mutate(deletingTrackId, {
      onSuccess: () => {
        notifications.show({
          message: tCommon('messages.itemDeleted', { item: tCommon('entities.track') }),
          color: 'red',
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

  return (
    <>
      <div id="release-tracks-section">
        <SectionCard>
          <Stack>
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
              <Text size="sm" c="dimmed">
                {t('empty')}
              </Text>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {isMobile ? (
                    <Stack gap={0}>
                      {tracks.map((track, index) => (
                        <SortableTrackListItem
                          key={track.id}
                          track={track}
                          expanded={expandedTrackId === track.id}
                          onToggle={() => handleToggleTrackEditor(track)}
                          onDelete={() => handleDeleteTrack(track.id)}
                          uploadProgress={trackUploadProgress[track.id] ?? null}
                          onUploadProgressChange={handleTrackUploadProgressChange}
                          editor={
                            expandedTrackId === track.id ? (
                              <TrackRowEditorPanel
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
                                  onTracksChange(
                                    tracks.map((item) =>
                                      item.id === track.id ? { ...item, credits: newCredits } : item,
                                    ),
                                  );
                                }}
                              />
                            ) : null
                          }
                          idPrefix={idPrefix}
                          formatDuration={formatDuration}
                          showDivider={index < tracks.length - 1}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={40} />
                          <Table.Th>{tCommon('labels.title')}</Table.Th>
                          <Table.Th w={80}>{tCommon('labels.length')}</Table.Th>
                          <Table.Th w={104}>{tCommon('labels.status')}</Table.Th>
                          <Table.Th w={132} style={{ textAlign: 'right' }}>
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
                            editor={
                              expandedTrackId === track.id ? (
                                <TrackRowEditorPanel
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
                                    onTracksChange(
                                      tracks.map((item) =>
                                        item.id === track.id ? { ...item, credits: newCredits } : item,
                                      ),
                                    );
                                  }}
                                />
                              ) : null
                            }
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
          </Stack>
        </SectionCard>
      </div>

      <ConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeletingTrackId(null);
          closeDeleteModal();
        }}
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

function useAnimatedEditorVisibility(expanded: boolean, editor?: React.ReactNode) {
  const [shouldRenderEditor, setShouldRenderEditor] = useState(expanded);
  const [collapseOpen, setCollapseOpen] = useState(expanded);
  const [cachedEditor, setCachedEditor] = useState(editor);

  useEffect(() => {
    if (editor) {
      setCachedEditor(editor);
    }
  }, [editor]);

  useEffect(() => {
    if (expanded) {
      setShouldRenderEditor(true);
      setCollapseOpen(false);

      const frameId = window.requestAnimationFrame(() => {
        setCollapseOpen(true);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    setCollapseOpen(false);

    const timeoutId = window.setTimeout(() => {
      setShouldRenderEditor(false);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expanded]);

  return { shouldRenderEditor, collapseOpen, cachedEditor };
}

function TrackEditorSurface({ children }: { children: React.ReactNode }) {
  return (
    <Box
      px="sm"
      py="sm"
      style={{
        backgroundColor: 'light-dark(var(--mantine-color-gray-0), rgb(255 255 255 / 0.02))',
        borderRadius: 'var(--mantine-radius-xs)',
      }}
    >
      {children}
    </Box>
  );
}

function TrackDurationPicker({
  id,
  value,
  onChange,
  style,
}: {
  id?: string;
  value: number | '';
  onChange: (value: number | '') => void;
  style?: React.CSSProperties;
}) {
  const tCommon = useTranslations('common');

  return (
    <TimePicker
      id={id}
      label={tCommon('labels.length')}
      value={secondsToTimePickerValue(value)}
      onChange={(nextValue) => onChange(timePickerValueToSeconds(nextValue))}
      clearable
      withSeconds
      hoursInputLabel={tCommon('labels.hours')}
      minutesInputLabel={tCommon('labels.minutes')}
      secondsInputLabel={tCommon('labels.seconds')}
      style={style}
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
  const isBackendResumeSuppressed = isUploadResumeSuppressed(backendResumeState.resumeNotice, suppressedResumeIdentity);

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
  const progressIndicator = resolveTrackProgressIndicator(mediaStatusLabels, uploadProgress, processingLifecycle);
  const pendingResumeIndicator = resolveTrackResumeIndicator(effectiveTrack, resumeLabels);
  const backendResumeIndicator =
    backendResumeState.resumeNotice && !isBackendResumeSuppressed && !effectiveTrack.audio_attached
      ? {
          kind: 'warning' as const,
          label: resumeLabels.resumeAvailable,
          color: 'yellow' as const,
        }
      : null;
  const resumeIndicator =
    uploadProgress == null && !processingLifecycle ? (pendingResumeIndicator ?? backendResumeIndicator) : null;

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

function SortableTrackRow({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });
  const tCommon = useTranslations('common');
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
  const { shouldRenderEditor, collapseOpen, cachedEditor } = useAnimatedEditorVisibility(expanded, editor);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <Table.Tr id={`release-track-row-${track.id}`} ref={setNodeRef} style={style}>
        <Table.Td>
          <Box {...attributes} {...listeners} style={{ cursor: 'grab' }}>
            <IconGripVertical size={14} color="gray" />
          </Box>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500} style={{ cursor: 'pointer' }} onClick={onToggle}>
            {track.title}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">
            {formatDuration(effectiveTrack.duration_seconds)}
          </Text>
        </Table.Td>
        <Table.Td>
          <TrackAudioUploader
            trackId={track.id}
            audioOriginalFileId={effectiveTrack.audio_original_file_id}
            inputId={idPrefix ? `${idPrefix}-track-audio-${track.id}` : undefined}
            processingStatus={resolveReleaseTrackProcessingStatus(effectiveTrack.processing_status)}
            audioAttached={effectiveTrack.audio_attached}
            activeUploadState={
              uploadProgress
                ? {
                    active: true,
                    progress: uploadProgress.progress,
                    stage: uploadProgress.stage ?? null,
                  }
                : null
            }
            pendingUploadFileId={effectiveTrack.pending_upload_file_id}
            pendingUploadAttemptId={effectiveTrack.pending_upload_attempt_id}
            pendingUploadStatus={effectiveTrack.pending_upload_status}
            pendingUploadStartedAt={effectiveTrack.pending_upload_started_at}
            processingActive={processingLifecycle != null}
            processingProgress={processingLifecycle?.progress}
            suppressedResumeIdentity={suppressedResumeIdentity}
            compact
            mode="status-only"
          />
        </Table.Td>
        <Table.Td>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <TrackAudioUploader
              trackId={track.id}
              audioOriginalFileId={effectiveTrack.audio_original_file_id}
              inputId={idPrefix ? `${idPrefix}-track-audio-upload-${track.id}` : undefined}
              processingStatus={resolveReleaseTrackProcessingStatus(effectiveTrack.processing_status)}
              audioAttached={effectiveTrack.audio_attached}
              pendingUploadFileId={effectiveTrack.pending_upload_file_id}
              pendingUploadAttemptId={effectiveTrack.pending_upload_attempt_id}
              pendingUploadStatus={effectiveTrack.pending_upload_status}
              pendingUploadStartedAt={effectiveTrack.pending_upload_started_at}
              processingActive={processingLifecycle != null}
              processingProgress={processingLifecycle?.progress}
              onUploadProgressChange={onUploadProgressChange}
              onPendingUploadCancelled={handlePendingUploadCancelled}
              suppressedResumeIdentity={suppressedResumeIdentity}
              resumeStateOverride={backendResumeState}
              compact
              mode="button-only"
            />
            <Tooltip label={tCommon('actions.delete')}>
              <IconButton
                tone="danger"
                emphasis="low"
                size="sm"
                onClick={onDelete}
                aria-label={tCommon('actions.delete')}
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
            <IconButton
              emphasis="low"
              size="sm"
              onClick={onToggle}
              aria-label={expanded ? tCommon('actions.close') : tCommon('actions.edit')}
            >
              <Box
                component="span"
                style={{
                  display: 'inline-flex',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              >
                <IconChevronDown size={14} />
              </Box>
            </IconButton>
          </Group>
        </Table.Td>
      </Table.Tr>
      {progressIndicator ? (
        <Table.Tr id={`release-track-progress-row-${track.id}`}>
          <Table.Td colSpan={5}>
            <Stack gap={6} py="xs">
              {resumeIndicator ? (
                <Text size="xs" c={resumeIndicator.color}>
                  {resumeIndicator.label}
                </Text>
              ) : (
                <>
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="xs" c={progressIndicator.color}>
                      {progressIndicator.label}
                    </Text>
                    {progressIndicator.progress != null ? (
                      <Text size="xs" c={progressIndicator.color}>
                        {progressIndicator.progress}%
                      </Text>
                    ) : null}
                  </Group>
                  <Progress
                    value={progressIndicator.progress ?? 0}
                    size="xs"
                    radius={0}
                    color={progressIndicator.color}
                  />
                </>
              )}
            </Stack>
          </Table.Td>
        </Table.Tr>
      ) : resumeIndicator ? (
        <Table.Tr id={`release-track-resume-row-${track.id}`}>
          <Table.Td colSpan={5}>
            <Stack gap={6} py="xs">
              <Text size="xs" c={resumeIndicator.color}>
                {resumeIndicator.label}
              </Text>
            </Stack>
          </Table.Td>
        </Table.Tr>
      ) : null}
      {shouldRenderEditor && cachedEditor ? (
        <Table.Tr>
          <Table.Td colSpan={5}>
            <Collapse expanded={collapseOpen} transitionDuration={220}>
              <Box py="sm">
                <TrackEditorSurface>{cachedEditor}</TrackEditorSurface>
              </Box>
            </Collapse>
          </Table.Td>
        </Table.Tr>
      ) : null}
    </>
  );
}

interface SortableTrackListItemProps extends SortableTrackRowProps {
  showDivider: boolean;
}

function SortableTrackListItem({
  idPrefix,
  track,
  expanded,
  onToggle,
  onDelete,
  onUploadProgressChange,
  uploadProgress,
  formatDuration,
  editor,
  showDivider,
}: SortableTrackListItemProps) {
  const tCommon = useTranslations('common');
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });
  const { shouldRenderEditor, collapseOpen, cachedEditor } = useAnimatedEditorVisibility(expanded, editor);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} py="sm">
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <Box {...attributes} {...listeners} style={{ cursor: 'grab', paddingTop: 2 }}>
          <IconGripVertical size={14} color="gray" />
        </Box>

        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} style={{ cursor: 'pointer' }} onClick={onToggle}>
                {track.title}
              </Text>
            </Stack>
            <Group gap={4} wrap="nowrap" align="center">
              <Text size="sm" c="dimmed">
                {formatDuration(effectiveTrack.duration_seconds)}
              </Text>
              <IconButton
                emphasis="low"
                size="sm"
                onClick={onToggle}
                aria-label={expanded ? tCommon('actions.close') : tCommon('actions.edit')}
              >
                <Box
                  component="span"
                  style={{
                    display: 'inline-flex',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 180ms ease',
                  }}
                >
                  <IconChevronDown size={14} />
                </Box>
              </IconButton>
            </Group>
          </Group>

          <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" c="dimmed">
                {tCommon('labels.status')}
              </Text>
              <TrackAudioUploader
                trackId={track.id}
                audioOriginalFileId={effectiveTrack.audio_original_file_id}
                inputId={idPrefix ? `${idPrefix}-track-audio-${track.id}` : undefined}
                processingStatus={resolveReleaseTrackProcessingStatus(effectiveTrack.processing_status)}
                audioAttached={effectiveTrack.audio_attached}
                activeUploadState={
                  uploadProgress
                    ? {
                        active: true,
                        progress: uploadProgress.progress,
                        stage: uploadProgress.stage ?? null,
                      }
                    : null
                }
                pendingUploadFileId={effectiveTrack.pending_upload_file_id}
                pendingUploadAttemptId={effectiveTrack.pending_upload_attempt_id}
                pendingUploadStatus={effectiveTrack.pending_upload_status}
                pendingUploadStartedAt={effectiveTrack.pending_upload_started_at}
                processingActive={processingLifecycle != null}
                processingProgress={processingLifecycle?.progress}
                suppressedResumeIdentity={suppressedResumeIdentity}
                compact
                mode="status-only"
              />
            </Group>
            <Group gap="xs" wrap="nowrap">
              <TrackAudioUploader
                trackId={track.id}
                audioOriginalFileId={effectiveTrack.audio_original_file_id}
                inputId={idPrefix ? `${idPrefix}-track-audio-upload-${track.id}` : undefined}
                processingStatus={resolveReleaseTrackProcessingStatus(effectiveTrack.processing_status)}
                audioAttached={effectiveTrack.audio_attached}
                pendingUploadFileId={effectiveTrack.pending_upload_file_id}
                pendingUploadAttemptId={effectiveTrack.pending_upload_attempt_id}
                pendingUploadStatus={effectiveTrack.pending_upload_status}
                pendingUploadStartedAt={effectiveTrack.pending_upload_started_at}
                processingActive={processingLifecycle != null}
                processingProgress={processingLifecycle?.progress}
                onUploadProgressChange={onUploadProgressChange}
                onPendingUploadCancelled={handlePendingUploadCancelled}
                suppressedResumeIdentity={suppressedResumeIdentity}
                resumeStateOverride={backendResumeState}
                compact
                mode="button-only"
              />
              <Tooltip label={tCommon('actions.delete')}>
                <IconButton
                  tone="danger"
                  emphasis="low"
                  size="sm"
                  onClick={onDelete}
                  aria-label={tCommon('actions.delete')}
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            </Group>
          </Group>
          {progressIndicator ? (
            <Stack gap={6} pt={2}>
              {resumeIndicator ? (
                <Text size="xs" c={resumeIndicator.color}>
                  {resumeIndicator.label}
                </Text>
              ) : (
                <>
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="xs" c={progressIndicator.color}>
                      {progressIndicator.label}
                    </Text>
                    {progressIndicator.progress != null ? (
                      <Text size="xs" c={progressIndicator.color}>
                        {progressIndicator.progress}%
                      </Text>
                    ) : null}
                  </Group>
                  <Progress
                    value={progressIndicator.progress ?? 0}
                    size="xs"
                    radius={0}
                    color={progressIndicator.color}
                  />
                </>
              )}
            </Stack>
          ) : resumeIndicator ? (
            <Stack gap={6} pt={2}>
              <Text size="xs" c={resumeIndicator.color}>
                {resumeIndicator.label}
              </Text>
            </Stack>
          ) : null}
          {shouldRenderEditor && cachedEditor ? (
            <Collapse expanded={collapseOpen} transitionDuration={220}>
              <Box pt="xs">
                <TrackEditorSurface>{cachedEditor}</TrackEditorSurface>
              </Box>
            </Collapse>
          ) : null}
        </Stack>
      </Group>
      {showDivider ? <Divider mt="sm" /> : null}
    </Box>
  );
}

interface TrackRowEditorPanelProps {
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
}

function TrackRowEditorPanel({
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
}: TrackRowEditorPanelProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks');
  const isMobile = useMediaQuery('(max-width: 48em)');

  return (
    <Stack gap="md">
      <Group align="flex-start" gap="sm" grow={isMobile} wrap={isMobile ? 'wrap' : 'nowrap'}>
        <TextInput
          id={idPrefix ? `${idPrefix}-edit-track-title-${track.id}` : undefined}
          label={tCommon('labels.title')}
          placeholder={t('placeholders.title')}
          value={title}
          onChange={(e) => onTitleChange(e.currentTarget.value)}
          required
          style={{ flex: 1, minWidth: isMobile ? '100%' : 0 }}
        />
        <TrackDurationPicker
          id={idPrefix ? `${idPrefix}-edit-track-duration-${track.id}` : undefined}
          value={durationSeconds}
          onChange={onDurationChange}
          style={{ width: isMobile ? '100%' : 180 }}
        />
      </Group>

      {track.audio_original_file_id ? (
        <ConnectedFileDownloadPolicyEditor
          entityType={TranscodeEntityType.TRACK}
          entityId={track.id}
          expectedFileId={track.audio_original_file_id}
          compact={false}
        />
      ) : null}

      <TrackCreditsEditorSection
        idPrefix={idPrefix}
        trackId={track.id}
        credits={track.credits}
        onCreditsChange={onCreditsChange}
      />

      <Group justify="flex-end">
        <Button emphasis="low" onClick={onClose}>
          {tCommon('actions.close')}
        </Button>
        <Button onClick={onSave} loading={isSaving} disabled={!title.trim()}>
          {tCommon('actions.save')}
        </Button>
      </Group>
    </Stack>
  );
}
