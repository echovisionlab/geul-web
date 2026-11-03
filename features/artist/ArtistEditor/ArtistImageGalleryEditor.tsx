'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { MediaImage } from '@/components/core/MediaImage';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconArrowRight, IconStar, IconTrash } from '@tabler/icons-react';

import { notifications } from '@/components/core/Notification';
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
  const pendingRef = useRef(false);
  const requestRef = useRef(0);
  const targetRef = useRef(artistId);
  targetRef.current = artistId;
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const incoming = useRef({ initialImages, initialRevision });
  incoming.current = { initialImages, initialRevision };
  const observedRevisions = useRef(new Set([initialRevision]));
  const deferredSnapshot = useRef<typeof incoming.current | null>(null);

  useEffect(() => {
    requestRef.current++;
    pendingRef.current = false;
    setSaving(false);
    setPendingAction(null);
    const snapshot = incoming.current;
    observedRevisions.current = new Set([snapshot.initialRevision]);
    deferredSnapshot.current = null;
    setImages(snapshot.initialImages);
    setRevision(snapshot.initialRevision);
    return () => {
      requestRef.current++;
    };
  }, [artistId]);

  useEffect(() => {
    if (observedRevisions.current.has(initialRevision)) {
      return;
    }
    observedRevisions.current.add(initialRevision);
    if (pendingRef.current) {
      deferredSnapshot.current = { initialImages, initialRevision };
    } else {
      setImages(initialImages);
      setRevision(initialRevision);
    }
  }, [artistId, initialImages, initialRevision]);

  const persist = async (fileIds: string[], action?: string) => {
    if (pendingRef.current) {
      throw new Error(labels.updateFailed);
    }
    pendingRef.current = true;
    const request = ++requestRef.current;
    const isCurrent = () => requestRef.current === request && targetRef.current === artistId;
    let succeeded = false;
    setPendingAction(action ?? null);
    setSaving(true);
    try {
      const result = await setArtistImagesAction(artistId, fileIds, revision);
      if (!isCurrent()) {
        return;
      }
      if (!result.data) {
        const message = result.error ?? labels.updateFailed;
        throw new Error(message);
      }
      setImages(result.data.images);
      setRevision(result.data.revision);
      observedRevisions.current.add(result.data.revision);
      succeeded = true;
    } catch (error) {
      if (isCurrent()) {
        notifications.show({ message: error instanceof Error ? error.message : labels.updateFailed, tone: 'danger' });
      }
      throw error;
    } finally {
      if (isCurrent()) {
        const snapshot = deferredSnapshot.current;
        deferredSnapshot.current = null;
        if (!succeeded && snapshot) {
          setImages(snapshot.initialImages);
          setRevision(snapshot.initialRevision);
        }
        pendingRef.current = false;
        setSaving(false);
        setPendingAction(null);
      }
    }
  };

  const currentFileIds = images.map((image) => image.fileId);
  const primary = images[0] ?? null;

  return (
    <DsLayoutStack gap="sm" aria-busy={saving}>
      <AuthoringExtension kind="uploads">
        <ArtistImageUploader
          artistId={artistId}
          disabled={saving}
          currentImage={primary?.url}
          artistName={artistName}
          inputId={inputId}
          size={100}
          label={labels.image}
          onFileUploaded={({ fileId }) => persist([fileId, ...currentFileIds.filter((id) => id !== fileId)])}
          onDeleteRequested={() => persist(currentFileIds.slice(1))}
        />
      </AuthoringExtension>

      <ArtistImageGalleryView
        images={images}
        saving={saving}
        pendingAction={pendingAction}
        labels={labels}
        onMakePrimary={(fileId) =>
          persist([fileId, ...currentFileIds.filter((id) => id !== fileId)], `primary:${fileId}`).catch(() => undefined)
        }
        onMove={(from, to) => persist(moveItem(currentFileIds, from, to), `move:${from}:${to}`).catch(() => undefined)}
        onRemove={(fileId) =>
          persist(
            currentFileIds.filter((id) => id !== fileId),
            `remove:${fileId}`,
          ).catch(() => undefined)
        }
      />
    </DsLayoutStack>
  );
}

export function ArtistImageGalleryView({
  images,
  saving,
  pendingAction,
  labels,
  onMakePrimary,
  onMove,
  onRemove,
}: {
  images: ArtistGalleryImage[];
  saving: boolean;
  pendingAction?: string | null;
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
    <DsLayoutStack gap="xs">
      <DsText size="sm" weight="medium">
        {labels.gallery}
      </DsText>
      <DsLayoutInline gap="sm" align="start">
        {images.map((image, index) => (
          <DsLayoutStack
            key={image.fileId}
            gap="xxs"
            align="center"
            role="group"
            aria-label={`${labels.gallery} ${index + 1}`}
          >
            <MediaImage
              src={image.url}
              alt=""
              width={72}
              height={72}
              fit="cover"
              fallbackSrc="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
            />
            <DsLayoutInline gap="xxs" wrap="nowrap">
              {index > 0 ? (
                <Tooltip label={labels.makePrimary}>
                  <IconButton
                    aria-label={labels.makePrimary}
                    size="sm"
                    loading={pendingAction === `primary:${image.fileId}`}
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
                  loading={pendingAction === `move:${index}:${index - 1}`}
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
                  loading={pendingAction === `move:${index}:${index + 1}`}
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
                  loading={pendingAction === `remove:${image.fileId}`}
                  disabled={saving}
                  onClick={() => onRemove(image.fileId)}
                >
                  <IconTrash size={15} />
                </IconButton>
              </Tooltip>
            </DsLayoutInline>
          </DsLayoutStack>
        ))}
      </DsLayoutInline>
    </DsLayoutStack>
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
