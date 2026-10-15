'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { createCampaignAction } from '@/lib/actions/campaign';

export function CreateCampaignButton({
  createAction = createCampaignAction,
  navigate,
}: { createAction?: typeof createCampaignAction; navigate?: (href: string) => void } = {}) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.campaigns');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction(tPage('subjectFallback'), tPage('subjectFallback'));
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        const href = `/campaigns/${result.data.id}?edit=true`;
        startNavigation(() => {
          (navigate ?? router.push)(href);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      leftSection={<IconPlus size={16} />}
      onClick={handleCreate}
      loading={loading || isNavigating}
      disabled={loading || isNavigating}
    >
      {tCommon('actions.newItem', { item: tCommon('entities.campaign') })}
    </Button>
  );
}
