'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@/components/core/Notification';
import {
  cancelCampaignAction,
  scheduleCampaignAction,
  sendCampaignNowAction,
  sendTestCampaignAction,
} from '@/lib/actions/campaign';

type RecipientScope = 'SUBSCRIBED_USERS' | 'ALL_MATCHING_USERS';

interface Messages {
  testSent: string;
  sent: (recipientCount: number) => string;
  scheduled: string;
  scheduleCancelled: string;
}

interface Options {
  campaignId: string;
  closeTestModal: () => void;
  closeSendModal: () => void;
  closeScheduleModal: () => void;
  messages: Messages;
}

export function useCampaignDeliveryCommands({
  campaignId,
  closeTestModal,
  closeSendModal,
  closeScheduleModal,
  messages,
}: Options) {
  const router = useRouter();
  const returnToCampaigns = () => router.push('/admin/campaigns');

  const sendTest = useMutation({
    mutationFn: ({ email, locale }: { email: string; locale: string }) =>
      sendTestCampaignAction(campaignId, email, locale),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.testSent, tone: 'positive' });
      closeTestModal();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const sendCampaign = useMutation({
    mutationFn: (recipientScope: RecipientScope) => sendCampaignNowAction(campaignId, recipientScope),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: messages.sent(result.recipientCount ?? 0),
        tone: 'positive',
      });
      closeSendModal();
      returnToCampaigns();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const scheduleCampaign = useMutation({
    mutationFn: ({ scheduledAt, recipientScope }: { scheduledAt: Date; recipientScope: RecipientScope }) =>
      scheduleCampaignAction(campaignId, scheduledAt, recipientScope),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.scheduled, tone: 'positive' });
      closeScheduleModal();
      returnToCampaigns();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const cancelSchedule = useMutation({
    mutationFn: () => cancelCampaignAction(campaignId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.scheduleCancelled, tone: 'positive' });
      returnToCampaigns();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  return { sendTest, sendCampaign, scheduleCampaign, cancelSchedule };
}
