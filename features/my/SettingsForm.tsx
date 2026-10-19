'use client';
import { notifications } from '@/components/core/Notification';
import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SettingsFormView } from '@/features/my/ui/SettingsForm';
import { setCurrentUserNewsletterSubscriptionAction } from '@/lib/actions/newsletter';
interface SettingsFormProps {
  updateAction?: typeof setCurrentUserNewsletterSubscriptionAction;
  initialSettings: {
    subscribed: boolean;
  };
}
/** Connects newsletter translations and persistence to the pure settings view. */
export function SettingsForm({
  initialSettings,
  updateAction = setCurrentUserNewsletterSubscriptionAction,
}: SettingsFormProps) {
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
      tone: 'danger',
    });
  };
  const updateSubscriptionMutation = useMutation({
    mutationFn: (subscribed: boolean) => updateAction(subscribed),
    onSuccess: (result, subscribed) => {
      if (!result.success) {
        showUpdateError(result.message);
        return;
      }
      setError(null);
      setIsSubscribed(subscribed);
      notifications.show({
        message: tCommonStatuses(subscribed ? 'subscribed' : 'unsubscribed'),
        tone: 'positive',
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
