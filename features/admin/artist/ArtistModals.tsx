'use client';

import type { ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { ArtistDeleteDialog } from '@/features/artist/ArtistDeleteDialog';
import { useArtistModal } from './ArtistModalContext';

interface ArtistModalsProps {
  previewAction?: ComponentProps<typeof ArtistDeleteDialog>['previewAction'];
  deleteAction?: ComponentProps<typeof ArtistDeleteDialog>['deleteAction'];
  onDeleted?: () => void;
}
export function ArtistModals({ previewAction, deleteAction, onDeleted }: ArtistModalsProps = {}) {
  const router = useRouter();
  const { deletingArtist, closeDelete } = useArtistModal();

  return (
    <ArtistDeleteDialog
      artist={deletingArtist}
      previewAction={previewAction}
      deleteAction={deleteAction}
      onClose={closeDelete}
      onDeleted={() => {
        closeDelete();
        if (onDeleted) {
          onDeleted();
        } else {
          router.refresh();
        }
      }}
    />
  );
}
