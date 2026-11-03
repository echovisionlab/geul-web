'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { ContentModal, DialogActions } from '@/components/core/Modal';
import { Button } from '@/components/core/Button';
import { Select, TextInput } from '@/components/core/Input';
import { resolveEmbedUrl } from '@/features/page/blocks/embed/policy';

export type ConfiguredSectionType = 'external-video' | 'embed' | 'form';

interface PageSectionPreinsertDialogProps {
  type: ConfiguredSectionType;
  title: string;
  formOptions: readonly { value: string; label: string }[];
  formsLoading: boolean;
  formsFailure?: ReactNode;
  onCancel: () => void;
  onInsert: (type: ConfiguredSectionType, props: Record<string, unknown>) => void;
}

export function isValidExternalVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function PageSectionPreinsertDialog({
  type,
  title,
  formOptions,
  formsLoading,
  formsFailure,
  onCancel,
  onInsert,
}: PageSectionPreinsertDialogProps) {
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('pageEditor');
  const tActions = useTranslations('common.actions');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [formId, setFormId] = useState<string | null>(null);
  const validUrl =
    type === 'embed' ? Boolean(resolveEmbedUrl(externalVideoUrl)) : isValidExternalVideoUrl(externalVideoUrl);
  const canInsert = type === 'form' ? Boolean(formId) && !formsLoading && !formsFailure : validUrl;

  const confirm = useCallback(() => {
    if (type === 'embed' && resolveEmbedUrl(externalVideoUrl)) {
      onInsert(type, { uri: externalVideoUrl.trim() });
    } else if (type === 'external-video' && isValidExternalVideoUrl(externalVideoUrl)) {
      onInsert(type, { url: externalVideoUrl.trim() });
    } else if (type === 'form' && formId) {
      onInsert(type, { formId });
    }
  }, [externalVideoUrl, formId, onInsert, type]);

  return (
    <ContentModal opened onClose={onCancel} title={title} centered closeLabel={tModalActions('close')}>
      <DsLayoutStack gap="md">
        {type === 'form' ? formsFailure : null}
        {type !== 'form' ? (
          <TextInput
            label={type === 'embed' ? t('embed.urlLabel') : 'URL'}
            value={externalVideoUrl}
            onChange={(event) => setExternalVideoUrl(event.currentTarget.value)}
            error={
              externalVideoUrl && !validUrl
                ? type === 'embed'
                  ? t('embed.invalidUrl')
                  : 'Enter a valid HTTP(S) URL.'
                : undefined
            }
            autoFocus
            data-page-section-preinsert-url
          />
        ) : (
          <Select
            label={t('blockEditor.labels.selectForm')}
            data={[...formOptions]}
            value={formId}
            onChange={setFormId}
            searchable
            isLoading={formsLoading}
            disabled={formsLoading || Boolean(formsFailure)}
            data-page-section-preinsert-form
          />
        )}
        <DialogActions>
          <Button tone="neutral" emphasis="medium" onClick={onCancel} data-page-section-preinsert-cancel>
            {tActions('cancel')}
          </Button>
          <Button emphasis="strong" onClick={confirm} disabled={!canInsert} data-page-section-preinsert-confirm>
            {tActions('add')}
          </Button>
        </DialogActions>
      </DsLayoutStack>
    </ContentModal>
  );
}
