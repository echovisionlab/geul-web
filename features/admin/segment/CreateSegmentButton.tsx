'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useSegmentModal } from './SegmentModalContext';

export function CreateSegmentButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useSegmentModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.audienceSegment') })}
    </Button>
  );
}
