'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { createArtistDraftAction } from '@/lib/actions/artist';

export interface CreateArtistButtonProps {
  createAction?: typeof createArtistDraftAction;
  onCreated?: (id: string) => void;
}
export function CreateArtistButton({
  createAction = createArtistDraftAction,
  onCreated,
}: CreateArtistButtonProps = {}) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction();
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        if (onCreated) {
          onCreated(result.data.id);
          return;
        }
        const href = `/artists/${result.data.id}?edit=true`;
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
      {tCommon('actions.newItem', { item: tCommon('entities.artist') })}
    </Button>
  );
}
