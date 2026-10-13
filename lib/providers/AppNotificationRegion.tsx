'use client';
import { useTranslations } from 'next-intl';
import { NotificationHost } from '@/components/core/Notification/NotificationHost';
export function AppNotificationRegion() {
  const t = useTranslations('common.actions');
  return <NotificationHost closeLabel={t('close')} />;
}
