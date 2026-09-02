'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useCategoryModal } from './CategoryModalContext';

export function CreateCategoryButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useCategoryModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.category') })}
    </Button>
  );
}
