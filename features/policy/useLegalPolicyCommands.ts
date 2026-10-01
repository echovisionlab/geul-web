'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { LegalPolicyEditorStrategy } from './legal-policy-types';

interface Messages {
  scheduled: string;
  scheduleFailed: string;
  scheduleCancelled: string;
  cancelScheduleFailed: string;
  activated: string;
  activateFailed: string;
  deleted: string;
  deleteFailed: string;
  regenerated: string;
  regenerateFailed: string;
}

interface Options {
  policyId: string;
  policyStatus: string;
  strategy: LegalPolicyEditorStrategy;
  flushActiveDocuments: () => Promise<void>;
  getExpectedRevision: () => Promise<string>;
  closeScheduleModal: () => void;
  closeCancelModal: () => void;
  closeActivateModal: () => void;
  clearEffectiveFrom: () => void;
  messages: Messages;
}

export function useLegalPolicyCommands({
  policyId,
  policyStatus,
  strategy,
  flushActiveDocuments,
  getExpectedRevision,
  closeScheduleModal,
  closeCancelModal,
  closeActivateModal,
  clearEffectiveFrom,
  messages,
}: Options) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const invalidatePolicy = () => {
    void queryClient.invalidateQueries({ queryKey: [strategy.entityType, policyId] });
    void queryClient.invalidateQueries({ queryKey: [strategy.entityType, 'list'] });
  };

  const scheduleMutation = useMutation({
    mutationFn: async (effectiveFrom: Date) => {
      await flushActiveDocuments();
      const expectedRevision = await getExpectedRevision();
      return strategy.actions.schedule(policyId, effectiveFrom, expectedRevision);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.scheduleFailed, color: 'red' });
        return;
      }
      notifications.show({ message: messages.scheduled, color: 'green' });
      invalidatePolicy();
      closeScheduleModal();
      clearEffectiveFrom();
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, color: 'red' }),
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: () => strategy.actions.cancelSchedule(policyId),
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.cancelScheduleFailed, color: 'red' });
        return;
      }
      notifications.show({ message: messages.scheduleCancelled, color: 'yellow' });
      invalidatePolicy();
      closeCancelModal();
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, color: 'red' }),
  });

  const activateNowMutation = useMutation({
    mutationFn: async () => {
      if (strategy.status.isDraft(policyStatus)) {
        await flushActiveDocuments();
      }
      const expectedRevision = await getExpectedRevision();
      return strategy.actions.activateNow(policyId, expectedRevision);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.activateFailed, color: 'red' });
        return;
      }
      notifications.show({ message: messages.activated, color: 'green' });
      invalidatePolicy();
      closeActivateModal();
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, color: 'red' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await flushActiveDocuments();
      const expectedRevision = await getExpectedRevision();
      return strategy.actions.deleteVersion(policyId, expectedRevision);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.deleteFailed, color: 'red' });
        return;
      }
      notifications.show({ message: messages.deleted, color: 'red' });
      router.push(strategy.listPath);
    },
    onError: (error) => notifications.show({ message: error.message, color: 'red' }),
  });

  const regenerateHtmlMutation = useMutation({
    mutationFn: async () => {
      await flushActiveDocuments();
      return strategy.actions.regenerateHtml(policyId);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.regenerateFailed, color: 'red' });
        return;
      }
      notifications.show({ message: messages.regenerated, color: 'green' });
      void queryClient.invalidateQueries({ queryKey: [strategy.entityType, policyId] });
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, color: 'red' }),
  });

  return {
    scheduleMutation,
    cancelScheduleMutation,
    activateNowMutation,
    deleteMutation,
    regenerateHtmlMutation,
  };
}
