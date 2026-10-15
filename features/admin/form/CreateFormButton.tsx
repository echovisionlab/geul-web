'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { createFormAction } from '@/lib/actions/form';

interface CreateFormButtonProps {
  basePath?: string;
  createAction?: typeof createFormAction;
  navigate?: (href: string) => void;
}

export function CreateFormButton({
  basePath: _basePath = '/admin/forms',
  createAction = createFormAction,
  navigate,
}: CreateFormButtonProps) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction('Untitled Form');
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        const href = `/forms/${encodeURIComponent(result.data.id)}?edit=true`;
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
      {tCommon('actions.newItem', { item: tCommon('entities.form') })}
    </Button>
  );
}
