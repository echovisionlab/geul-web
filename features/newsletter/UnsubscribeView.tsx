'use client';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
export type UnsubscribeViewStatus = 'success' | 'error' | 'missing-token';
export function UnsubscribeView({ status }: { status: UnsubscribeViewStatus }) {
  const t = useTranslations('unsubscribe');
  const tCommonActions = useTranslations('common.actions');
  const success = status === 'success';
  return (
    <DsLayoutInset block="xl">
      <DsLayoutContainer size="form" data-unsubscribe-state={status}>
        <DsLayoutStack align="center" gap="md" fill="block" justify="center">
          <Alert
            icon={success ? <IconCheck size="1em" aria-hidden /> : <IconX size="1em" aria-hidden />}
            tone={success ? 'positive' : 'danger'}
          >
            {t(success ? 'token.success.title' : 'token.error.title')}
          </Alert>
          <DsText size="sm" tone="secondary" align="center">
            {t(success ? 'token.success.description' : 'token.error.description')}
          </DsText>
          <Button href="/" emphasis="medium">
            {tCommonActions('returnHome')}
          </Button>
        </DsLayoutStack>
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}
