'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { Textarea } from '@/components/core/Input';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { SectionCard } from '@/components/core/Section';
import { UrlSection } from '@/features/metadata/UrlSection';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { useImageAssetUpload } from '@/features/upload/useImageAssetUpload';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import {
  deleteProgramEventSeriesAction,
  removeProgramEventSeriesPosterAction,
  setProgramEventSeriesPosterAction,
  updateProgramEventSeriesAction,
} from '@/lib/actions/program-event';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { sanitizeSlugInput, toSlugInputValue } from '@/lib/utils/slug';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { requireActionSuccess } from '@/lib/editor/require-action-success';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';

const posterConfig = UPLOAD_CONFIGS[UploadType.PROGRAM_EVENT_POSTER];

type SeriesStatus = 'draft' | 'published';

interface ProgramEventSeriesEditorProps {
  seriesId: string;
  initialTitle: string;
  initialSlug: string;
  initialSummary: string | null;
  initialDescription: string | null;
  initialStatus: SeriesStatus;
  initialPosterUrl: string | null;
  canonicalOrigin: string;
  siteName: string;
  baseUrl: string;
}

function useProgramEventSeriesEditorViewModel({
  seriesId,
  initialTitle,
  initialSlug,
  initialSummary,
  initialDescription,
  initialStatus,
  initialPosterUrl,
  canonicalOrigin,
  siteName,
  baseUrl,
}: ProgramEventSeriesEditorProps) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [summary, setSummary] = useState(initialSummary ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [status, setStatus] = useState<SeriesStatus>(initialStatus);
  const [posterUrl, setPosterUrl] = useState(initialPosterUrl);
  const statusRequestIdRef = useRef(0);

  const updateSeries = useMutation({
    mutationFn: (data: Parameters<typeof updateProgramEventSeriesAction>[1]) =>
      updateProgramEventSeriesAction(seriesId, data),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
        tone: 'danger',
      });
    },
  });
  const updateSeriesStatus = useMutation({
    mutationFn: (input: { nextStatus: SeriesStatus; previousStatus: SeriesStatus; requestId: number }) =>
      updateProgramEventSeriesAction(seriesId, {
        status: input.nextStatus,
      }),
    onSuccess: (result, input) => {
      if ('error' in result && result.error) {
        if (statusRequestIdRef.current === input.requestId) {
          setStatus(input.previousStatus);
        }
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
    onError: (error, input) => {
      if (statusRequestIdRef.current === input.requestId) {
        setStatus(input.previousStatus);
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('saveFailed'),
        tone: 'danger',
      });
    },
  });
  const deleteSeries = useMutation({
    mutationFn: () => deleteProgramEventSeriesAction(seriesId),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      router.push('/admin/event-series');
    },
  });
  const setPoster = useMutation({
    mutationFn: (fileId: string) => setProgramEventSeriesPosterAction(seriesId, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setPosterUrl(result.imageUrl ?? null);
      notifications.show({ message: tCommonNotifications('featuredImageUpdated'), tone: 'positive' });
    },
  });
  const removePoster = useMutation({
    mutationFn: () => removeProgramEventSeriesPosterAction(seriesId),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setPosterUrl(null);
      notifications.show({
        message: tCommonNotifications('featuredImageRemoved'),
        tone: 'positive',
      });
    },
  });

  const debouncedUpdate = useDebouncedPatch({
    write: (data: Parameters<typeof updateProgramEventSeriesAction>[1]) =>
      requireActionSuccess(updateSeries.mutateAsync(data)),
    delay: 500,
    scope: seriesId,
    document: `program_event_series:${seriesId}`,
  });
  const flushPendingSaves = useCallback(
    () => flushEditorSavesOrNotify(`program_event_series:${seriesId}`, tCommonNotifications('saveFailed')),
    [seriesId, tCommonNotifications],
  );
  const handleBack = useCallback(async () => {
    if (await flushPendingSaves()) {
      router.push('/admin/event-series');
    }
  }, [flushPendingSaves, router]);
  const handleStatusChange = useCallback(
    async (nextStatus: SeriesStatus) => {
      if (nextStatus === status || !(await flushPendingSaves())) {
        return;
      }
      const previousStatus = status;
      const requestId = statusRequestIdRef.current + 1;
      statusRequestIdRef.current = requestId;
      setStatus(nextStatus);
      updateSeriesStatus.mutate({ nextStatus, previousStatus, requestId });
    },
    [flushPendingSaves, status, updateSeriesStatus.mutate],
  );
  const handleDelete = useCallback(async () => {
    if (await flushPendingSaves()) {
      deleteSeries.mutate();
    }
  }, [deleteSeries.mutate, flushPendingSaves]);

  const statusOptions: StatusOption<SeriesStatus>[] = [
    {
      value: 'draft',
      label: tCommon('statuses.draft'),
      actionLabel: tCommon('actions.unpublish'),
      tone: 'neutral',
    },
    {
      value: 'published',
      label: tCommon('statuses.published'),
      actionLabel: tCommon('actions.publish'),
      tone: 'positive',
    },
  ];

  const { handleUpload, isUploading, uploadProgress } = useImageAssetUpload({
    uploadType: UploadType.PROGRAM_EVENT_POSTER,
    entityId: seriesId,
    fileName: 'featured',
    onUploaded: setPoster.mutateAsync,
    uploadFailedMessage: tCommonNotifications('uploadFailed'),
  });

  const routePath = `/event-series/${slug || seriesId}`;

  return {
    title,
    setTitle,
    debouncedUpdate: (patch: Parameters<typeof debouncedUpdate>[0]) => debouncedUpdate(patch),
    tCommon,
    status,
    statusOptions,
    handleBack,
    handleStatusChange,
    handleDelete,
    updateSeriesStatus: { isPending: updateSeriesStatus.isPending },
    deleteSeries: { isPending: deleteSeries.isPending },
    posterUrl,
    isUploading,
    uploadProgress,
    removePoster: { isPending: removePoster.isPending, mutate: removePoster.mutate },
    handleUpload,
    tCommonEntities,
    summary,
    routePath,
    canonicalOrigin,
    siteName,
    baseUrl,
    seriesId,
    slug,
    setSlug,
    updateSeries: { mutate: updateSeries.mutate },
    setSummary,
    description,
    setDescription,
  };
}

export function ProgramEventSeriesEditor(props: ProgramEventSeriesEditorProps) {
  return <ProgramEventSeriesEditorView model={useProgramEventSeriesEditorViewModel(props)} />;
}

export type ProgramEventSeriesEditorViewModel = ReturnType<typeof useProgramEventSeriesEditorViewModel>;

/** Complete production editor composition; controllers supply data and commands. */
export function ProgramEventSeriesEditorView({ model }: { model: ProgramEventSeriesEditorViewModel }) {
  const {
    title,
    setTitle,
    debouncedUpdate,
    tCommon,
    status,
    statusOptions,
    handleBack,
    handleStatusChange,
    handleDelete,
    updateSeriesStatus,
    deleteSeries,
    posterUrl,
    isUploading,
    uploadProgress,
    removePoster,
    handleUpload,
    tCommonEntities,
    summary,
    routePath,
    canonicalOrigin,
    siteName,
    baseUrl,
    seriesId,
    slug,
    setSlug,
    updateSeries,
    setSummary,
    description,
    setDescription,
  } = model;
  return (
    <DsLayoutStack gap="md">
      <EditorHeader
        title={title}
        onTitleChange={(value) => {
          setTitle(value);
          debouncedUpdate({ title: value });
        }}
        titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.programEventSeries') })}
        status={status}
        statusOptions={statusOptions}
        isConnected
        isSynced
        onBack={handleBack}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        deleteConfirmation={{
          title: tCommon('actions.delete'),
          message: (
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: title || tCommon('states.untitled'),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
          ),
        }}
        isStatusChanging={updateSeriesStatus.isPending}
        isDeleting={deleteSeries.isPending}
        backTooltip={tCommon('actions.back')}
      />

      <MediaPreviewGrid>
        <ImageUploadCropController
          imageUrl={posterUrl}
          canEdit
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          isRemoving={removePoster.isPending}
          onUpload={handleUpload}
          onRemove={() => removePoster.mutate()}
          aspectRatio="free"
          label={tCommonEntities('programEventSeries')}
          acceptMimeTypes={getUploadSelectionMimeTypes(UploadType.PROGRAM_EVENT_POSTER)}
          maxSize={posterConfig.maxSize}
        />
        <MetadataPanel
          title={title}
          summary={summary}
          routePath={routePath}
          canonicalOrigin={canonicalOrigin}
          siteName={siteName}
          defaultImageUrl={posterUrl}
          defaultSchemaType="EventSeries"
        />
      </MediaPreviewGrid>

      <UrlSection
        baseUrl={baseUrl}
        entityType="program_event_series"
        entityId={seriesId}
        slug={toSlugInputValue(slug)}
        onChange={(value) => setSlug(sanitizeSlugInput(value))}
        onBlur={() => updateSeries.mutate({ slug })}
      />

      <SectionCard>
        <DsLayoutStack gap="md">
          <Textarea
            label={tCommon('labels.summary')}
            value={summary}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSummary(value);
              debouncedUpdate({ summary: value });
            }}
            autosize
            minRows={3}
          />
          <Textarea
            label={tCommon('labels.description')}
            value={description}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDescription(value);
              debouncedUpdate({ description: value });
            }}
            autosize
            minRows={6}
          />
        </DsLayoutStack>
      </SectionCard>
    </DsLayoutStack>
  );
}
