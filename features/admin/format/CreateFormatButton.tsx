'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useFormatModal } from './FormatModalContext';

export function CreateFormatButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useFormatModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.format') })}
    </Button>
  );
}
