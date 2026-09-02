'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useTagModal } from './TagModalContext';

export function CreateTagButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useTagModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.tag') })}
    </Button>
  );
}
