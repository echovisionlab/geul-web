'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { createMapThemeAction } from '@/lib/actions/map-theme';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';

export function CreateMapThemeButton() {
  const tCommon = useTranslations('common');
  const tMapThemes = useTranslations('adminList.mapThemes');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createMapThemeAction({
        name: tMapThemes('defaults.untitledName'),
        settings: DEFAULT_THEME_SETTINGS,
        lightVariant: DEFAULT_LIGHT_VARIANT,
        darkVariant: DEFAULT_DARK_VARIANT,
      });
      if (result.error) {
        notifications.show({ message: tMapThemes('notifications.createFailed'), color: 'red' });
        return;
      }
      if (result.data) {
        const href = `/admin/map/themes/${result.data.id}`;
        startNavigation(() => {
          router.push(href);
        });
      }
    } catch {
      notifications.show({ message: tMapThemes('notifications.createFailed'), color: 'red' });
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
      {tCommon('actions.newItem', { item: tCommon('entities.mapTheme') })}
    </Button>
  );
}
