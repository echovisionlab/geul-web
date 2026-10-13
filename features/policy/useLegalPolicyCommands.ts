'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@/components/core/Notification';
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
        notifications.show({ message: result.error || messages.scheduleFailed, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.scheduled, tone: 'positive' });
      invalidatePolicy();
      closeScheduleModal();
      clearEffectiveFrom();
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: () => strategy.actions.cancelSchedule(policyId),
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.cancelScheduleFailed, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.scheduleCancelled, tone: 'positive' });
      invalidatePolicy();
      closeCancelModal();
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const activateNowMutation = useMutation({
    mutationFn: async () => {
      await flushActiveDocuments();
      const expectedRevision = await getExpectedRevision();
      return strategy.actions.activateNow(policyId, expectedRevision);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.activateFailed, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.activated, tone: 'positive' });
      invalidatePolicy();
      closeActivateModal();
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await flushActiveDocuments();
      const expectedRevision = await getExpectedRevision();
      return strategy.actions.deleteVersion(policyId, expectedRevision);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.deleteFailed, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.deleted, tone: 'positive' });
      router.push(strategy.listPath);
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  const regenerateHtmlMutation = useMutation({
    mutationFn: async () => {
      await flushActiveDocuments();
      return strategy.actions.regenerateHtml(policyId);
    },
    onSuccess: (result) => {
      if (!result.success) {
        notifications.show({ message: result.error || messages.regenerateFailed, tone: 'danger' });
        return;
      }
      notifications.show({ message: messages.regenerated, tone: 'positive' });
      void queryClient.invalidateQueries({ queryKey: [strategy.entityType, policyId] });
      router.refresh();
    },
    onError: (error) => notifications.show({ message: error.message, tone: 'danger' }),
  });

  return {
    scheduleMutation,
    cancelScheduleMutation,
    activateNowMutation,
    deleteMutation,
    regenerateHtmlMutation,
  };
}
