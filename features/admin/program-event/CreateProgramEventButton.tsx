'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { createProgramEventAction } from '@/lib/actions/program-event';
import { useRequestTimeZone } from '@/lib/providers/RequestTimeZoneProvider';

export function CreateProgramEventButton({
  createAction = createProgramEventAction,
  navigate,
}: { createAction?: typeof createProgramEventAction; navigate?: (href: string) => void } = {}) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const requestTimeZone = useRequestTimeZone();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction(requestTimeZone);
      if (result.error || !result.data) {
        notifications.show({
          message: result.error ?? tCommon('notifications.saveFailed'),
          tone: 'danger',
        });
        return;
      }
      (navigate ?? router.push)(`/events/${result.data.id}?edit=true`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button leftSection={<IconPlus size={16} />} onClick={handleCreate} loading={loading}>
      {tCommon('actions.newItem', { item: tCommonEntities('programEvent') })}
    </Button>
  );
}
