'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';

interface CreateReleaseButtonViewProps {
  loading?: boolean;
  onCreate: () => void;
}

export function CreateReleaseButtonView({ loading = false, onCreate }: CreateReleaseButtonViewProps) {
  const tCommon = useTranslations('common');

  return (
    <Button leftSection={<IconPlus size={16} />} onClick={onCreate} loading={loading} disabled={loading}>
      {tCommon('actions.newItem', { item: tCommon('entities.release') })}
    </Button>
  );
}
