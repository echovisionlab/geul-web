'use client';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';

import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { useTranslations, useLocale, useTimeZone } from 'next-intl';
import type { ActionResult } from '@/lib/actions/account';
import { formatDateTimeInZone } from '@/components/core/DateTime';
export function ConfirmDeletionPageView({
  hasToken,
  result = { success: false, message: '' },
}: {
  hasToken: boolean;
  result?: ActionResult;
}) {
  const t = useTranslations('auth.confirmDeletion');
  const tCommonActions = useTranslations('common.actions');
  const tCommonAuth = useTranslations('auth.common');
  const tCommonMessages = useTranslations('common.messages');
  const locale = useLocale();
  const timeZone = useTimeZone() ?? 'UTC';
  if (!hasToken) {
    return (
      <DsLayoutInset space="md">
        <DsLayoutContainer size="form" inset="none">
          <DsLayoutStack align="center" gap="md">
            <DsHeading level={1} scale={2} align="center">
              {tCommonAuth('confirmDeletionTitle')}
            </DsHeading>
            <DsText size="sm" tone="warning" align="center" role="alert">
              {tCommonMessages('invalidConfirmationLinkFromEmail')}
            </DsText>
            <Button href="/" emphasis="medium">
              {tCommonActions('returnHome')}
            </Button>
          </DsLayoutStack>
        </DsLayoutContainer>
      </DsLayoutInset>
    );
  }

  if (result.success) {
    return (
      <DsLayoutInset space="md">
        <DsLayoutContainer size="form" inset="none">
          <DsLayoutStack align="center" gap="md">
            <DsHeading level={1} scale={2} align="center">
              {t('success.title')}
            </DsHeading>
            <Alert icon={<IconCheck size="1em" aria-hidden />} tone="warning">
              {result.message}
            </Alert>
            <DsText size="sm" tone="secondary" align="center">
              {t('success.description', {
                scheduledAt: result.scheduledAt
                  ? formatDateTimeInZone(result.scheduledAt, locale, timeZone, 'date', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : t('success.unknownDate'),
              })}
            </DsText>
            <DsLayoutStack gap="sm" fill="inline">
              <Button href="/account/recover" emphasis="medium">
                {tCommonActions('recoverAccount')}
              </Button>
              <Button href="/" emphasis="low">
                {tCommonActions('returnHome')}
              </Button>
            </DsLayoutStack>
          </DsLayoutStack>
        </DsLayoutContainer>
      </DsLayoutInset>
    );
  }

  return (
    <DsLayoutInset space="md">
      <DsLayoutContainer size="form" inset="none">
        <DsLayoutStack align="center" gap="md">
          <DsHeading level={1} scale={2} align="center">
            {t('failure.title')}
          </DsHeading>
          <Alert icon={<IconX size="1em" aria-hidden />} tone="danger">
            {result.message}
          </Alert>
          <DsText size="sm" tone="secondary" align="center">
            {t('failure.description')}
          </DsText>
          <Button href="/" emphasis="medium">
            {tCommonActions('returnHome')}
          </Button>
        </DsLayoutStack>
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}
