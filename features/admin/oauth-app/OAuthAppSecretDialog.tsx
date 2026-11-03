'use client';
import { IconCopy } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { MetadataPair } from '@/components/core/PublicMetadata';
import { Text } from '@/components/core/Typography';
import type { OAuthAppSecret } from './model';

export interface OAuthAppSecretDialogProps {
  secret: OAuthAppSecret | null;
  onCopy: (value: string) => void;
  onClose: () => void;
}

/** Shows a newly issued client secret once; the server never returns it again. */
export function OAuthAppSecretDialog({ secret, onCopy, onClose }: OAuthAppSecretDialogProps) {
  const t = useTranslations('adminList.oauthApps');
  const tCommon = useTranslations('common');
  return (
    <ContentModal
      opened={secret !== null}
      onClose={onClose}
      title={t('secretTitle')}
      closeLabel={tCommon('actions.close')}
    >
      {secret && (
        <LayoutStack gap="md">
          <Alert tone="warning">{t('secretWarning')}</Alert>
          <MetadataPair label={t('fields.clientId')}>
            <Text font="mono" wrap="anywhere">
              {secret.clientId}
            </Text>
          </MetadataPair>
          <MetadataPair label={t('fields.clientSecret')}>
            <Text font="mono" wrap="anywhere">
              {secret.value}
            </Text>
          </MetadataPair>
          <DialogActions>
            <Button onClick={onClose}>{tCommon('actions.close')}</Button>
            <Button emphasis="strong" leftSection={<IconCopy aria-hidden />} onClick={() => onCopy(secret.value)}>
              {t('copySecret')}
            </Button>
          </DialogActions>
        </LayoutStack>
      )}
    </ContentModal>
  );
}
