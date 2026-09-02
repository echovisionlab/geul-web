'use client';

import { useRouter } from 'next/navigation';
import { ArtistDeleteDialog } from '@/features/artist/ArtistDeleteDialog';
import { useArtistModal } from './ArtistModalContext';

export function ArtistModals() {
  const router = useRouter();
  const { deletingArtist, closeDelete } = useArtistModal();

  return (
    <ArtistDeleteDialog
      artist={deletingArtist}
      onClose={closeDelete}
      onDeleted={() => {
        closeDelete();
        router.refresh();
      }}
    />
  );
}
