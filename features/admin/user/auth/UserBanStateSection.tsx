'use client';

import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { UserFull } from '@/lib/types/user/model';
import { InfoRow, InfoSection, StatusValue } from './shared';

export function UserBanStateSection({ user }: { user: UserFull }) {
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
    <InfoSection title={tPage('auth.ban.title')} description={tPage('auth.ban.description')}>
      {ban ? (
        <Stack gap="xs">
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
              <Text size="sm">{ban.reason}</Text>
            </InfoRow>
          ) : null}
          {ban.expires_at ? (
            <InfoRow label={tCommonLabels('duration')}>
              <Text size="sm">
                <DateTime value={ban.expires_at} display="dateTime" />
              </Text>
            </InfoRow>
          ) : null}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {tPage('auth.ban.unknownState')}
        </Text>
      )}
    </InfoSection>
  );
}
