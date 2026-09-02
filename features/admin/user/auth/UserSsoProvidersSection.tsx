'use client';

import { IconUnlink } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import type { UserFull } from '@/lib/types/user/model';
import { InfoRow, InfoSection, providerLabel } from './shared';

export function UserSsoProvidersSection({
  auth,
  onRemoveProvider,
  isRemoveProviderPending,
}: {
  auth: UserFull['auth_details'];
  onRemoveProvider?: (provider: string, identifier: string) => boolean | Promise<boolean>;
  isRemoveProviderPending?: boolean;
}) {
  const tPage = useTranslations('adminUserDetail');
  const tCommonStates = useTranslations('common.states');
  const canRemoveProvider = Boolean(onRemoveProvider);

  return (
    <InfoSection title={tPage('auth.providers.title')} description={tPage('auth.providers.description')}>
      {auth?.providers.length ? (
        <Stack gap="xs">
          {auth.providers.map((provider) => (
            <InfoRow key={`${provider.provider}:${provider.identifier}`} label={providerLabel(provider.provider)}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Text size="sm" c="dimmed">
                  {tCommonStates('connected')}
                </Text>
                {canRemoveProvider ? (
                  <Tooltip label={tPage('auth.providers.remove')}>
                    <IconButton
                      size="sm"
                      tone="danger"
                      loading={isRemoveProviderPending}
                      onClick={() => onRemoveProvider?.(provider.provider, provider.identifier)}
                      aria-label={tPage('auth.providers.remove')}
                    >
                      <IconUnlink size={15} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Group>
            </InfoRow>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {tPage('auth.providers.empty')}
        </Text>
      )}
    </InfoSection>
  );
}
