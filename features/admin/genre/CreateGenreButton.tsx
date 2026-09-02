'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useGenreModal } from './GenreModalContext';

export function CreateGenreButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useGenreModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.genre') })}
    </Button>
  );
}
