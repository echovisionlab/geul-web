'use client';

import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu } from '@/components/core/DataTable';
import { useArtistModal, type ArtistModalTarget } from './ArtistModalContext';

interface ArtistRowMenuProps {
  artist: ArtistModalTarget;
}

export function ArtistRowMenu({ artist }: ArtistRowMenuProps) {
  const tCommon = useTranslations('common.actions');
  const tDataTable = useTranslations('dataTable.aria');
  const { openDelete } = useArtistModal();

  return (
    <TableRowMenu
      aria-label={tDataTable('rowActions', { label: artist.name || 'artist' })}
      items={[
        {
          label: tCommon('edit'),
          icon: <IconEdit size={16} />,
          href: `/artists/${artist.id}?edit=true`,
        },
        {
          label: tCommon('delete'),
          icon: <IconTrash size={16} />,
          onClick: () => openDelete(artist),
          color: 'red',
        },
      ]}
    />
  );
}
