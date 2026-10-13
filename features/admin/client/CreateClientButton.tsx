'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { createClientAction } from '@/lib/actions/client';

export interface CreateClientButtonProps {
  createAction?: typeof createClientAction;
  onCreated?: (id: string) => void;
}
export function CreateClientButton({ createAction = createClientAction, onCreated }: CreateClientButtonProps = {}) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction(tCommon('actions.newItem', { item: tCommon('entities.client') }));
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        if (onCreated) {
          onCreated(result.data.id);
          return;
        }
        const href = `/admin/clients/${result.data.id}`;
        startNavigation(() => {
          router.push(href);
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
      {tCommon('actions.newItem', { item: tCommon('entities.client') })}
    </Button>
  );
}
