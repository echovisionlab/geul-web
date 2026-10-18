'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';

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
      if (!(await flushEditorSavesOrNotify(document, t('saveFailed')))) {
        return false;
      }
      await navigation();
      return true;
    },
    [document, t],
  );

  return navigate;
}
