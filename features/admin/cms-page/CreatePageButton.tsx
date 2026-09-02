'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { createPageAction } from '@/lib/actions/page';
import { buildPageEditPath } from '@/lib/utils/page-route';

interface CreatePageButtonProps {
  createAction?: typeof createPageAction;
  navigate?: (href: string) => void;
}

export function CreatePageButton({ createAction = createPageAction, navigate }: CreatePageButtonProps = {}) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction();
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.data) {
        const href = buildPageEditPath(result.data.id);
        if (navigate) {
          navigate(href);
          return;
        }
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
      data-page-create
    >
      {tCommon('actions.newItem', { item: tCommon('entities.page') })}
    </Button>
  );
}
