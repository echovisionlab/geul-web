'use client';

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
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { ImageCropper } from '@/components/core/ImageCropper';
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
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      onMediaChange(result.media ?? []);
      notifications.show({ message: tCommonNotifications('featuredImageUpdated'), color: 'green' });
    },
  });

  const reorderPosters = useMutation({
    mutationFn: (variables: { nextMedia: ProgramEventPosterMedia[]; previousMedia: ProgramEventPosterMedia[] }) =>
      reorderProgramEventPosterMediaAction(
        eventId,
        variables.nextMedia.map((item) => item.id),
      ),
    onSuccess: (result, variables) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        onMediaChange(variables.previousMedia);
        return;
      }
      onMediaChange(result.media ?? variables.nextMedia);
    },
    onError: (error, variables) => {
      onMediaChange(variables.previousMedia);
      notifications.show({
        message: error instanceof Error ? error.message : tProgramEventPoster('reorderFailed'),
        color: 'red',
      });
    },
  });

  const deletePoster = useMutation({
    mutationFn: (mediaId: string) => deleteProgramEventPosterAction(eventId, mediaId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      onMediaChange(result.media ?? []);
      notifications.show({
        message: tCommonNotifications('featuredImageRemoved'),
        color: 'yellow',
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
    reorderPosters.mutate({ nextMedia, previousMedia: sortedMedia });
  };

  const isMutating = addPoster.isPending || reorderPosters.isPending || deletePoster.isPending;

  return (
    <Stack gap="sm">
      {(sortedMedia.length > 0 || canEdit) && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedMedia.map((item) => item.id)} strategy={rectSortingStrategy}>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
              {sortedMedia.map((item) => (
                <SortablePosterCard
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  disabled={isMutating}
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
            </SimpleGrid>
          </SortableContext>
        </DndContext>
      )}
    </Stack>
  );
}

interface SortablePosterCardProps {
  item: ProgramEventPosterMedia;
  canEdit: boolean;
  disabled: boolean;
  labels: {
    drag: string;
    main: string;
    noPreview: string;
    remove: string;
  };
  onRemove: () => void;
}

function SortablePosterCard({ item, canEdit, disabled, labels, onRemove }: SortablePosterCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit || disabled,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    border: '1px solid var(--mantine-color-default-border)',
    borderRadius: 0,
    overflow: 'hidden',
    background: 'var(--mantine-color-body)',
    aspectRatio: POSTER_TILE_ASPECT_RATIO,
  };
  const handleProps =
    canEdit && !disabled
      ? {
          ...attributes,
          ...listeners,
          role: 'button',
          tabIndex: 0,
          'aria-label': labels.drag,
        }
      : {};

  return (
    <Box ref={setNodeRef} style={style}>
      <Box
        {...handleProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          cursor: canEdit && !disabled ? (isDragging ? 'grabbing' : 'grab') : 'default',
          outline: 'none',
          overflow: 'hidden',
        }}
      >
        {item.url ? (
          <Box
            component="img"
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
          <Group h="100%" justify="center">
            <Text size="xs" c="dimmed">
              {labels.noPreview}
            </Text>
          </Group>
        )}
      </Box>
      {item.isPrimary && (
        <Box
          pos="absolute"
          top={0}
          left={0}
          px="xs"
          h={32}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--mantine-color-teal-7)',
            color: 'var(--mantine-color-white)',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          <Text inherit component="span">
            {labels.main}
          </Text>
        </Box>
      )}
      {canEdit && (
        <Box pos="absolute" top={0} right={0}>
          <Tooltip label={labels.remove}>
            <IconButton
              size="sm"
              tone="danger"
              emphasis="strong"
              aria-label={labels.remove}
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
        </Box>
      )}
    </Box>
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
  const tCommon = useTranslations('common');
  const inputMaxSize = getUploadSelectionMaxSize(UploadType.PROGRAM_EVENT_POSTER, 'image/jpeg', posterConfig.maxSize);
  const { tempImageSrc, cropModalOpened, handleFileDrop, handleCropComplete, handleCropCancel } = useImageUploadCrop({
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

    notifications.show({ message, color: 'red' });
  };

  const isPreparingImage = isUploading && uploadProgress <= 0;
  const uploadStatusLabel = isPreparingImage
    ? tCommon('uploadField.status.preparingImage')
    : tCommon('uploadField.status.uploading');

  return (
    <Box>
      <Tooltip label={label}>
        <Box>
          <ImageUploadField
            imageUrl={null}
            alt={label}
            inputId={idPrefix ? `${idPrefix}-add-file-input` : undefined}
            dropzoneId={idPrefix ? `${idPrefix}-add-dropzone` : undefined}
            accept={getUploadSelectionMimeTypes(UploadType.PROGRAM_EVENT_POSTER)}
            maxSize={inputMaxSize}
            canEdit
            disabled={disabled || isUploading}
            loading={isUploading}
            loadingLabel={uploadStatusLabel}
            progress={isPreparingImage ? undefined : uploadProgress}
            emptyTitle={label}
            emptyDescription={undefined}
            preview={{
              mode: 'fixed',
              width: '100%',
              aspectRatio: POSTER_TILE_ASPECT_RATIO,
              fit: 'cover',
              radius: 0,
            }}
            placeholder={{
              width: '100%',
              aspectRatio: POSTER_TILE_ASPECT_RATIO,
              icon: <IconPlus size={30} stroke={1.7} />,
              compact: true,
              iconSize: 30,
            }}
            onFileSelect={(file) => handleFileDrop([file])}
            onValidationReject={handleReject}
          />
        </Box>
      </Tooltip>

      {tempImageSrc && (
        <ImageCropper
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
    </Box>
  );
}
