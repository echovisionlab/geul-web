// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@/test/render';
import { notificationQueue, notifications } from '@/components/core/Notification/notifications';
import { useTranslationLocaleCommands } from './useTranslationLocaleCommands';

type Options = Parameters<typeof useTranslationLocaleCommands>[0];
const target = { entityType: TranslationEntityType.POST, entityId: 'post-1' };
const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  notifications.clean();
});

function renderCommands(overrides: Partial<Options> = {}) {
  const client = {
    setEntitySourceLocale: vi.fn(async () => ({})),
    regenerateEntityTranslations: vi.fn(async () => ({ jobIds: ['job-1'] })),
  };
  const snapshot = vi.fn(async () => ({ documentRevision: 'revision-1' }));
  const afterSourceChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(queryClient);
  const hook = renderHook(
    () =>
      useTranslationLocaleCommands({
        client: client as unknown as Options['client'],
        target,
        sourceLocale: 'en',
        getLocaleDisplayLabel: (locale) => locale,
        refreshEntries: vi.fn(async () => undefined),
        getBlockRoomSnapshot: snapshot,
        afterSourceChange,
        messages: {
          sourceUpdated: 'Source updated',
          sourceUpdateFailed: 'Source change failed',
          regenerateFailed: 'Regeneration failed',
          sourceConfirmTitle: 'Change source',
          sourceConfirmCancel: 'Cancel',
          sourceConfirmAction: 'Change',
          sourceConfirmDescription: 'Change source locale',
          sourceConfirmDetail: (locale) => locale,
          regenerateSuccess: () => 'Queued',
        },
        ...overrides,
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
  return { ...hook, client, snapshot, afterSourceChange };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

describe('translation locale command save boundaries', () => {
  it('waits for the source save barrier and sends the subsequent document revision as CAS', async () => {
    const saved = deferred();
    const barrierStarted = deferred();
    const { result, client, snapshot } = renderCommands({
      beforeSourceChange: () => {
        barrierStarted.resolve();
        return saved.promise;
      },
    });
    let change!: Promise<unknown>;
    await act(async () => {
      change = result.current.setSourceLocale.mutateAsync('fr');
      await barrierStarted.promise;
    });
    expect(snapshot).not.toHaveBeenCalled();
    expect(client.setEntitySourceLocale).not.toHaveBeenCalled();

    await act(async () => {
      saved.resolve();
      await change;
    });

    expect(client.setEntitySourceLocale).toHaveBeenCalledWith({
      target,
      sourceLocale: 'fr',
      expectedDocumentRevision: 'revision-1',
    });
  });

  it.each(['regenerate', 'source'] as const)(
    'reports a failed %s barrier without issuing the command',
    async (command) => {
      const rejectSave = async () => {
        throw new Error('Pending editor saves did not complete.');
      };
      const { result, client, snapshot, afterSourceChange } = renderCommands({
        beforeRegenerate: rejectSave,
        beforeSourceChange: rejectSave,
      });

      await act(async () => {
        const pending =
          command === 'source'
            ? result.current.setSourceLocale.mutateAsync('fr')
            : result.current.regenerateTranslations.mutateAsync(['fr']);
        await expect(pending).rejects.toThrow('Pending editor saves did not complete.');
      });

      expect(snapshot).not.toHaveBeenCalled();
      expect(client.setEntitySourceLocale).not.toHaveBeenCalled();
      expect(client.regenerateEntityTranslations).not.toHaveBeenCalled();
      expect(afterSourceChange).not.toHaveBeenCalled();
      expect(notificationQueue.visibleToasts.map((toast) => toast.content)).toContainEqual({
        tone: 'danger',
        message: command === 'source' ? 'Source change failed' : 'Regeneration failed',
      });
    },
  );
});
