'use client';

import { useEffect, useState } from 'react';
import { IconArrowLeft, IconArrowRight, IconStar, IconTrash } from '@tabler/icons-react';
import { Group, Image, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { ArtistImageUploader } from '@/features/artist/ArtistImageUploader';
import { setArtistImagesAction } from '@/lib/actions/artist';

export interface ArtistGalleryImage {
  fileId: string;
  url: string | null;
  sortOrder: number;
  primary: boolean;
}

interface ArtistImageGalleryEditorProps {
  artistId: string;
  artistName: string;
  initialImages: ArtistGalleryImage[];
  initialRevision: string;
  inputId: string;
  labels: {
    image: string;
    gallery: string;
    makePrimary: string;
    moveEarlier: string;
    moveLater: string;
    remove: string;
    updateFailed: string;
  };
}

export function ArtistImageGalleryEditor({
  artistId,
  artistName,
  initialImages,
  initialRevision,
  inputId,
  labels,
}: ArtistImageGalleryEditorProps) {
  const [images, setImages] = useState(initialImages);
  const [revision, setRevision] = useState(initialRevision);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setImages(initialImages);
    setRevision(initialRevision);
  }, [initialImages, initialRevision]);

  const persist = async (fileIds: string[]) => {
    setSaving(true);
    try {
      const result = await setArtistImagesAction(artistId, fileIds, revision);
      if (!result.data) {
        const message = result.error ?? labels.updateFailed;
        notifications.show({ message, color: 'red' });
        throw new Error(message);
      }
      setImages(result.data.images);
      setRevision(result.data.revision);
    } finally {
      setSaving(false);
    }
  };

  const currentFileIds = images.map((image) => image.fileId);
  const primary = images[0] ?? null;

  return (
    <Stack gap="sm" aria-busy={saving}>
      <ArtistImageUploader
        artistId={artistId}
        currentImage={primary?.url}
        artistName={artistName}
        inputId={inputId}
        size={100}
        label={labels.image}
        onFileUploaded={({ fileId }) => persist([fileId, ...currentFileIds.filter((id) => id !== fileId)])}
        onDeleteRequested={() => persist(currentFileIds.slice(1))}
      />

      <ArtistImageGalleryView
        images={images}
        saving={saving}
        labels={labels}
        onMakePrimary={(fileId) => persist([fileId, ...currentFileIds.filter((id) => id !== fileId)])}
        onMove={(from, to) => persist(moveItem(currentFileIds, from, to))}
        onRemove={(fileId) => persist(currentFileIds.filter((id) => id !== fileId))}
      />
    </Stack>
  );
}

export function ArtistImageGalleryView({
  images,
  saving,
  labels,
  onMakePrimary,
  onMove,
  onRemove,
}: {
  images: ArtistGalleryImage[];
  saving: boolean;
  labels: Pick<
    ArtistImageGalleryEditorProps['labels'],
    'gallery' | 'makePrimary' | 'moveEarlier' | 'moveLater' | 'remove'
  >;
  onMakePrimary: (fileId: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (fileId: string) => void;
}) {
  if (images.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {labels.gallery}
      </Text>
      <Group gap="sm" align="flex-start">
        {images.map((image, index) => (
          <Stack key={image.fileId} gap={4} align="center">
            <Image
              src={image.url}
              alt=""
              w={72}
              h={72}
              fit="cover"
              fallbackSrc="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
            />
            <Group gap={2} wrap="nowrap">
              {index > 0 ? (
                <Tooltip label={labels.makePrimary}>
                  <IconButton
                    aria-label={labels.makePrimary}
                    size="sm"
                    disabled={saving}
                    onClick={() => onMakePrimary(image.fileId)}
                  >
                    <IconStar size={15} />
                  </IconButton>
                </Tooltip>
              ) : null}
              <Tooltip label={labels.moveEarlier}>
                <IconButton
                  aria-label={labels.moveEarlier}
                  size="sm"
                  disabled={saving || index === 0}
                  onClick={() => onMove(index, index - 1)}
                >
                  <IconArrowLeft size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label={labels.moveLater}>
                <IconButton
                  aria-label={labels.moveLater}
                  size="sm"
                  disabled={saving || index === images.length - 1}
                  onClick={() => onMove(index, index + 1)}
                >
                  <IconArrowRight size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label={labels.remove}>
                <IconButton
                  aria-label={labels.remove}
                  tone="danger"
                  size="sm"
                  disabled={saving}
                  onClick={() => onRemove(image.fileId)}
                >
                  <IconTrash size={15} />
                </IconButton>
              </Tooltip>
            </Group>
          </Stack>
        ))}
      </Group>
    </Stack>
  );
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
