'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { createReleaseAction } from '@/lib/actions/release';
import { CreateReleaseButtonView } from './CreateReleaseButtonView';

export interface CreateReleaseButtonProps {
  createAction?: typeof createReleaseAction;
  onCreated?: (id: string) => void;
}
export function CreateReleaseButton({ createAction = createReleaseAction, onCreated }: CreateReleaseButtonProps = {}) {
  const tReleaseEditor = useTranslations('releaseEditor');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createAction({
        title: tReleaseEditor('titleFallback'),
        type: 'album',
      });
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        if (onCreated) {
          onCreated(result.data.id);
          return;
        }
        const href = `/releases/${result.data.id}?edit=true`;
        startNavigation(() => {
          router.push(href);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return <CreateReleaseButtonView loading={loading || isNavigating} onCreate={handleCreate} />;
}
