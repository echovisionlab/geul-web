'use client';

import { useEffect, useState } from 'react';
import { Group, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import {
  clearEditorSaveRecovery,
  exportEditorSaveRecoveries,
  listEditorSaveRecoveries,
  subscribeToEditorSaveRecovery,
  type EditorSaveRecovery,
} from '@/lib/editor/editor-save-recovery';

function downloadRecoveryCopy(document: string) {
  const content = exportEditorSaveRecoveries(document);
  if (!content) {
    return false;
  }

  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `editor-recovery-${document.replace(/[^a-zA-Z0-9_-]+/gu, '_')}.json`;
  anchor.style.display = 'none';
  window.document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}

export function EditorSaveRecoveryNotice({ document }: { document: string }) {
  const t = useTranslations('pageEditor.localRecovery');
  const tActions = useTranslations('common.actions');
  const [recoveries, setRecoveries] = useState<EditorSaveRecovery[]>([]);

  useEffect(() => {
    const refresh = () => setRecoveries(listEditorSaveRecoveries(document));
    refresh();
    return subscribeToEditorSaveRecovery(refresh);
  }, [document]);

  if (recoveries.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs" role="status">
      <Text size="sm">{t('message')}</Text>
      <Group gap="xs">
        <Button type="button" tone="neutral" emphasis="medium" onClick={() => downloadRecoveryCopy(document)}>
          {t('action')}
        </Button>
        <Button
          type="button"
          tone="neutral"
          emphasis="low"
          onClick={() => {
            for (const recovery of recoveries) {
              clearEditorSaveRecovery(
                recovery.scope,
                recovery.entries.map((entry) => entry.id),
              );
            }
            setRecoveries([]);
          }}
        >
          {tActions('dismiss')}
        </Button>
      </Group>
    </Stack>
  );
}
