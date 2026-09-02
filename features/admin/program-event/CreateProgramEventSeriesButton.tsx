'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { createProgramEventSeriesAction } from '@/lib/actions/program-event';

export function CreateProgramEventSeriesButton() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createProgramEventSeriesAction();
      if (result.error || !result.data) {
        notifications.show({
          message: result.error ?? tCommon('notifications.saveFailed'),
          color: 'red',
        });
        return;
      }
      router.push(`/event-series/${result.data.id}?edit=true`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button leftSection={<IconPlus size={16} />} onClick={handleCreate} loading={loading}>
      {tCommon('actions.newItem', { item: tCommonEntities('programEventSeries') })}
    </Button>
  );
}
