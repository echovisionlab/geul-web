'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useGenreModal, type GenreModalTarget } from './GenreModalContext';

interface GenreRowMenuProps {
  genre: GenreModalTarget;
}

export function GenreRowMenu({ genre }: GenreRowMenuProps) {
  const { openEdit, openDelete } = useGenreModal();
  return <EntityRowMenu entity={genre} label={genre.name} onEdit={openEdit} onDelete={openDelete} />;
}
