'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useStyleModal } from './StyleModalContext';

export function CreateStyleButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useStyleModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.style') })}
    </Button>
  );
}
