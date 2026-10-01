'use client';

import { useCallback, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NavigationIntentProvider, type NavigationIntent } from '@/components/core/Navigation';
import { flushAllEditorSaves, hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { usePendingEditorUnload } from '@/lib/editor/usePendingEditorUnload';

interface EditorNavigationProviderProps {
  children: ReactNode;
}

export function EditorNavigationProvider({ children }: EditorNavigationProviderProps) {
  usePendingEditorUnload();
  const router = useRouter();
  const t = useTranslations('common.notifications');

  const onNavigationIntent = useCallback(
    (intent: NavigationIntent, event: { preventDefault: () => void }) => {
      if (!hasPendingEditorSaves()) {
        return;
      }

      event.preventDefault();

      void (async () => {
        let saved: boolean;
        try {
          saved = await flushAllEditorSaves();
        } catch {
          saved = false;
        }

        if (!saved) {
          notifications.show({ message: t('saveFailed'), color: 'red' });
          return;
        }

        const options = { scroll: intent.scroll };
        if (intent.replace) {
          router.replace(intent.href, options);
        } else {
          router.push(intent.href, options);
        }
      })();
    },
    [router, t],
  );

  return <NavigationIntentProvider onNavigationIntent={onNavigationIntent}>{children}</NavigationIntentProvider>;
}
