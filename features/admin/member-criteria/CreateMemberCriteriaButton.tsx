'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { useCriteriaModal } from './MemberCriteriaModalContext';

export function CreateMemberCriteriaButton() {
  const tCommon = useTranslations('common');
  const { openCreate } = useCriteriaModal();
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      {tCommon('actions.newItem', { item: tCommon('entities.memberCriteria') })}
    </Button>
  );
}
