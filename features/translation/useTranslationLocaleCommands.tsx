'use client';

import { useMutation } from '@tanstack/react-query';
import { Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { blockRoomTypeForTranslationEntity } from './block-document-translation';
import type { createTranslationClient } from '@/lib/api/browser-client';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';

type TranslationClient = ReturnType<typeof createTranslationClient>;
type TranslationTarget = NonNullable<Parameters<TranslationClient['setEntitySourceLocale']>[0]['target']>;

interface TranslationCommandMessages {
  sourceUpdated: string;
  sourceUpdateFailed: string;
  regenerateFailed: string;
  sourceConfirmTitle: string;
  sourceConfirmCancel: string;
  sourceConfirmAction: string;
  sourceConfirmDescription: string;
  sourceConfirmDetail: (localeLabel: string) => string;
  regenerateSuccess: (locales: string[]) => string;
}

interface TranslationLocaleCommandOptions {
  client: TranslationClient;
  target: TranslationTarget;
  sourceLocale: string | undefined;
  getLocaleDisplayLabel: (locale: string) => string;
  messages: TranslationCommandMessages;
  refreshEntries: () => Promise<unknown>;
  refreshJobs?: () => Promise<unknown>;
  beforeRegenerate?: () => Promise<unknown>;
  getBlockRoomSnapshot?: () => Promise<{ documentRevision: string }>;
  afterSourceChange?: (sourceLocale: string) => Promise<unknown> | unknown;
}

export function useTranslationLocaleCommands({
  client,
  target,
  sourceLocale,
  getLocaleDisplayLabel,
  messages,
  refreshEntries,
  refreshJobs,
  beforeRegenerate,
  getBlockRoomSnapshot,
  afterSourceChange,
}: TranslationLocaleCommandOptions) {
  const setSourceLocale = useMutation({
    mutationFn: async (nextSourceLocale: string) => {
      const { entityType, entityId } = target;
      if (!entityType || !entityId) {
        throw new Error('Translation target is incomplete.');
      }
      const roomType = blockRoomTypeForTranslationEntity(entityType);
      const expectedDocumentRevision = roomType ? (await getBlockRoomSnapshot?.())?.documentRevision : undefined;
      if (roomType && !expectedDocumentRevision) {
        throw new Error('Block-room WebSocket is not available.');
      }
      return client.setEntitySourceLocale({
        target,
        sourceLocale: nextSourceLocale,
        expectedDocumentRevision,
      });
    },
    onSuccess: async (_response, nextSourceLocale) => {
      notifications.show({ color: 'green', message: messages.sourceUpdated });
      await refreshEntries();
      await afterSourceChange?.(nextSourceLocale);
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, messages.sourceUpdateFailed),
      });
    },
  });

  const regenerateTranslations = useMutation({
    mutationFn: async (locales: string[]) => {
      if (locales.length === 0) {
        throw new Error('At least one target locale is required.');
      }
      await beforeRegenerate?.();
      return client.regenerateEntityTranslations({
        target,
        locales,
      });
    },
    onSuccess: async (_response, locales) => {
      notifications.show({ color: 'blue', message: messages.regenerateSuccess(locales) });
      await refreshEntries();
      await refreshJobs?.();
    },
    onError: async (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, messages.regenerateFailed),
      });
      await refreshEntries();
      await refreshJobs?.();
    },
  });

  const openSourceLocaleConfirm = (nextLocale: string | null) => {
    if (!nextLocale || nextLocale === sourceLocale) {
      return;
    }

    modals.openConfirmModal({
      title: messages.sourceConfirmTitle,
      labels: {
        cancel: messages.sourceConfirmCancel,
        confirm: messages.sourceConfirmAction,
      },
      confirmProps: { color: 'blue' },
      children: (
        <Stack gap="xs">
          <Text size="sm">{messages.sourceConfirmDescription}</Text>
          <Text size="sm" c="dimmed">
            {messages.sourceConfirmDetail(getLocaleDisplayLabel(nextLocale))}
          </Text>
        </Stack>
      ),
      onConfirm: () => {
        setSourceLocale.mutate(nextLocale);
      },
    });
  };

  return {
    setSourceLocale,
    regenerateTranslations,
    openSourceLocaleConfirm,
  };
}
