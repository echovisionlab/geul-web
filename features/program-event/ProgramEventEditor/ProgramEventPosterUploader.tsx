'use client';
import { SectionCard } from '@/components/core/Section';

import { LabelBadge } from '@/components/core/Badge';

import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
} from '@/components/core/Layout';

import { Text as DsText } from '@/components/core/Typography';
import { useMemo, type CSSProperties } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { SortableSurface, useSortableItem } from '@/components/core/Sortable';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { IconButton } from '@/components/core/IconButton';
import { ImageCropper } from '@/components/core/ImageCropper';
import { useImageCropAccessibility } from '@/lib/i18n/useImageCropAccessibility';
import { ImageUploadField, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { Tooltip } from '@/components/core/Tooltip';
import { useImageUploadCrop } from '@/features/upload/ImageUploadCropController';
import { useImageAssetUpload } from '@/features/upload/useImageAssetUpload';
import {
  addProgramEventPosterAction,
  deleteProgramEventPosterAction,
  reorderProgramEventPosterMediaAction,
} from '@/lib/actions/program-event';
import type { ProgramEventPosterMedia } from '@/lib/collab/program-event-meta';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { formatFileSize } from '@/lib/utils/upload';
import { getUploadSelectionMaxSize } from '@/lib/utils/upload-policy';

const posterConfig = UPLOAD_CONFIGS[UploadType.PROGRAM_EVENT_POSTER];
const POSTER_TILE_ASPECT_RATIO = '2 / 3';

interface ProgramEventPosterUploaderProps {
  eventId: string;
  media: ProgramEventPosterMedia[];
  idPrefix?: string;
  canEdit: boolean;
  onMediaChange: (media: ProgramEventPosterMedia[]) => void;
}

function sortPosterMedia(media: ProgramEventPosterMedia[]) {
  return [...media].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.id.localeCompare(b.id);
  });
}

export function ProgramEventPosterUploader({
  eventId,
  media,
  idPrefix,
  canEdit,
  onMediaChange,
}: ProgramEventPosterUploaderProps) {
  const tCommonNotifications = useTranslations('common.notifications');
  const tCommonActions = useTranslations('common.actions');
  const tProgramEventPoster = useTranslations('programEventAdmin.poster');
  const sortedMedia = useMemo(() => sortPosterMedia(media), [media]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addPoster = useMutation({
    mutationFn: (fileId: string) => addProgramEventPosterAction(eventId, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      onMediaChange(result.media ?? []);
      notifications.show({ message: tCommonNotifications('featuredImageUpdated'), tone: 'positive' });
    },
  });

  const reorderPosters = useMutation({
    mutationFn: (variables: {
      nextMedia: ProgramEventPosterMedia[];
      previousMedia: ProgramEventPosterMedia[];
      movedId: string;
    }) =>
      reorderProgramEventPosterMediaAction(
        eventId,
        variables.nextMedia.map((item) => item.id),
      ),
    onSuccess: (result, variables) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        onMediaChange(variables.previousMedia);
        return;
      }
      onMediaChange(result.media ?? variables.nextMedia);
    },
    onError: (error, variables) => {
      onMediaChange(variables.previousMedia);
      notifications.show({
        message: error instanceof Error ? error.message : tProgramEventPoster('reorderFailed'),
        tone: 'danger',
      });
    },
  });

  const deletePoster = useMutation({
    mutationFn: (mediaId: string) => deleteProgramEventPosterAction(eventId, mediaId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      onMediaChange(result.media ?? []);
      notifications.show({
        message: tCommonNotifications('featuredImageRemoved'),
        tone: 'positive',
      });
    },
  });

  const { handleUpload, isUploading, uploadProgress } = useImageAssetUpload({
    uploadType: UploadType.PROGRAM_EVENT_POSTER,
    entityId: eventId,
    fileName: () => `poster-${Date.now()}`,
    onUploaded: addPoster.mutateAsync,
    uploadFailedMessage: tCommonNotifications('uploadFailed'),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit || isMutating || isUploading) {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = sortedMedia.findIndex((item) => item.id === active.id);
    const newIndex = sortedMedia.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const nextMedia = arrayMove(sortedMedia, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sortOrder: index,
      isPrimary: index === 0,
    }));
    onMediaChange(nextMedia);
    reorderPosters.mutate({ nextMedia, previousMedia: sortedMedia, movedId: String(active.id) });
  };

  const isMutating = addPoster.isPending || reorderPosters.isPending || deletePoster.isPending;

  return (
    <DsLayoutStack gap="sm">
      {(sortedMedia.length > 0 || canEdit) && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedMedia.map((item) => item.id)} strategy={rectSortingStrategy}>
            <DsLayoutGrid columns={{ base: 2, sm: 3 }} gap="xs">
              {sortedMedia.map((item) => (
                <SortablePosterCard
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  disabled={isMutating || isUploading}
                  reordering={reorderPosters.isPending && reorderPosters.variables?.movedId === item.id}
                  removing={deletePoster.isPending && deletePoster.variables === item.id}
                  onRemove={() => deletePoster.mutate(item.id)}
                  labels={{
                    drag: tProgramEventPoster('drag'),
                    main: tProgramEventPoster('main'),
                    noPreview: tProgramEventPoster('noPreview'),
                    remove: tProgramEventPoster('remove'),
                  }}
                />
              ))}
              {canEdit ? (
                <PosterAddTile
                  idPrefix={idPrefix}
                  disabled={isMutating}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  onUpload={handleUpload}
                  label={tCommonActions('add')}
                />
              ) : null}
            </DsLayoutGrid>
          </SortableContext>
        </DndContext>
      )}
    </DsLayoutStack>
  );
}

interface SortablePosterCardProps {
  item: ProgramEventPosterMedia;
  canEdit: boolean;
  disabled: boolean;
  removing?: boolean;
  reordering?: boolean;
  labels: {
    drag: string;
    main: string;
    noPreview: string;
    remove: string;
  };
  onRemove: () => void;
}

export function SortablePosterCard({
  item,
  canEdit,
  disabled,
  removing = false,
  reordering = false,
  labels,
  onRemove,
}: SortablePosterCardProps) {
  const sortable = useSortableItem({
    id: item.id,
    disabled: !canEdit || disabled,
  });
  const style: CSSProperties = {
    position: 'relative',

    overflow: 'hidden',

    aspectRatio: POSTER_TILE_ASPECT_RATIO,
  };

  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <div style={style}>
        <SectionCard padding="none" withBorder clip stretch state={sortable.isDragging ? 'dragging' : 'default'}>
          <div
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <DsLayoutInline align="center" justify="center" fill="both">
              {item.url ? (
                <img
                  src={item.url}
                  alt={item.alt ?? ''}
                  draggable={false}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              ) : (
                <DsLayoutInline fill="block" justify="center">
                  <DsText size="xs" tone="secondary">
                    {labels.noPreview}
                  </DsText>
                </DsLayoutInline>
              )}
            </DsLayoutInline>
          </div>
          {item.isPrimary && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, pointerEvents: 'none' }}>
              <LabelBadge tone="accent" appearance="solid">
                {labels.main}
              </LabelBadge>
            </div>
          )}
          {canEdit && (
            <IconButton
              placement="overlay-start-inside"
              contrast="inverse"
              emphasis="medium"
              interaction="drag-handle"
              draggable={false}
              {...sortable.handle}
              loading={reordering}
              aria-label={labels.drag}
              disabled={disabled}
            >
              <IconGripVertical aria-hidden />
            </IconButton>
          )}
          {canEdit && (
            <Tooltip label={labels.remove}>
              <IconButton
                size="compact"
                placement="overlay-end-inside"
                contrast="inverse"
                tone="danger"
                emphasis="medium"
                aria-label={labels.remove}
                loading={removing}
                disabled={disabled}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <IconTrash size={16} />
              </IconButton>
            </Tooltip>
          )}
        </SectionCard>
      </div>
    </SortableSurface>
  );
}

interface PosterAddTileProps {
  idPrefix?: string;
  disabled: boolean;
  isUploading: boolean;
  uploadProgress: number;
  onUpload: (blob: Blob) => void;
  label: string;
}

function PosterAddTile({ idPrefix, disabled, isUploading, uploadProgress, onUpload, label }: PosterAddTileProps) {
  const tFeaturedImage = useTranslations('featuredImage');
  const cropAccessibility = useImageCropAccessibility(tFeaturedImage('cropTitle'));
  const tCommon = useTranslations('common');
  const inputMaxSize = getUploadSelectionMaxSize(UploadType.PROGRAM_EVENT_POSTER, 'image/jpeg', posterConfig.maxSize);
  const { tempImageSrc, cropModalOpened, handleFileDrop, handleCropComplete, handleCropCancel, isPreparing } =
    useImageUploadCrop({
      onUpload,
      uploadType: UploadType.PROGRAM_EVENT_POSTER,
    });

  const handleReject = (rejections: ImageUploadRejection[]) => {
    const rejection = rejections[0];
    let message = tFeaturedImage('errors.fileRejected');

    if (rejection?.reason === 'too-large') {
      message = tFeaturedImage('errors.fileTooLarge', { maxSize: formatFileSize(inputMaxSize) });
    } else if (rejection?.reason === 'invalid-type') {
      message = tFeaturedImage('errors.invalidFileType');
    }

    notifications.show({ message, tone: 'danger' });
  };

  const isPreparingImage = isPreparing || (isUploading && uploadProgress <= 0);
  const uploadStatusLabel = isPreparingImage
    ? tCommon('uploadField.status.preparingImage')
    : tCommon('uploadField.status.uploading');

  return (
    <div>
      <Tooltip label={label}>
        <div>
          <ImageUploadField
            imageUrl={null}
            alt={label}
            inputId={idPrefix ? `${idPrefix}-add-file-input` : undefined}
            dropzoneId={idPrefix ? `${idPrefix}-add-dropzone` : undefined}
            accept={getUploadSelectionMimeTypes(UploadType.PROGRAM_EVENT_POSTER)}
            maxSize={inputMaxSize}
            canEdit
            disabled={disabled || isUploading || isPreparing}
            loading={isUploading || isPreparing}
            loadingLabel={uploadStatusLabel}
            progress={isPreparingImage ? undefined : uploadProgress}
            emptyTitle={label}
            emptyDescription={undefined}
            preview={{
              mode: 'fixed',
              width: '100%',
              aspectRatio: POSTER_TILE_ASPECT_RATIO,
              fit: 'cover',
            }}
            placeholder={{
              width: '100%',
              aspectRatio: POSTER_TILE_ASPECT_RATIO,
              icon: <IconPlus size={30} stroke={1.7} />,
              compact: true,
              iconSize: 'md',
            }}
            onFileSelect={(file) => handleFileDrop([file])}
            onValidationReject={handleReject}
          />
        </div>
      </Tooltip>

      {tempImageSrc && (
        <ImageCropper
          cropAccessibility={cropAccessibility}
          imageSrc={tempImageSrc}
          opened={cropModalOpened}
          onClose={handleCropCancel}
          onCrop={handleCropComplete}
          title={tFeaturedImage('cropTitle')}
          labels={{
            previewAlt: label,
            cancel: tCommon('actions.cancel'),
            confirm: tCommon('actions.confirm'),
          }}
          aspectRatio="free"
          processingLabel={tCommon('uploadField.status.preparingImage')}
        />
      )}
    </div>
  );
}
