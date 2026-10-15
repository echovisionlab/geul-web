'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { CopyButton } from '@/components/core/CopyButton';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { Code, SupportingText, Text as DsText } from '@/components/core/Typography';
import type { RejectedEditorSave } from '@/lib/editor/editor-save-registry';

export interface RejectedEditsDialogProps {
  opened: boolean;
  onClose: () => void;
  rejected: readonly RejectedEditorSave[];
}

function formatPatch(patch: object): string {
  return JSON.stringify(patch, null, 2);
}

/**
 * Edits the server refused for good. They are never retried, so the editor decides: copy what is
 * still needed, then discard them.
 */
export function RejectedEditsDialog({ opened, onClose, rejected }: RejectedEditsDialogProps) {
  const t = useTranslations('editorHeader.rejectedEdits');
  const tActions = useTranslations('common.actions');
  return (
    <ContentModal opened={opened} onClose={onClose} title={t('title')} closeLabel={tActions('close')} size="large">
      <DsLayoutStack gap="md">
        <DsText>{rejected.length ? t('description') : t('empty')}</DsText>
        {rejected.map((save) => {
          const value = formatPatch(save.patch);
          return (
            <DsLayoutStack key={`${save.reason}:${save.rejectedAt}`} gap="xs" data-testid="rejected-edit">
              <DsLayoutInline justify="between" wrap="nowrap">
                <SupportingText tone="secondary">{t('reason', { reason: save.message || save.reason })}</SupportingText>
                <DsLayoutInline gap="xs" wrap="nowrap">
                  <CopyButton value={value} label={t('copy')} copiedLabel={t('copied')} />
                  <Button emphasis="low" tone="danger" size="xs" onClick={save.discard}>
                    {t('discard')}
                  </Button>
                </DsLayoutInline>
              </DsLayoutInline>
              <Code block wrap="anywhere">
                {value}
              </Code>
            </DsLayoutStack>
          );
        })}
      </DsLayoutStack>
      <DialogActions>
        <Button emphasis="medium" onClick={onClose}>
          {tActions('close')}
        </Button>
      </DialogActions>
    </ContentModal>
  );
}
