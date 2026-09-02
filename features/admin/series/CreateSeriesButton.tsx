'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useSeriesModal } from './SeriesModalContext';

export function CreateSeriesButton() {
  const tPage = useTranslations('adminList.series');
  const { openCreate } = useSeriesModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tPage('createTitle')}
    </Button>
  );
}
