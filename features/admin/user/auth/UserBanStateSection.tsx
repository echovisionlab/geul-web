'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { DateTime } from '@/features/date-time/DateTime';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { UserFull } from '@/lib/types/user/model';
import { InfoRow, InfoSection, StatusValue } from './shared';

export function UserBanStateSection({ user, actions }: { user: UserFull; actions?: ReactNode }) {
  const tPage = useTranslations('adminUserDetail');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStatuses = useTranslations('common.statuses');
  const ban = user.ban_details;
  const identityState = normalizeEnumToken(ban?.identity_state);
  const identityStateLabel =
    identityState === 'active'
      ? tCommonStatuses('active')
      : identityState === 'inactive'
        ? tCommonStatuses('inactive')
        : (ban?.identity_state ?? tPage('auth.ban.unknownState'));

  return (
    <InfoSection title={tPage('auth.ban.title')} description={tPage('auth.ban.description')} actions={actions}>
      {ban ? (
        <DsLayoutStack gap="xs">
          <InfoRow label={tPage('auth.ban.record')}>
            <StatusValue tone={ban.metadata_banned ? 'danger' : 'neutral'}>
              {ban.metadata_banned ? tPage('auth.ban.metadataBanned') : tPage('auth.ban.metadataClear')}
            </StatusValue>
          </InfoRow>
          <InfoRow label={tPage('auth.ban.identityState')}>
            <StatusValue tone={ban.inactive_state ? 'warning' : 'positive'}>{identityStateLabel}</StatusValue>
          </InfoRow>
          {ban.reason ? (
            <InfoRow label={tPage('alerts.reasonLabel')}>
              <DsText size="sm">{ban.reason}</DsText>
            </InfoRow>
          ) : null}
          {ban.expires_at ? (
            <InfoRow label={tCommonLabels('duration')}>
              <DsText size="sm">
                <DateTime value={ban.expires_at} display="dateTime" />
              </DsText>
            </InfoRow>
          ) : null}
        </DsLayoutStack>
      ) : (
        <SupportingText tone="secondary">{tPage('auth.ban.unknownState')}</SupportingText>
      )}
    </InfoSection>
  );
}
