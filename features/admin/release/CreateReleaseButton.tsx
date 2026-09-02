'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { createReleaseAction } from '@/lib/actions/release';
import { CreateReleaseButtonView } from './CreateReleaseButtonView';

export function CreateReleaseButton() {
  const tReleaseEditor = useTranslations('releaseEditor');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createReleaseAction({
        title: tReleaseEditor('titleFallback'),
        type: 'album',
      });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.data) {
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
