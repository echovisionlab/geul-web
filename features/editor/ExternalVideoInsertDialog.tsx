'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ContentModal, DialogActions } from '@/components/core/Modal';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { resolveExternalVideo } from '@/lib/media/external-video';
import type { ExternalVideoLinkInput } from './external-video-insert';

interface ExternalVideoInsertDialogProps {
  opened: boolean;
  onClose: () => void;
  onInsert: (input: ExternalVideoLinkInput) => void;
  initialUrl?: string;
  initialLabel?: string;
}

export function ExternalVideoInsertDialog({
  opened,
  onClose,
  onInsert,
  initialUrl = '',
  initialLabel = '',
}: ExternalVideoInsertDialogProps) {
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('editorCommon.externalVideoInsert');
  const [url, setUrl] = useState(initialUrl);
  const [label, setLabel] = useState(initialLabel);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setUrl(initialUrl);
    setLabel(initialLabel);
    setSubmitted(false);
  }, [initialLabel, initialUrl, opened]);

  const trimmedUrl = url.trim();
  const urlError =
    submitted && !trimmedUrl
      ? t('urlRequired')
      : trimmedUrl && !resolveExternalVideo(trimmedUrl)
        ? t('unsupportedUrl')
        : undefined;

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!trimmedUrl || !resolveExternalVideo(trimmedUrl)) {
      return;
    }
    onInsert({ url: trimmedUrl, label: label.trim() || trimmedUrl });
    onClose();
  };

  return (
    <ContentModal opened={opened} onClose={onClose} title={t('title')} centered closeLabel={tModalActions('close')}>
      <form onSubmit={handleSubmit}>
        <DsLayoutStack gap="sm">
          <TextInput
            autoFocus
            label={t('urlLabel')}
            description={t('urlDescription')}
            placeholder={t('urlPlaceholder')}
            value={url}
            error={urlError}
            onChange={(event) => setUrl(event.currentTarget.value)}
          />
          <TextInput
            label={t('labelLabel')}
            description={t('labelDescription')}
            placeholder={t('labelPlaceholder')}
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
          />
          <DialogActions>
            <Button type="button" emphasis="low" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button emphasis="strong" type="submit">
              {t('insert')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </form>
    </ContentModal>
  );
}
