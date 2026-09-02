'use client';

import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { SettingsFormView } from '@/features/my/ui/SettingsForm';
import { setCurrentUserNewsletterSubscriptionAction } from '@/lib/actions/newsletter';

interface SettingsFormProps {
  initialSettings: {
    subscribed: boolean;
  };
}

/** Connects newsletter translations and persistence to the pure settings view. */
export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const t = useTranslations('settings.newsletter');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStatuses = useTranslations('common.statuses');
  const [isSubscribed, setIsSubscribed] = useState(initialSettings.subscribed);
  const [error, setError] = useState<string | null>(null);

  const showUpdateError = (message: string) => {
    setError(message);
    notifications.show({
      title: tCommonLabels('error'),
      message,
      color: 'red',
    });
  };

  const updateSubscriptionMutation = useMutation({
    mutationFn: (subscribed: boolean) => setCurrentUserNewsletterSubscriptionAction(subscribed),
    onSuccess: (result, subscribed) => {
      if (!result.success) {
        showUpdateError(result.message);
        return;
      }

      setError(null);
      setIsSubscribed(subscribed);
      notifications.show({
        title: subscribed ? t('subscribedTitle') : tCommonStatuses('unsubscribed'),
        message: result.message,
        color: subscribed ? 'green' : 'blue',
        ...(subscribed && { icon: <IconCheck size={16} /> }),
      });
    },
    onError: (mutationError) => {
      showUpdateError(mutationError instanceof Error ? mutationError.message : String(mutationError));
    },
  });

  return (
    <SettingsFormView
      subscribed={isSubscribed}
      pending={updateSubscriptionMutation.isPending}
      error={error}
      labels={{
        subscribedAlert: t('subscribedAlert'),
        unsubscribedAlert: t('unsubscribedAlert'),
        subscribe: t('subscribe'),
        unsubscribe: t('unsubscribe'),
        footer: t('footer'),
        errorTitle: tCommonLabels('error'),
      }}
      events={{
        onSubscriptionChange: (subscribed) => {
          setError(null);
          updateSubscriptionMutation.mutate(subscribed);
        },
      }}
    />
  );
}
