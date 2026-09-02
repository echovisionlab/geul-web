'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useSeriesModal, type SeriesModalTarget } from './SeriesModalContext';

interface SeriesRowMenuProps {
  series: SeriesModalTarget;
}

export function SeriesRowMenu({ series }: SeriesRowMenuProps) {
  const { openDelete } = useSeriesModal();
  return (
    <EntityRowMenu entity={series} label={series.title} editHref={`/admin/series/${series.id}`} onDelete={openDelete} />
  );
}
