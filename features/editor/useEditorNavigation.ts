'use client';

import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { flushAllEditorSaves, hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';

type Navigation = () => void | Promise<void>;

/**
 * Wraps intentional editor navigation so registered saves are acknowledged first.
 * App links use the global EditorNavigationProvider through Next's onNavigate
 * boundary; this wrapper covers explicit actions such as an editor's Back button.
 */
export function useEditorNavigation(document: string) {
  const t = useTranslations('common.notifications');

  const navigate = useCallback(
    async (navigation: Navigation): Promise<boolean> => {
      if (!hasPendingEditorSaves(document)) {
        await navigation();
        return true;
      }
      if (!(await flushAllEditorSaves(document))) {
        notifications.show({ message: t('saveFailed'), color: 'red' });
        return false;
      }
      await navigation();
      return true;
    },
    [document, t],
  );

  return navigate;
}
