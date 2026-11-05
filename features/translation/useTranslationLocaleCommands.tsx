'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useMutation } from '@tanstack/react-query';

import { confirmationDialogs } from '@/features/confirmation';
import { notifications } from '@/components/core/Notification';
import type { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';

type TranslationClient = ReturnType<typeof createTranslationClient>;
type TranslationTarget = NonNullable<Parameters<TranslationClient['setEntitySourceLocale']>[0]['target']>;

interface TranslationCommandMessages {
  sourceUpdated: string;
  sourceUpdateFailed: string;
  sourceConfirmTitle: string;
  sourceConfirmCancel: string;
  sourceConfirmAction: string;
  sourceConfirmDescription: string;
  sourceConfirmDetail: (localeLabel: string) => string;
}

interface TranslationLocaleCommandOptions {
  client: TranslationClient;
  target: TranslationTarget;
  sourceLocale: string | undefined;
  getLocaleDisplayLabel: (locale: string) => string;
  messages: TranslationCommandMessages;
  refreshEntries: () => Promise<unknown>;
  beforeSourceChange?: () => Promise<unknown>;
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
  beforeSourceChange,
  getBlockRoomSnapshot,
  afterSourceChange,
}: TranslationLocaleCommandOptions) {
  const setSourceLocale = useMutation({
    mutationFn: async (nextSourceLocale: string) => {
      const { entityType, entityId } = target;
      if (!entityType || !entityId) {
        throw new Error('Translation target is incomplete.');
      }
      await beforeSourceChange?.();
      const expectedDocumentRevision = (await getBlockRoomSnapshot?.())?.documentRevision;
      if (!expectedDocumentRevision) {
        throw new Error('Collaborative document revision is not available.');
      }
      return client.setEntitySourceLocale({
        target,
        sourceLocale: nextSourceLocale,
        expectedDocumentRevision,
      });
    },
    onSuccess: async (_response, nextSourceLocale) => {
      notifications.show({ tone: 'positive', message: messages.sourceUpdated });
      await refreshEntries();
      await afterSourceChange?.(nextSourceLocale);
    },
    onError: (error) => {
      notifications.show({
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, messages.sourceUpdateFailed),
      });
    },
  });

  const openSourceLocaleConfirm = (nextLocale: string | null) => {
    if (!nextLocale || nextLocale === sourceLocale) {
      return;
    }

    confirmationDialogs.open({
      title: messages.sourceConfirmTitle,
      cancelLabel: messages.sourceConfirmCancel,
      confirmLabel: messages.sourceConfirmAction,
      closeLabel: messages.sourceConfirmCancel,
      intent: 'confirm',
      message: (
        <DsLayoutStack gap="xs">
          <DsText>{messages.sourceConfirmDescription}</DsText>
          <DsText size="sm" tone="secondary">
            {messages.sourceConfirmDetail(getLocaleDisplayLabel(nextLocale))}
          </DsText>
        </DsLayoutStack>
      ),
      onConfirm: async () => {
        await setSourceLocale.mutateAsync(nextLocale);
      },
    });
  };

  return {
    setSourceLocale,
    openSourceLocaleConfirm,
  };
}
