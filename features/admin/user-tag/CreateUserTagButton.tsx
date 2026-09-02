'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useUserTagModal } from './UserTagModalContext';

export function CreateUserTagButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useUserTagModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.userTag') })}
    </Button>
  );
}
